'use strict'

/**
 * Debug: captura el XML del player con controles visibles
 * usando adb tap + uiautomator dump inmediato (sin Appium overhead)
 */

const { execSync } = require('child_process')

function getDevice() {
  return process.env.DEVICE_NAME || '192.168.1.175:5555'
}

function adb(cmd, timeout = 8000) {
  try { return execSync(`adb -s ${getDevice()} ${cmd}`, { timeout }).toString() } catch (_) { return '' }
}

// Tap + dump inmediato — todo por adb, sin pasar por Appium
function tapYDump(x, y, pauseMs = 300) {
  adb(`shell input tap ${x} ${y}`)
  // Pausa mínima para que aparezcan los controles
  execSync(`ping -n 1 -w ${pauseMs} 127.0.0.1 > nul 2>&1 || sleep ${pauseMs / 1000}`, { timeout: 2000, shell: true })
  adb('shell uiautomator dump /data/local/tmp/uidump.xml')
  return adb('shell cat /data/local/tmp/uidump.xml')
}

function scrollDown() {
  adb('shell input swipe 540 1700 540 900 300')
}

function scrollToTop() {
  for (let i = 0; i < 6; i++) adb('shell input swipe 540 300 540 1900 100')
}

describe('DEBUG — Player controls XML', () => {

  it('deberia capturar el XML del player con controles visibles', async () => {
    // Ir al home y encontrar Programación
    adb('shell input tap 135 2222')
    await browser.pause(1500)
    scrollToTop()
    await browser.pause(400)

    let src = ''
    for (let i = 0; i < 10; i++) {
      src = await browser.getPageSource()
      if (src.includes('text="Programación"') || src.includes('"Programación"')) break
      scrollDown()
      await browser.pause(100)
    }

    // Detectar bounds del player
    const idx = src.indexOf('Mostrar controles del reproductor')
    let playerBounds = null
    if (idx !== -1) {
      const tag = src.slice(src.lastIndexOf('<', idx), src.indexOf('>', idx) + 1)
      const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
      if (b) playerBounds = { x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4] }
    }

    if (!playerBounds) throw new Error('No se detectaron bounds del player')

    const cx = Math.round((playerBounds.x1 + playerBounds.x2) / 2)
    const cy = Math.round((playerBounds.y1 + playerBounds.y2) / 2)
    console.log(`\n  Player bounds: [${playerBounds.x1},${playerBounds.y1}][${playerBounds.x2},${playerBounds.y2}]`)
    console.log(`  Tapeando centro del player → (${cx}, ${cy})`)

    // Probar con distintos delays para encontrar la ventana óptima
    for (const delay of [200, 400, 600, 800]) {
      const dump = tapYDump(cx, cy, delay)

      if (!dump || dump.length < 100) {
        console.log(`  [delay ${delay}ms] dump vacío`)
        continue
      }

      // Extraer todos los elementos en el área del header del player
      // Header: y1 a y1+50 del player
      const headerY1 = playerBounds.y1
      const headerY2 = playerBounds.y1 + 60

      const allNodes = [...dump.matchAll(/<node[^>]+>/g)]
      const headerNodes = allNodes.filter(m => {
        const b = m[0].match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
        if (!b) return false
        const cy2 = (+b[2] + +b[4]) / 2
        return cy2 >= headerY1 && cy2 <= headerY2
      })

      console.log(`\n  [delay ${delay}ms] Nodos en el header del player (Y=${headerY1}-${headerY2}):`)
      if (headerNodes.length === 0) {
        console.log('    (ninguno — controles aún no visibles o ya ocultos)')
      } else {
        headerNodes.forEach(m => {
          const cls     = (m[0].match(/class="([^"]+)"/)        || [])[1] || ''
          const rid     = (m[0].match(/resource-id="([^"]+)"/)  || [])[1] || ''
          const cd      = (m[0].match(/content-desc="([^"]+)"/) || [])[1] || ''
          const txt     = (m[0].match(/text="([^"]+)"/)         || [])[1] || ''
          const bounds  = (m[0].match(/bounds="([^"]+)"/)       || [])[1] || ''
          const click   = (m[0].match(/clickable="([^"]+)"/)    || [])[1] || ''
          console.log(`    · class=${cls.split('.').pop()} rid="${rid}" cd="${cd}" txt="${txt}" click=${click} bounds=${bounds}`)
        })
      }

      await browser.pause(1500)  // dejar que controles se oculten antes del próximo intento
    }

    expect(true).toBe(true)
  })

})
