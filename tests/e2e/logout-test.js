'use strict'

/**
 * Spec: Flujo de Logout
 *
 * Flujo:
 *   1. Asegura que la app esté abierta
 *   2. Hace login con credenciales válidas (si no hay sesión activa)
 *   3. Navega al tab de Menú y verifica el menú autenticado
 *   4. Tapea "CERRAR SESIÓN" via bounds del page source (ADB tap — nunca el.click())
 *   5. Verifica que se regresó a la pantalla de login
 *   6. Verifica que el menú autenticado ya NO está visible
 */

const {
  screenshot,
  tapMenuTab,
  pageContains,
  isAuthenticatedMenuVisible,
  hideKeyboard,
  tapSubmitButton,
} = require('../../utils/helpers')
const LoginPage = require('../../pageobjects/login.page')
const { execSync } = require('child_process')

const EMAIL    = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD

function getDevice() {
  return process.env.DEVICE_NAME || '192.168.1.193:5555'
}

async function tapLogout() {
  const logoutLabels = [
    'CERRAR SESIÓN', 'Cerrar sesión',
    'CERRAR SESION', 'Cerrar sesion',
    'LOGOUT', 'Logout',
    'SALIR', 'Salir',
  ]

  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    const src = await browser.getPageSource()

    for (const label of logoutLabels) {
      const idx = src.indexOf(label)
      if (idx === -1) continue

      const tagStart = src.lastIndexOf('<', idx)
      const tagEnd   = src.indexOf('>', idx)
      if (tagStart === -1 || tagEnd === -1) continue

      const tag = src.slice(tagStart, tagEnd + 1)
      const b   = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
      if (!b) continue

      const x = Math.round((+b[1] + +b[3]) / 2)
      const y = Math.round((+b[2] + +b[4]) / 2)
      console.log(`  [tapLogout] "${label}" encontrado → tap (${x}, ${y})`)
      execSync(`adb -s ${getDevice()} shell input tap ${x} ${y}`, { timeout: 5000 })
      return
    }

    console.log('  [tapLogout] botón de logout no encontrado aún, esperando...')
    await browser.pause(1500)
  }

  throw new Error('[tapLogout] No se encontró el botón de CERRAR SESIÓN en 15 segundos')
}

async function doLogin() {
  console.log('  [doLogin] Iniciando login...')
  await LoginPage.waitUntilVisible(30000)
  await LoginPage.fillEmail(EMAIL)
  await LoginPage.fillPassword(PASSWORD)
  await hideKeyboard()
  await browser.pause(800)
  await tapSubmitButton()
  await browser.pause(6000)
  console.log('  [doLogin] Login completado')
}

describe('Flujo de Logout', () => {

  before(async () => {
    if (!EMAIL || !PASSWORD) {
      throw new Error('TEST_EMAIL y TEST_PASSWORD son requeridos en el .env')
    }
  })

  it('deberia tener la app abierta', async () => {
    const appPackage = process.env.APP_PACKAGE
    let currentPkg = ''
    try {
      currentPkg = await browser.getCurrentPackage()
      console.log(`  Package activo: ${currentPkg}`)
    } catch (e) {
      console.log('  No se pudo leer el package activo')
    }

    if (currentPkg === appPackage) {
      console.log('  App ya está en primer plano')
    } else {
      console.log('  Lanzando app...')
      await browser.activateApp(appPackage)
      await browser.pause(2000)
      const pkgTrasActivar = await browser.getCurrentPackage()
      if (pkgTrasActivar !== appPackage) {
        await browser.execute('mobile: startActivity', {
          appPackage,
          appActivity: process.env.APP_ACTIVITY,
          wait: true,
        })
      }
      await browser.pause(6000)
    }
    await screenshot('01_app_abierta')
  })

  it('deberia estar autenticado antes de probar el logout', async () => {
    await screenshot('02_antes_de_verificar_sesion')
    await tapMenuTab()
    await browser.pause(2500)
    await screenshot('02_tab_menu_tapeado')

    const autenticado = await isAuthenticatedMenuVisible()

    if (autenticado) {
      console.log('  Sesión activa detectada — no es necesario hacer login')
      await screenshot('02_sesion_activa_confirmada')
    } else {
      console.log('  No hay sesión activa — iniciando login...')
      await screenshot('02_sin_sesion_haciendo_login')
      await browser.pause(2000)
      const enLogin = await LoginPage.isVisible()
      if (!enLogin) {
        throw new Error('[test #2] No se pudo llegar al login screen — revisar estado de la app')
      }
      await doLogin()
      await screenshot('02_login_completado')
      await tapMenuTab()
      await browser.pause(2500)
      await screenshot('02_menu_tras_login')
      const autenticadoTrasLogin = await isAuthenticatedMenuVisible()
      expect(autenticadoTrasLogin).toBe(true)
      console.log('  Login exitoso — menú autenticado visible')
    }
  })

  it('deberia mostrar el menu autenticado con la opcion de cerrar sesion', async () => {
    await tapMenuTab()
    await browser.pause(2000)
    await screenshot('03_menu_autenticado')

    const autenticado = await isAuthenticatedMenuVisible()
    expect(autenticado).toBe(true)

    const tieneCerrarSesion    = await pageContains('CERRAR SESIÓN')
    const tieneCerrarSesionAlt = await pageContains('CERRAR SESION')
    const tieneOpcionLogout    = tieneCerrarSesion || tieneCerrarSesionAlt
    console.log(`  CERRAR SESIÓN visible: ${tieneOpcionLogout}`)
    expect(tieneOpcionLogout).toBe(true)
    await screenshot('03_cerrar_sesion_visible')
  })

  it('deberia tapear CERRAR SESION via ADB bounds', async () => {
    await screenshot('04_antes_de_cerrar_sesion')
    console.log('  Tapeando CERRAR SESIÓN...')
    await tapLogout()
    await browser.pause(3000)
    await screenshot('04_despues_de_cerrar_sesion')
  })

  it('deberia redirigir a la pantalla de login tras el logout', async () => {
    await browser.pause(2000)
    await screenshot('05_esperando_pantalla_login')
    await LoginPage.waitUntilVisible(20000)
    await screenshot('05_pantalla_login_visible')
    const enLogin = await LoginPage.isVisible()
    expect(enLogin).toBe(true)
    console.log('  Pantalla de login visible tras logout — correcto')
  })

  it('deberia eliminar el menu autenticado tras el logout', async () => {
    // Tras el logout estamos en login screen — la navbar no existe todavía.
    // Verificamos directamente en el page source que no hay elementos autenticados.
    await browser.pause(1500)
    await screenshot('06_pantalla_tras_logout')
    const menuAuthVisible = await isAuthenticatedMenuVisible()
    expect(menuAuthVisible).toBe(false)
    console.log('  Menú autenticado ya no visible — logout correcto')
    const aunTieneLogout = await pageContains('CERRAR SESIÓN')
    expect(aunTieneLogout).toBe(false)
    console.log('  "CERRAR SESIÓN" ya no visible — estado limpio confirmado')
    await screenshot('06_logout_verificado')
  })

})
