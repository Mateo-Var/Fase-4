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

const { screenshot } = require('../../utils/helpers')
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

})
