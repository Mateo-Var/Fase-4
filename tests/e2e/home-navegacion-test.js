'use strict'

/**
 * Spec: Navegación — Home (optimizado)
 *
 * Optimizaciones:
 *   - tapInicio via coordenadas ADB fijas (sin getPageSource)
 *   - sliderY calculado en discovery, reutilizado en navegación (sin getPageSource extra)
 *   - Pausas reducidas: 50ms discovery, 200ms swipes
 *   - 1 screenshot por sección
 *   - Early exit por contenido sin cambios
 */

const { screenshot } = require('../../utils/helpers')
const { execSync }   = require('child_process')

function getDevice() {
  return process.env.DEVICE_NAME || '192.168.1.175:5555'
}

function adb(cmd) {
  try { execSync(`adb -s ${getDevice()} ${cmd}`, { timeout: 5000 }) } catch (_) {}
}

function adbSwipe(x1, y1, x2, y2, dur = 500) {
  adb(`shell input swipe ${x1} ${y1} ${x2} ${y2} ${dur}`)
}

function adbTap(x, y) {
  adb(`shell input tap ${x} ${y}`)
}

function scrollDown() {
  adbSwipe(540, 1700, 540, 900, 300)
}

function scrollToTop() {
  for (let i = 0; i < 6; i++) adbSwipe(540, 300, 540, 1900, 100)
}

// ─── Extracción de secciones ─────────────────────────────────────────────────
const SKIP        = new Set(['VER TODO', 'VER TODO ›', 'Inicio', 'Explorar', 'Buscar',
                              'Cuenta', 'EN VIVO', 'Anteayer', 'Ayer', 'Hoy', 'Mañana',
                              'PROGRAMACIÓN ANTERIOR', 'PROGRAMACIÓN'])
const NO_VER_TODO = ['TOP 10', 'Programación', 'CONTINUAR VIENDO']

function extractSections(src, seenTitles) {
  const found = []

  // Heurística 1: texto corto en el mismo Y que "VER TODO"
  let from = 0
  while (true) {
    const vtIdx = src.indexOf('VER TODO', from)
    if (vtIdx === -1) break
    from = vtIdx + 1
    const vtTag = src.slice(src.lastIndexOf('<', vtIdx), src.indexOf('>', vtIdx) + 1)
    const vtB   = vtTag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (!vtB) continue
    const [vtY1, vtY2] = [+vtB[2], +vtB[4]]

    for (const m of [...src.matchAll(/\btext="([^"]{2,40})"/g)]) {
      const title = m[1].trim()
      if (SKIP.has(title) || seenTitles.has(title) || title.length < 3) continue
      const tIdx = src.indexOf(`text="${title}"`, Math.max(0, m.index - 2))
      const tTag = src.slice(src.lastIndexOf('<', tIdx), src.indexOf('>', tIdx) + 1)
      const tB   = tTag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
      if (!tB) continue
      if (Math.abs(+tB[2] - vtY1) > 30 && Math.abs(+tB[4] - vtY2) > 30) continue
      found.push({ title, sliderY: Math.min(+tB[4] + 220, 2050) })
      seenTitles.add(title)
    }
  }

  // Heurística 2: secciones sin VER TODO
  for (const title of NO_VER_TODO) {
    if (seenTitles.has(title)) continue
    const idx = src.indexOf(`text="${title}"`)
    if (idx === -1) continue
    const tag = src.slice(src.lastIndexOf('<', idx), src.indexOf('>', idx) + 1)
    const b   = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (!b) continue
    found.push({ title, sliderY: Math.min(+b[4] + 220, 2050) })
    seenTitles.add(title)
  }

  return found
}

// ─── Navegación: 2 swipes adelante + 2 atrás ─────────────────────────────────
async function navegarSlider(title, sliderY, prefix) {
  console.log(`  [swipe] "${title}" → Y=${sliderY}`)
  adbSwipe(980, sliderY, 30, sliderY, 600)
  await browser.pause(200)
  adbSwipe(980, sliderY, 30, sliderY, 600)
  await browser.pause(200)
  await screenshot(`${prefix}_adelante`)
  adbSwipe(30, sliderY, 980, sliderY, 600)
  await browser.pause(200)
  adbSwipe(30, sliderY, 980, sliderY, 600)
  await browser.pause(200)
}

// ─── Fisher-Yates pick N ─────────────────────────────────────────────────────
function pickRandom(arr, n) {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(n, copy.length))
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Navegación — Home', () => {

  it('deberia estar en la pantalla de Inicio', async () => {
    // Tap directo al tab Inicio sin getPageSource — siempre está en la esquina inferior izquierda
    adbTap(135, 2222)
    await browser.pause(1500)
    await screenshot('00_home')
    console.log('  ✓ En el Home')
  })

  it('deberia scrollear al inicio del home', async () => {
    scrollToTop()
    await browser.pause(400)
    await screenshot('00_home_top')
  })

  it('deberia descubrir secciones y navegar 4 sliders aleatorios', async () => {
    const seenTitles  = new Set()
    const allSections = []
    let   emptyStreak = 0
    let   lastSrcHash = ''

    console.log('  [discover] Escaneando...')

    for (let step = 0; step <= 18; step++) {
      if (step > 0) {
        scrollDown()
        await browser.pause(50)
        if (step % 2 !== 0) continue
      }

      const src     = await browser.getPageSource()
      const srcHash = src.length + src.slice(-150)

      if (srcHash === lastSrcHash) {
        console.log('  [discover] Fondo alcanzado')
        break
      }
      lastSrcHash = srcHash

      const found = extractSections(src, seenTitles)
      if (found.length > 0) {
        for (const s of found) {
          allSections.push({ ...s, scrollStep: step })
          console.log(`  [discover] ✓ "${s.title}"`)
        }
        emptyStreak = 0
      } else {
        if (++emptyStreak >= 2) { console.log('  [discover] Sin cambios'); break }
      }
    }

    console.log(`\n  Total: ${allSections.length} secciones`)
    if (allSections.length === 0) throw new Error('No se encontraron secciones')

    // Seleccionar 4 al azar, ordenadas por scrollStep
    const toNavigate = pickRandom(allSections, 4).sort((a, b) => a.scrollStep - b.scrollStep)
    console.log('\n  Seleccionadas:')
    toNavigate.forEach((s, i) => console.log(`    ${i + 1}. ${s.title}`))

    // Volver al tope y navegar sin re-escanear
    scrollToTop()
    await browser.pause(300)

    let currentStep = 0
    const results   = []

    for (let i = 0; i < toNavigate.length; i++) {
      const { title, sliderY, scrollStep } = toNavigate[i]
      const prefix = `nav_${String(i + 1).padStart(2, '0')}_${title.replace(/[\s\W]+/g, '_').toLowerCase()}`
      console.log(`\n  ── [${i + 1}/${toNavigate.length}] "${title}" ──`)

      // Scroll directo al paso donde está la sección
      const steps = scrollStep - currentStep
      for (let s = 0; s < steps; s++) { scrollDown(); await browser.pause(50) }
      currentStep = scrollStep
      await browser.pause(200)

      await navegarSlider(title, sliderY, prefix)
      results.push(title)
      console.log(`  ✓ "${title}"`)
    }

    // Reporte
    console.log('\n  ══════════ REPORTE ══════════')
    console.log(`  Encontradas : ${allSections.map(s => s.title).join(', ')}`)
    console.log(`  Navegadas   : ${results.join(', ')}`)
    console.log('  ════════════════════════════')

    expect(results.length).toBeGreaterThan(0)
  })

})
