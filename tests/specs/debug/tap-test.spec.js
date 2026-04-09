'use strict'

/**
 * Test de diagnostico: encuentra ~Cuenta y prueba TODOS los metodos de tap
 * disponibles hasta que uno funcione.
 */

const { execSync } = require('child_process')
const { screenshot } = require('../../../utils/helpers')

const DEVICE = process.env.DEVICE_NAME || '192.168.1.187:5555'

describe('Diagnostico de tap — Cuenta tab', () => {

  it('deberia encontrar las coordenadas de ~Cuenta', async () => {
    await browser.pause(2000)
    const el = await $('~Cuenta')
    await el.waitForDisplayed({ timeout: 10000 })

    const loc  = await el.getLocation()
    const size = await el.getSize()
    const x    = Math.round(loc.x + size.width  / 2)
    const y    = Math.round(loc.y + size.height / 2)

    console.log(`  Coordenadas de ~Cuenta: x=${x}, y=${y}`)
    console.log(`  Location: x=${loc.x}, y=${loc.y}`)
    console.log(`  Size: w=${size.width}, h=${size.height}`)

    await screenshot('tap_00_antes')

    // ── Metodo 1: ADB directo via Node child_process ────────────────────────
    console.log('\n  [1] Intentando: ADB directo (child_process.execSync)')
    try {
      execSync(`adb -s ${DEVICE} shell input tap ${x} ${y}`, { timeout: 5000 })
      await browser.pause(2000)
      await screenshot('tap_01_adb_directo')
      const src1 = await browser.getPageSource()
      if (!src1.includes('Cuenta')) {
        console.log('  [1] EXITO — la pantalla cambio')
        return
      }
      console.log('  [1] Sin efecto — pantalla igual')
    } catch (e) {
      console.log('  [1] FALLO:', e.message.split('\n')[0])
    }

    // ── Metodo 2: mobile: shell via Appium (necesita adb_shell habilitado) ──
    console.log('  [2] Intentando: mobile: shell input tap')
    try {
      await browser.executeScript('mobile: shell', [{
        command: 'input',
        args: ['tap', String(x), String(y)]
      }])
      await browser.pause(2000)
      await screenshot('tap_02_mobile_shell')
      const src2 = await browser.getPageSource()
      if (!src2.includes('Cuenta')) {
        console.log('  [2] EXITO — la pantalla cambio')
        return
      }
      console.log('  [2] Sin efecto — pantalla igual')
    } catch (e) {
      console.log('  [2] FALLO:', e.message.split('\n')[0])
    }

    // ── Metodo 3: el.click() nativo ────────────────────────────────────────
    console.log('  [3] Intentando: el.click()')
    try {
      const el3 = await $('~Cuenta')
      await el3.click()
      await browser.pause(2000)
      await screenshot('tap_03_click')
      const src3 = await browser.getPageSource()
      if (!src3.includes('Cuenta')) {
        console.log('  [3] EXITO — la pantalla cambio')
        return
      }
      console.log('  [3] Sin efecto — pantalla igual')
    } catch (e) {
      console.log('  [3] FALLO:', e.message.split('\n')[0])
    }

    // ── Metodo 4: mobile: clickGesture con elementId ────────────────────────
    console.log('  [4] Intentando: mobile: clickGesture con elementId')
    try {
      const el4 = await $('~Cuenta')
      await browser.executeScript('mobile: clickGesture', [{ elementId: el4.elementId }])
      await browser.pause(2000)
      await screenshot('tap_04_clickGesture_elem')
      const src4 = await browser.getPageSource()
      if (!src4.includes('Cuenta')) {
        console.log('  [4] EXITO')
        return
      }
      console.log('  [4] Sin efecto')
    } catch (e) {
      console.log('  [4] FALLO:', e.message.split('\n')[0])
    }

    // ── Metodo 5: W3C pointer actions ───────────────────────────────────────
    console.log('  [5] Intentando: W3C pointer actions')
    try {
      await browser.action('pointer', { parameters: { pointerType: 'touch' } })
        .move({ x, y })
        .down()
        .pause(100)
        .up()
        .perform()
      await browser.pause(2000)
      await screenshot('tap_05_w3c')
      const src5 = await browser.getPageSource()
      if (!src5.includes('Cuenta')) {
        console.log('  [5] EXITO')
        return
      }
      console.log('  [5] Sin efecto')
    } catch (e) {
      console.log('  [5] FALLO:', e.message.split('\n')[0])
    }

    // ── Metodo 6: touchAction (legado WDIO) ─────────────────────────────────
    console.log('  [6] Intentando: browser.touchAction tap')
    try {
      await browser.touchAction({ action: 'tap', x, y })
      await browser.pause(2000)
      await screenshot('tap_06_touchAction')
      const src6 = await browser.getPageSource()
      if (!src6.includes('Cuenta')) {
        console.log('  [6] EXITO')
        return
      }
      console.log('  [6] Sin efecto')
    } catch (e) {
      console.log('  [6] FALLO:', e.message.split('\n')[0])
    }

    await screenshot('tap_final_sin_exito')
    console.log('\n  NINGUNO funcionó — revisar logs de Appium')
  })
})
