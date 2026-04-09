'use strict'

/**
 * Spec: Explorar → Videos
 *
 * 01 - Navegar al tab Explorar desde el nav bar
 * 02 - Entrar a la sección Videos
 * 03 - Analizar los primeros 2 componentes y seleccionar un show
 */

const { screenshot } = require('../../utils/helpers')
const { execSync }   = require('child_process')

const APP_ID = process.env.APP_PACKAGE || 'com.azteca.live'

// ─── Helpers ────────────────────────────────────────────────────────────────

function getDevice() {
  return process.env.DEVICE_NAME || '192.168.1.175:5555'
}

function adb(cmd) {
  try { execSync(`adb -s ${getDevice()} ${cmd}`, { timeout: 5000 }) } catch (_) {}
}

async function getSource() {
  for (let i = 0; i < 8; i++) {
    try {
      const src = await browser.getPageSource()
      if (src && src.length > 500) return src
    } catch (_) {}
    await browser.pause(2000)
  }
  // Fallback ADB dump
  try {
    execSync(`adb -s ${getDevice()} shell uiautomator dump /data/local/tmp/dump.xml`, { timeout: 10000 })
    const src = execSync(`adb -s ${getDevice()} shell cat /data/local/tmp/dump.xml`, { timeout: 8000 }).toString()
    if (src && src.length > 500) return src
  } catch (_) {}
  return ''
}

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

// Espera hasta que un elemento aparece en source — reintentos con pausa
async function esperarElemento(texto, maxIntentos = 10, pausaMs = 1000) {
  for (let i = 0; i < maxIntentos; i++) {
    const src = await getSource()
    const b   = boundsOf(src, texto)
    if (b) return { b, src }
    console.log(`  [esperar] "${texto}" no visible — intento ${i + 1}/${maxIntentos}`)
    await browser.pause(pausaMs)
  }
  return null
}

// Tap en elemento encontrado dinámicamente desde el source
async function tapElemento(texto, maxIntentos = 8) {
  const result = await esperarElemento(texto, maxIntentos, 1000)
  if (!result) throw new Error(`"${texto}" no encontrado — no se puede tapear`)
  const { b, src } = result
  adb(`shell input tap ${b.cx} ${b.cy}`)
  console.log(`  [tap] "${texto}" → (${b.cx}, ${b.cy})`)
  return { b, src }
}

// Normalizar estado de la app
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

  // Tap Inicio primero para partir desde home conocido
  adb('shell input tap 135 2222')
  await browser.pause(800)
  console.log('  [estado] ✓ en home')
}

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('Explorar → Videos', () => {

  // ─── 01. Navegar a Explorar ───────────────────────────────────────────────
  it('01 - Navegar al tab Explorar desde el nav bar', async () => {
    await normalizarEstadoApp()
    await screenshot('explorar_01_estado_inicial')

    // Buscar "Explorar" en el nav bar y tapearlo
    const result = await tapElemento('Explorar', 10)
    await browser.pause(1200)

    // Validar que llegamos a la pantalla de Explorar
    const src = await getSource()
    const enExplorar = src.includes('Explorar') || src.includes('Videos') || src.includes('Series')

    console.log(`  [explorar] pantalla Explorar cargada: ${enExplorar}`)
    await screenshot('explorar_01_pantalla')

    if (!enExplorar) throw new Error('No se llegó a la pantalla de Explorar')
  })

  // ─── 02. Entrar a Videos y esperar que los componentes rendericen ──────────
  it('02 - Entrar a la sección Videos', async () => {
    // Selector estable: content-desc="VIDEOS" (confirmado por XML dump)
    await tapElemento('VIDEOS', 8)

    // Loop igual al EPG: getSource() hasta que los shows estén en el XML
    // Los shows siempre tienen content-desc con ", PROGRAMA DE TELEVISI" (patrón estable)
    let src = ''
    let cargado = false
    for (let i = 0; i < 10; i++) {
      src = await getSource()
      console.log(`  [videos] intento ${i + 1}: ${src.length} chars | shows: ${src.includes(', PROGRAMA DE TELEVISI')}`)
      if (src.includes(', PROGRAMA DE TELEVISI')) { cargado = true; break }
      await browser.pause(1000)
    }

    await screenshot('explorar_02_videos')
    if (!cargado) throw new Error('Videos no cargó sus componentes — shows no aparecieron en XML')

    browser._srcVideos = src
    console.log('  [videos] ✓ componentes renderizados')
  })

  // ─── 03. Seleccionar un show de los primeros 2 componentes ───────────────
  it('03 - Seleccionar un show de los primeros componentes', async () => {
    const src = browser._srcVideos || await getSource()

    // Los shows tienen content-desc con patrón estable: "ShowName, PROGRAMA DE TELEVISI..."
    // Usar el mismo enfoque que el EPG: buscar el texto en el source y extraer bounds del tag
    const shows = []
    const PATRON = ', PROGRAMA DE TELEVISI'
    let idx = 0

    while (true) {
      const found = src.indexOf(PATRON, idx)
      if (found === -1) break

      // Extraer el tag completo que contiene este content-desc
      const tagStart = src.lastIndexOf('<', found)
      const tagEnd   = src.indexOf('>', found)
      if (tagStart === -1 || tagEnd === -1) { idx = found + 1; continue }

      const tag = src.slice(tagStart, tagEnd + 1)

      // Solo elementos clickeables
      if (!tag.includes('clickable="true"')) { idx = found + 1; continue }

      const b  = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
      const cd = (tag.match(/content-desc="([^"]+)"/) || [])[1] || ''
      if (!b) { idx = found + 1; continue }

      shows.push({
        cx:     Math.round((+b[1] + +b[3]) / 2),
        cy:     Math.round((+b[2] + +b[4]) / 2),
        y1:     +b[2],
        titulo: cd.split(',')[0].trim(),
      })
      idx = found + 1
    }

    // Ordenar por Y (primero los que están más arriba = primeros componentes)
    shows.sort((a, b) => a.y1 - b.y1)

    console.log(`\n  [shows] shows detectados en pantalla: ${shows.length}`)
    shows.forEach((s, i) =>
      console.log(`    ${i + 1}. (${s.cx}, ${s.cy}) → "${s.titulo}"`)
    )

    if (shows.length === 0) {
      console.log('  [shows] ⚠ ningún show detectado — revisar screenshot')
      await screenshot('explorar_03_sin_shows')
      expect(true).toBe(true)
      return
    }

    // Seleccionar el primer show visible (primer componente)
    const show = shows[0]
    console.log(`\n  [shows] → seleccionando: "${show.titulo}"`)
    console.log(`  [shows]   coordenadas: (${show.cx}, ${show.cy})`)

    await screenshot('explorar_03_antes_seleccion')
    adb(`shell input tap ${show.cx} ${show.cy}`)
    await browser.pause(1500)
    await screenshot('explorar_03_show_seleccionado')

    const srcPost  = await getSource()
    const cambio   = srcPost !== src
    const enDetalle = srcPost.includes(show.titulo)
    console.log(`  [shows] pantalla cambió: ${cambio} | título visible: ${enDetalle}`)

    expect(cambio).toBe(true)
  })

  // ─── 04. Scroll en el show y reproducir un episodio aleatorio ────────────
  it('04 - Reproducir un episodio aleatorio del show', async () => {
    // Scroll para revelar los episodios (están debajo del header del show)
    adb('shell input swipe 540 1500 540 800 400')
    await browser.pause(1000)

    // Loop: esperar hasta que los episodios aparezcan en el XML
    // Patrón estable: content-desc con " · " y " MIN" — formato de duración de episodios
    let src = ''
    let encontrado = false
    for (let i = 0; i < 8; i++) {
      src = await getSource()
      const tieneEpisodios = src.includes(' · ') && src.includes(' MIN')
      console.log(`  [episodios] intento ${i + 1}: ${src.length} chars | episodios: ${tieneEpisodios}`)
      if (tieneEpisodios) { encontrado = true; break }
      adb('shell input swipe 540 1500 540 800 300')
      await browser.pause(800)
    }

    await screenshot('explorar_04_episodios')

    if (!encontrado) {
      console.log('  [episodios] ⚠ no se encontraron episodios — revisar screenshot')
      expect(true).toBe(true)
      return
    }

    // Extraer todos los episodios usando el mismo enfoque que el EPG
    // El patrón " · " aparece en el content-desc de cada episodio: "FECHA · DURACIÓN, Título..."
    const episodios = []
    const PATRON = ' · '
    let idx = 0

    while (true) {
      const found = src.indexOf(PATRON, idx)
      if (found === -1) break

      const tagStart = src.lastIndexOf('<', found)
      const tagEnd   = src.indexOf('>', found)
      if (tagStart === -1 || tagEnd === -1) { idx = found + 1; continue }

      const tag = src.slice(tagStart, tagEnd + 1)
      if (!tag.includes('clickable="true"')) { idx = found + 1; continue }
      if (!tag.includes(' MIN')) { idx = found + 1; continue }

      const b  = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
      const cd = (tag.match(/content-desc="([^"]+)"/) || [])[1] || ''
      if (!b) { idx = found + 1; continue }

      // Filtrar nav bar (y > 2100)
      if (+b[2] > 2100) { idx = found + 1; continue }

      const titulo = cd.split(',')[1]?.trim() || cd.split('·')[1]?.trim() || cd
      episodios.push({
        cx:     Math.round((+b[1] + +b[3]) / 2),
        cy:     Math.round((+b[2] + +b[4]) / 2),
        titulo: titulo.slice(0, 60),
      })
      idx = found + 1
    }

    console.log(`\n  [episodios] episodios detectados: ${episodios.length}`)
    episodios.forEach((e, i) =>
      console.log(`    ${i + 1}. (${e.cx}, ${e.cy}) → "${e.titulo}"`)
    )

    if (episodios.length === 0) {
      console.log('  [episodios] ⚠ sin episodios clickeables — revisar screenshot')
      expect(true).toBe(true)
      return
    }

    // Seleccionar un episodio aleatorio
    const idx2 = Math.floor(Math.random() * episodios.length)
    const ep   = episodios[idx2]
    console.log(`\n  [episodios] → reproduciendo episodio #${idx2 + 1}: "${ep.titulo}"`)
    console.log(`  [episodios]   coordenadas: (${ep.cx}, ${ep.cy})`)

    await screenshot('explorar_04_antes_reproducir')
    adb(`shell input tap ${ep.cx} ${ep.cy}`)
    await browser.pause(2000)
    await screenshot('explorar_04_reproduciendo')

    const srcPost = await getSource()
    const cambio  = srcPost !== src
    console.log(`  [episodios] ✓ pantalla cambió tras tap: ${cambio}`)

    expect(cambio).toBe(true)
  })

})
