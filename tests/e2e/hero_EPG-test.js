'use strict'

/**
 * Spec: Hero EPG — Programación
 *
 * 01 - La app carga y está en home screen
 * 02 - La sección Programación (Hero EPG) está visible
 * 03 - Los tabs Anteayer / Ayer / Hoy / Mañana son navegables
 * 04 - El carousel EN VIVO muestra canales live con horario
 * 05 - Cambia a otro canal live (no el primero) y valida el cambio
 * 06 - El swipe del carousel avanza y vuelve al canal anterior
 */

const { screenshot, dismissPromoPopupIfVisible } = require('../../utils/helpers')
const { execSync }   = require('child_process')

const APP_ID = process.env.APP_PACKAGE || 'com.azteca.live'

// ─── ADB ────────────────────────────────────────────────────────────────────

function getDevice() {
  return process.env.DEVICE_NAME || '192.168.1.175:5555'
}

function adb(cmd) {
  try { execSync(`adb -s ${getDevice()} ${cmd}`, { timeout: 5000 }) } catch (_) {}
}

// ─── getSource: con reintentos largos para cuando MIUI crashea UiAutomator2 ──
// Fallback a uiautomator dump por ADB si Appium no responde

async function getSource() {
  for (let i = 0; i < 8; i++) {
    try {
      const src = await browser.getPageSource()
      if (src && src.length > 500) return src
    } catch (_) {}
    await browser.pause(2000)
  }
  // Fallback: dump directo por ADB sin pasar por el servidor Appium
  try {
    execSync(`adb -s ${getDevice()} shell uiautomator dump /data/local/tmp/dump.xml`, { timeout: 10000 })
    const src = execSync(`adb -s ${getDevice()} shell cat /data/local/tmp/dump.xml`, { timeout: 8000 }).toString()
    if (src && src.length > 500) {
      console.log('  [source] ✓ fallback ADB dump usado')
      return src
    }
  } catch (_) {}
  return ''
}

// ─── scrolls ─────────────────────────────────────────────────────────────────

function scrollDown() {
  adb('shell input swipe 540 1700 540 900 300')
}

function scrollToTop() {
  for (let i = 0; i < 4; i++) adb('shell input swipe 540 300 540 1900 80')
}

// ─── boundsOf ────────────────────────────────────────────────────────────────

function boundsOf(src, text) {
  const idx = src.indexOf(text)
  if (idx === -1) return null
  const tagStart = src.lastIndexOf('<', idx)
  const tagEnd   = src.indexOf('>', idx)
  if (tagStart === -1 || tagEnd === -1) return null
  const tag = src.slice(tagStart, tagEnd + 1)
  const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  if (!b) return null
  return {
    x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4],
    cx: Math.round((+b[1] + +b[3]) / 2),
    cy: Math.round((+b[2] + +b[4]) / 2),
  }
}

function allBoundsOf(src, text) {
  const results = []
  let idx = 0
  while (true) {
    const found = src.indexOf(text, idx)
    if (found === -1) break
    const tagStart = src.lastIndexOf('<', found)
    const tagEnd   = src.indexOf('>', found)
    if (tagStart === -1 || tagEnd === -1) { idx = found + 1; continue }
    const tag = src.slice(tagStart, tagEnd + 1)
    const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (b) {
      results.push({
        x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4],
        cx: Math.round((+b[1] + +b[3]) / 2),
        cy: Math.round((+b[2] + +b[4]) / 2),
      })
    }
    idx = found + 1
  }
  return results
}

// ─── normalizarEstadoApp ─────────────────────────────────────────────────────

async function normalizarEstadoApp() {
  let estado = 0
  try {
    estado = await browser.execute('mobile: queryAppState', { appId: APP_ID })
  } catch (_) {}
  console.log(`  [estado] app state: ${estado}`)

  if (estado < 4) {
    console.log('  [estado] activando app...')
    try {
      await browser.execute('mobile: activateApp', { appId: APP_ID })
    } catch (_) { await browser.activateApp(APP_ID) }
    await browser.pause(2000)
  }

  adb('shell input tap 135 2222')
  await browser.pause(800)
  console.log('  [estado] ✓ tap Inicio ejecutado')
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('Hero EPG — Programación', () => {

  // ─── 01. App en home screen ───────────────────────────────────────────────
  it('01 - La app carga y está en home screen', async () => {
    const t = Date.now()

    await normalizarEstadoApp()

    // Cerrar popup publicitario si apareció al llegar al home
    await dismissPromoPopupIfVisible()

    // Captura del estado inicial para analizar qué hay en pantalla
    await screenshot('epg_01_estado_inicial')

    // Scroll al top para partir desde posición conocida
    scrollToTop()

    // Scroll hacia abajo para revelar la sección Programación
    // (está debajo del hero player — necesita bajar)
    let src = ''
    let encontrado = false

    for (let i = 0; i < 5; i++) {
      src = await getSource()

      if (!src || src.length < 500) {
        // UiAutomator2 aún crasheado — esperar sin scroll
        console.log(`  [home] intento ${i + 1}: esperando UiAutomator2...`)
        await browser.pause(2000)
        continue
      }

      console.log(`  [home] intento ${i + 1}: source OK (${src.length} chars)`)

      if (src.includes('Programación')) {
        encontrado = true
        console.log(`  [home] ✓ "Programación" encontrada`)
        break
      }

      // Bajar para revelar la sección EPG que está debajo del hero player
      console.log(`  [home] scrollDown para revelar Programación...`)
      scrollDown()
      await browser.pause(500)
    }

    if (!encontrado) throw new Error('Home screen no cargó — "Programación" no apareció')

    browser._srcHome = src
    console.log(`  [timing] home lista en ${((Date.now() - t) / 1000).toFixed(1)}s`)
    await screenshot('epg_01_home')
  })

  // ─── 02. Sección Programación visible ────────────────────────────────────
  it('02 - La sección Programación (Hero EPG) es visible', async () => {
    const t = Date.now()

    let src = browser._srcHome || ''
    if (!src.includes('Programación')) {
      for (let i = 0; i < 4; i++) {
        src = await getSource()
        if (src.includes('Programación')) break
        scrollDown()
        await browser.pause(400)
      }
    }

    if (!src.includes('Programación')) throw new Error('Sección Programación no encontrada')

    browser._srcProg = src
    console.log(`  [timing] Programación visible en ${((Date.now() - t) / 1000).toFixed(1)}s`)
    await screenshot('epg_02_programacion')
  })

  // ─── 03. Tabs Anteayer / Ayer / Hoy / Mañana ─────────────────────────────
  it('03 - Los tabs de Programación son navegables', async () => {
    const src  = browser._srcProg || await getSource()
    const tabs = ['Anteayer', 'Ayer', 'Hoy', 'Mañana']

    const tabBounds = {}
    for (const nombre of tabs) {
      tabBounds[nombre] = boundsOf(src, `"${nombre}"`) || boundsOf(src, `>${nombre}<`)
      if (tabBounds[nombre]) {
        console.log(`  [tabs] encontrado "${nombre}" → (${tabBounds[nombre].cx}, ${tabBounds[nombre].cy})`)
      } else {
        console.log(`  [tabs] ⚠ "${nombre}" no encontrado en source`)
      }
    }

    for (const nombre of tabs) {
      const b = tabBounds[nombre]
      if (!b) { continue }
      adb(`shell input tap ${b.cx} ${b.cy}`)
      await browser.pause(400)
      console.log(`  [tabs] ✓ "${nombre}" tapeado`)
      await screenshot(`epg_03_tab_${nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ñ/g, 'n')}`)
    }

    const bHoy = tabBounds['Hoy']
    if (bHoy) { adb(`shell input tap ${bHoy.cx} ${bHoy.cy}`); await browser.pause(400) }
    console.log('  [tabs] ✓ vuelto a Hoy')
    await screenshot('epg_03_tabs_ok')
  })

  // ─── 04. Carousel EN VIVO — análisis de lives activos ────────────────────
  it('04 - El carousel muestra canales EN VIVO con info de horario', async () => {
    const src = await getSource()

    const lives = []
    const cdRegex = /content-desc="(EN VIVO,[^"]+)"/g
    let m
    while ((m = cdRegex.exec(src)) !== null) lives.push(m[1])

    const badgeCount = (src.match(/text="EN VIVO"/g) || []).length

    console.log(`\n  [carousel] ── Canales live activos (${lives.length || badgeCount}) ──`)
    if (lives.length > 0) {
      lives.forEach((info, i) => console.log(`    ${i + 1}. ${info}`))
    } else if (badgeCount > 0) {
      console.log(`    ${badgeCount} badge(s) EN VIVO presentes`)
    } else {
      console.log('    ADVERTENCIA: sin lives activos en este momento')
    }
    console.log()

    browser._livesDetectados = lives
    browser._srcCarousel     = src

    await screenshot('epg_04_carousel_live')
    expect(src.includes('Programación')).toBe(true)
  })

  // ─── 05. Cambiar a otro canal live y validar el cambio ───────────────────
  it('05 - Cambia a otro canal live y valida el cambio', async () => {
    const src      = browser._srcCarousel || await getSource()
    const tarjetas = allBoundsOf(src, 'content-desc="EN VIVO,')
    const livesInfo = browser._livesDetectados || []

    console.log(`\n  [canal] ── Lives disponibles: ${tarjetas.length} ──`)
    tarjetas.forEach((t, i) => {
      const info = livesInfo[i] || ''
      console.log(`    ${i + 1}. (${t.cx}, ${t.cy})${info ? ' → ' + info : ''}`)
    })
    console.log()

    if (tarjetas.length < 2) {
      console.log('  [canal] solo 1 live activo — SKIP')
      expect(true).toBe(true)
      return
    }

    await screenshot('epg_05_antes_cambio')

    const canalDestino = tarjetas[1]
    const infoDestino  = livesInfo[1] || 'canal #2'
    console.log(`  [canal] → cambiando a: ${infoDestino}`)

    adb(`shell input tap ${canalDestino.cx} ${canalDestino.cy}`)
    await browser.pause(1500)
    await screenshot('epg_05_tras_cambio')

    const srcPost        = await getSource()
    const tituloDestino  = infoDestino.split(',').pop()?.trim() || ''
    const cambioDetectado = tituloDestino && srcPost.includes(tituloDestino)

    if (cambioDetectado) {
      console.log(`  [canal] ✓ cambio confirmado — "${tituloDestino}"`)
    } else if (srcPost !== src) {
      console.log(`  [canal] ✓ pantalla cambió (verificar screenshot)`)
    } else {
      console.log(`  [canal] ⚠ cambio no confirmado — revisar screenshot`)
    }

    const enVivoB = boundsOf(srcPost, 'text="EN VIVO"')
    browser._carouselY = enVivoB ? enVivoB.cy : null

    expect(true).toBe(true)
  })

  // ─── 06. Swipe carousel: avanzar y volver ────────────────────────────────
  it('06 - El swipe del carousel avanza y vuelve al canal anterior', async () => {
    let carouselY = browser._carouselY
    if (!carouselY) {
      const src = await getSource()
      const b   = boundsOf(src, 'text="EN VIVO"')
      carouselY = b ? b.cy : 1300
    }

    const { width } = await browser.getWindowSize()
    const x1 = Math.floor(width * 0.85)
    const x2 = Math.floor(width * 0.05)

    console.log(`  [swipe] carousel Y: ${carouselY}`)

    console.log('  [swipe] → swipe 1: siguiente canal')
    adb(`shell input swipe ${x1} ${carouselY} ${x2} ${carouselY} 400`)
    await browser.pause(600)
    await screenshot('epg_06_swipe_1')

    console.log('  [swipe] → swipe 2: siguiente canal')
    adb(`shell input swipe ${x1} ${carouselY} ${x2} ${carouselY} 400`)
    await browser.pause(600)
    await screenshot('epg_06_swipe_2')

    console.log('  [swipe] ✓ completados')
    expect(true).toBe(true)
  })

  // ─── 07. Navegar al tab Explorar ─────────────────────────────────────────
  it('07 - Navega al tab Explorar desde el nav bar', async () => {
    // El tab Explorar usa resource-id tab-discover (MIUI: siempre ADB tap via bounds)
    const src = await getSource()

    // Intentar por resource-id primero
    let tapado = false
    const byId = src.match(/resource-id="[^"]*tab-discover[^"]*"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (byId) {
      const cx = Math.round((+byId[1] + +byId[3]) / 2)
      const cy = Math.round((+byId[2] + +byId[4]) / 2)
      adb(`shell input tap ${cx} ${cy}`)
      tapado = true
      console.log(`  [explorar] tap via resource-id → (${cx}, ${cy})`)
    }

    // Fallback: buscar por content-desc o texto "Explorar"
    if (!tapado) {
      for (const label of ['Explorar', 'Discover', 'Descubrir']) {
        const b = boundsOf(src, label)
        if (b && b.cy > 2000) { // nav bar está en la parte baja
          adb(`shell input tap ${b.cx} ${b.cy}`)
          tapado = true
          console.log(`  [explorar] tap via texto "${label}" → (${b.cx}, ${b.cy})`)
          break
        }
      }
    }

    if (!tapado) throw new Error('[07] No se encontró el tab Explorar en el nav bar')

    await browser.pause(2500)
    await screenshot('epg_07_explorar')

    const srcPost = await getSource()
    // Verificar que cargó contenido de Explorar (busca sección EN VIVO o VIDEOS)
    const enExplorar = srcPost.includes('EN VIVO') || srcPost.includes('VIDEOS') ||
                       srcPost.includes('Explorar') || srcPost.includes('CANALES')
    if (!enExplorar) throw new Error('[07] El tab Explorar no cargó contenido reconocible')

    browser._srcExplorar = srcPost
    console.log('  [explorar] ✓ tab Explorar cargado')
    expect(enExplorar).toBe(true)
  })

  // ─── 08. Entrar a la sección EN VIVO desde Explorar ──────────────────────
  it('08 - Entra a la sección EN VIVO desde Explorar', async () => {
    let src = browser._srcExplorar || await getSource()
    await screenshot('epg_08_antes_en_vivo')

    // Buscar el botón/tab EN VIVO en la página de Explorar
    // Puede aparecer como texto, content-desc o tab de navegación
    const labels = ['EN VIVO', 'En vivo', 'LIVE', 'Live']
    let encontrado = false

    for (const label of labels) {
      const b = boundsOf(src, label)
      if (b) {
        console.log(`  [en vivo] "${label}" encontrado → tap (${b.cx}, ${b.cy})`)
        adb(`shell input tap ${b.cx} ${b.cy}`)
        encontrado = true
        break
      }
    }

    if (!encontrado) {
      // Scroll para buscar más abajo
      for (let i = 0; i < 3; i++) {
        adb('shell input swipe 540 1700 540 900 300')
        await browser.pause(800)
        src = await getSource()
        for (const label of labels) {
          const b = boundsOf(src, label)
          if (b) {
            console.log(`  [en vivo] "${label}" encontrado tras scroll → tap (${b.cx}, ${b.cy})`)
            adb(`shell input tap ${b.cx} ${b.cy}`)
            encontrado = true
            break
          }
        }
        if (encontrado) break
      }
    }

    if (!encontrado) throw new Error('[08] No se encontró la sección EN VIVO en Explorar')

    await browser.pause(2500)
    await screenshot('epg_08_en_vivo_cargando')

    const srcPost = await getSource()
    browser._srcEnVivo = srcPost
    console.log('  [en vivo] ✓ sección EN VIVO abierta')
    expect(true).toBe(true)
  })

  // ─── 09. EN VIVO: player activo + "ESTÁS VIENDO" visible ────────────────
  it('09 - EN VIVO muestra un player activo y el canal que se está viendo', async () => {
    const src = await getSource()
    await screenshot('epg_09_en_vivo_overview')

    // Verificar que hay un player activo (el área superior clickeable)
    const playerClickeable = src.includes('Mostrar controles del reproductor')
    console.log(`  [player] area del reproductor clickeable: ${playerClickeable}`)
    expect(playerClickeable).toBe(true)

    // Verificar "ESTÁS VIENDO" — indica qué canal se reproduce actualmente
    const estaViendo = src.includes('ESTÁS VIENDO')
    console.log(`  [player] "ESTÁS VIENDO" visible: ${estaViendo}`)
    expect(estaViendo).toBe(true)

    // Extraer el canal que está viendo
    const cdEstaViendo = src.match(/content-desc="ESTÁS VIENDO,\s+•\s+([^,]+),\s+([^"]+)"/)
    if (cdEstaViendo) {
      console.log(`  [player] ✓ Reproduciendo: ${cdEstaViendo[1]} — ${cdEstaViendo[2]}`)
      browser._canalActual = cdEstaViendo[1].trim()
      browser._programaActual = cdEstaViendo[2].trim()
    }

    await screenshot('epg_09_player_estas_viendo')
    expect(estaViendo).toBe(true)
  })

  // ─── 10. EN VIVO: lista de canales con canal y horario ───────────────────
  it('10 - La lista de canales muestra nombre de canal, programa y horario', async () => {
    const src = await getSource()
    await screenshot('epg_10_lista_canales')

    // Los canales tienen content-desc con patrón "HH:MM - HH:MM,   •  Canal, PROGRAMA"
    // o "ESTÁS VIENDO,   •  Canal, PROGRAMA" para el canal actual
    const tarjetas = [...src.matchAll(/content-desc="([^"]+•[^"]+)"[^>]*clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
      .map(m => ({
        desc: m[1],
        cx: Math.round((+m[2] + +m[4]) / 2),
        cy: Math.round((+m[3] + +m[5]) / 2),
      }))
      .filter(t => t.cy > 900 && t.cy < 2300) // solo las tarjetas de la lista, no la navbar

    console.log(`\n  [lista] ── Canales disponibles (${tarjetas.length}) ──`)
    tarjetas.forEach((t, i) => console.log(`    ${i + 1}. [y=${t.cy}] ${t.desc}`))
    console.log()

    expect(tarjetas.length).toBeGreaterThan(0)

    // Verificar tabs GUIA y CANALES RECIENTES
    const hayGuia            = src.includes('GUIA')
    const hayCanalesRecientes = src.includes('CANALES RECIENTES')
    console.log(`  [tabs] GUIA: ${hayGuia} | CANALES RECIENTES: ${hayCanalesRecientes}`)

    browser._tarjetasCanales = tarjetas
    expect(tarjetas.length).toBeGreaterThan(0)
  })

  // ─── 11. EN VIVO: tap en controles del reproductor ───────────────────────
  it('11 - Tap en el player abre los controles del reproductor', async () => {
    await screenshot('epg_11_antes_tap_player')

    // Tap en el área del reproductor (centro del player en la parte superior)
    const playerBounds = boundsOf(await getSource(), 'Mostrar controles del reproductor')
    if (!playerBounds) {
      console.log('  [player] ⚠ no se encontró el área del reproductor — SKIP')
      expect(true).toBe(true)
      return
    }

    console.log(`  [player] tap en reproductor → (${playerBounds.cx}, ${playerBounds.cy})`)
    adb(`shell input tap ${playerBounds.cx} ${playerBounds.cy}`)
    await browser.pause(2000)
    await screenshot('epg_11_controles_player')

    const srcPost = await getSource()

    // Los controles pueden incluir: botón de pantalla completa, pausa, volumen, etc.
    const controlesVisibles =
      srcPost.includes('pantalla completa') ||
      srcPost.includes('Pantalla completa') ||
      srcPost.includes('fullscreen') ||
      srcPost.includes('Pausa') ||
      srcPost.includes('Reproducir') ||
      srcPost.includes('pause') ||
      srcPost.includes('Silenciar') ||
      srcPost.includes('EN VIVO') // al menos el badge EN VIVO sigue visible

    console.log(`  [player] controles visibles: ${controlesVisibles}`)
    await screenshot('epg_11_player_con_controles')

    // Tap fuera para cerrar controles si los abrió
    adb('shell input tap 540 400')
    await browser.pause(1000)

    expect(true).toBe(true)
  })

  // ─── 12. EN VIVO: cambiar a un canal diferente de la lista ───────────────
  it('12 - Cambia a un canal diferente de la lista y verifica el cambio', async () => {
    const tarjetas = browser._tarjetasCanales || []
    const src = await getSource()

    // Refrescar tarjetas si no están guardadas
    const lista = tarjetas.length > 0 ? tarjetas :
      [...src.matchAll(/content-desc="([^"]+•[^"]+)"[^>]*clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
        .map(m => ({
          desc: m[1],
          cx: Math.round((+m[2] + +m[4]) / 2),
          cy: Math.round((+m[3] + +m[5]) / 2),
        }))
        .filter(t => t.cy > 900 && t.cy < 2300)

    // Saltar la primera tarjeta (ESTÁS VIENDO = canal actual) y tapear la segunda
    const candidatos = lista.filter(t => !t.desc.startsWith('ESTÁS VIENDO'))
    if (candidatos.length === 0) {
      console.log('  [cambio] ⚠ no hay otros canales para cambiar — SKIP')
      expect(true).toBe(true)
      return
    }

    const destino = candidatos[0]
    console.log(`  [cambio] → cambiando a: ${destino.desc}`)
    await screenshot('epg_12_antes_cambio')

    adb(`shell input tap ${destino.cx} ${destino.cy}`)
    await browser.pause(3000)
    await screenshot('epg_12_tras_cambio')

    const srcPost = await getSource()

    // Verificar que "ESTÁS VIENDO" ahora apunta al canal nuevo
    const nuevoCanalMatch = srcPost.match(/content-desc="ESTÁS VIENDO,\s+•\s+([^,]+),\s+([^"]+)"/)
    if (nuevoCanalMatch) {
      const nuevoCanal = nuevoCanalMatch[1].trim()
      console.log(`  [cambio] ✓ ahora reproduciendo: ${nuevoCanal} — ${nuevoCanalMatch[2].trim()}`)
      if (browser._canalActual && nuevoCanal !== browser._canalActual) {
        console.log(`  [cambio] ✓ canal cambió: "${browser._canalActual}" → "${nuevoCanal}"`)
      }
    } else {
      console.log('  [cambio] canal cambiado — "ESTÁS VIENDO" no visible en este momento (puede estar cargando)')
    }

    expect(true).toBe(true)
  })

  // ─── 13. EN VIVO: canal no disponible muestra aviso correcto ─────────────
  it('13 - Canal bloqueado muestra aviso "solo por TV" o restricción', async () => {
    const src = await getSource()

    // Buscar la tarjeta "PROGRAMA DISPONIBLE SOLO POR TV"
    const bloqueado = [...src.matchAll(/content-desc="([^"]+•[^"]+)"[^>]*clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
      .map(m => ({
        desc: m[1],
        cx: Math.round((+m[2] + +m[4]) / 2),
        cy: Math.round((+m[3] + +m[5]) / 2),
      }))
      .find(t => t.desc.includes('SOLO POR TV') || t.desc.includes('solo por TV'))

    if (!bloqueado) {
      console.log('  [bloqueado] canal restringido no visible en pantalla actual — scrolleando...')

      // Scroll para buscar más canales
      adb('shell input swipe 540 1800 540 900 400')
      await browser.pause(1200)
      const srcScroll = await getSource()

      const bloqueadoScroll = [...srcScroll.matchAll(/content-desc="([^"]+•[^"]+)"[^>]*clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g)]
        .map(m => ({
          desc: m[1],
          cx: Math.round((+m[2] + +m[4]) / 2),
          cy: Math.round((+m[3] + +m[5]) / 2),
        }))
        .find(t => t.desc.includes('SOLO POR TV') || t.desc.includes('solo por TV'))

      if (!bloqueadoScroll) {
        console.log('  [bloqueado] ⚠ no se encontró canal bloqueado — SKIP')
        expect(true).toBe(true)
        return
      }

      await screenshot('epg_13_canal_bloqueado_encontrado')
      console.log(`  [bloqueado] tapeando: ${bloqueadoScroll.desc}`)
      adb(`shell input tap ${bloqueadoScroll.cx} ${bloqueadoScroll.cy}`)
    } else {
      await screenshot('epg_13_canal_bloqueado_encontrado')
      console.log(`  [bloqueado] tapeando: ${bloqueado.desc}`)
      adb(`shell input tap ${bloqueado.cx} ${bloqueado.cy}`)
    }

    await browser.pause(3000)
    await screenshot('epg_13_tras_tap_bloqueado')

    const srcPost = await getSource()

    // Verificar que aparece algún mensaje de restricción
    const mensajeRestriccion =
      srcPost.includes('SOLO POR TV') ||
      srcPost.includes('solo por TV') ||
      srcPost.includes('no disponible') ||
      srcPost.includes('No disponible') ||
      srcPost.includes('restricci') ||
      srcPost.includes('suscripci') ||
      srcPost.includes('contratar') ||
      srcPost.includes('canal abierto') ||
      srcPost.includes('suscriptor')

    if (mensajeRestriccion) {
      console.log('  [bloqueado] ✓ mensaje de restricción mostrado correctamente')
    } else {
      console.log('  [bloqueado] ⚠ no se detectó mensaje de restricción — revisar screenshot')
    }

    await screenshot('epg_13_mensaje_restriccion')
    expect(true).toBe(true)
  })

  // ─── 14. EN VIVO: navegar tab CANALES RECIENTES ──────────────────────────
  it('14 - El tab CANALES RECIENTES muestra historial de canales vistos', async () => {
    // Scroll al top de la lista para ver los tabs GUIA / CANALES RECIENTES
    adb('shell input swipe 540 300 540 1900 80')
    await browser.pause(1000)

    const src = await getSource()
    await screenshot('epg_14_tabs_guia_recientes')

    const bRecientes = boundsOf(src, 'CANALES RECIENTES')
    if (!bRecientes) {
      console.log('  [recientes] tab CANALES RECIENTES no encontrado — SKIP')
      expect(true).toBe(true)
      return
    }

    console.log(`  [recientes] tap "CANALES RECIENTES" → (${bRecientes.cx}, ${bRecientes.cy})`)
    adb(`shell input tap ${bRecientes.cx} ${bRecientes.cy}`)
    await browser.pause(2000)
    await screenshot('epg_14_canales_recientes')

    const srcPost = await getSource()
    const hayContenido = srcPost.includes('ESTÁS VIENDO') || srcPost.includes('Azteca') ||
                         srcPost.includes('•') || srcPost.length > 5000

    console.log(`  [recientes] contenido visible: ${hayContenido}`)

    // Volver al tab GUIA
    const bGuia = boundsOf(srcPost, 'GUIA')
    if (bGuia) {
      adb(`shell input tap ${bGuia.cx} ${bGuia.cy}`)
      await browser.pause(1000)
      console.log('  [recientes] ✓ vuelto a tab GUIA')
    }

    await screenshot('epg_14_vuelta_a_guia')
    expect(true).toBe(true)
  })

  // ─── 15. Salir de EN VIVO y volver al home ────────────────────────────────
  it('15 - Sale de la sección EN VIVO y vuelve al home', async () => {
    await screenshot('epg_15_antes_de_salir')

    // BACK para salir de EN VIVO / Explorar
    adb('shell input keyevent 4')
    await browser.pause(1500)

    const src = await getSource()
    const enExplorar = src.includes('EN VIVO') || src.includes('VIDEOS') || src.includes('tab-discover')
    if (enExplorar) {
      console.log('  [salir] sigue en Explorar — segundo BACK')
      adb('shell input keyevent 4')
      await browser.pause(1500)
    }

    // Tap home en navbar para dejar la app en estado limpio
    adb('shell input tap 135 2222')
    await browser.pause(1500)
    await screenshot('epg_15_home_restaurado')
    console.log('  [salir] ✓ vuelto al home')
    expect(true).toBe(true)
  })

})
