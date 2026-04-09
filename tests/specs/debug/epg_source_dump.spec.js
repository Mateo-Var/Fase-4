'use strict'

/**
 * Debug: vuelca el page source del home (con el player del Hero EPG) a un archivo local
 * para inspeccionar la estructura XML real del player y encontrar los bounds correctos.
 */

const fs   = require('fs')
const path = require('path')

function scrollDown() {
  const { execSync } = require('child_process')
  const device = process.env.DEVICE_NAME || '192.168.1.175:5555'
  try { execSync(`adb -s ${device} shell input swipe 540 1700 540 900 300`, { timeout: 5000 }) } catch (_) {}
}

describe('DEBUG — Page source dump del Hero EPG', () => {

  it('deberia volcar el source del player a un archivo', async () => {
    // Ir al home
    const { execSync } = require('child_process')
    const device = process.env.DEVICE_NAME || '192.168.1.175:5555'
    const adb = (cmd) => { try { execSync(`adb -s ${device} ${cmd}`, { timeout: 5000 }) } catch (_) {} }

    adb('shell input tap 135 2222')
    await browser.pause(1500)
    // Scroll al top
    for (let i = 0; i < 6; i++) adb('shell input swipe 540 300 540 1900 100')
    await browser.pause(500)

    // ── 1. Source inicial (player visible, controles posiblemente ocultos) ──────
    let src = await browser.getPageSource()

    // Scroll hasta encontrar Programación si no está visible
    for (let i = 0; i < 10; i++) {
      if (src.includes('Programación') || src.includes('Programacion')) break
      scrollDown()
      await browser.pause(150)
      src = await browser.getPageSource()
    }

    const outDir = path.join(__dirname, '..', '..', '..', 'reports')
    fs.mkdirSync(outDir, { recursive: true })

    const file1 = path.join(outDir, 'epg_source_inicial.xml')
    fs.writeFileSync(file1, src)
    console.log(`\n  Source inicial guardado en: ${file1} (${src.length} chars)`)

    // ── 2. Buscar bounds de "Mostrar controles del reproductor" ─────────────────
    const idx = src.indexOf('Mostrar controles del reproductor')
    if (idx !== -1) {
      const tag = src.slice(src.lastIndexOf('<', idx), src.indexOf('>', idx) + 1)
      console.log(`\n  Elemento "Mostrar controles": ${tag.slice(0, 400)}`)
    } else {
      console.log('\n  "Mostrar controles del reproductor" NO encontrado en source inicial')
    }

    // ── 3. Tap en zona fija (top-center de pantalla) → mostrar controles ────────
    // Usamos coordenadas fijas para no depender de bounds calculados
    const tapX = 540
    const tapY = 300
    console.log(`\n  Tap en zona fija (${tapX}, ${tapY}) para mostrar controles...`)
    adb(`shell input tap ${tapX} ${tapY}`)
    await browser.pause(500)  // fadeIn duration=0 + bridge ~200ms

    // ── 4. Source con controles (deberían estar visibles 5s) ────────────────────
    const srcConControles = await browser.getPageSource()
    const file2 = path.join(outDir, 'epg_source_con_controles.xml')
    fs.writeFileSync(file2, srcConControles)
    console.log(`  Source con controles guardado en: ${file2} (${srcConControles.length} chars)`)

    // ── 5. Análisis: elementos clickeables en el cuadrante superior-derecho ─────
    console.log('\n  Elementos clickeables en X>500, Y<700:')
    const nodeRegex = /<node[^>]+>/g
    let match
    const candidatos = []
    while ((match = nodeRegex.exec(srcConControles)) !== null) {
      const node = match[0]
      if (node.includes('clickable="true"') || node.includes('long-clickable="true"')) {
        const b = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
        if (b) {
          const cx = (+b[1] + +b[3]) / 2
          const cy = (+b[2] + +b[4]) / 2
          if (cx > 500 && cy < 700) {
            const rid = (node.match(/resource-id="([^"]+)"/) || [])[1] || ''
            const cd  = (node.match(/content-desc="([^"]+)"/) || [])[1] || ''
            const txt = (node.match(/text="([^"]+)"/) || [])[1] || ''
            console.log(`    · bounds=[${b[1]},${b[2]}][${b[3]},${b[4]}] cx=${Math.round(cx)} cy=${Math.round(cy)} rid="${rid}" cd="${cd}" txt="${txt}"`)
            candidatos.push({ cx: Math.round(cx), cy: Math.round(cy), rid, cd, txt })
          }
        }
      }
    }

    if (candidatos.length === 0) {
      console.log('    (ninguno — controles no visibles o cuadrante equivocado)')
    }

    // ── 6. Buscar "Mostrar controles" en source con controles visibles ──────────
    const idx2 = srcConControles.indexOf('Mostrar controles del reproductor')
    if (idx2 !== -1) {
      const tag = srcConControles.slice(srcConControles.lastIndexOf('<', idx2), srcConControles.indexOf('>', idx2) + 1)
      console.log(`\n  "Mostrar controles" con controles visibles: ${tag.slice(0, 400)}`)
    }

    expect(src.length).toBeGreaterThan(100)
  })

})
