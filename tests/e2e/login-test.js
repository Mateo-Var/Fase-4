'use strict'

/**
 * Spec: Flujo de Login
 *
 * Detección de pantallas via getPageSource() (texto visible) — patrón runner.js.
 * Interacción por texto visible, sin hardcodear posiciones, testIDs ni labels fijos.
 */

const { screenshot, tapMenuTab, pageContains, waitForText, waitForErrorMessage, tapSubmitButton, tapPasswordToggle, hideKeyboard, isAuthenticatedMenuVisible } = require('../../utils/helpers')
const LoginPage = require('../../pageobjects/login.page')

const EMAIL    = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD

// ─── Helper: asegura estar en la pantalla de login ───────────────────────────
// Si no estamos en login, va via tab Cuenta. Usado en tests de credenciales
// para recuperarse si un test anterior terminó en otra pantalla.
async function navigateToLogin() {
  const onLogin = await LoginPage.isVisible()
  if (onLogin) return

  console.log('  [navigateToLogin] No estamos en login — tapeando tab Cuenta...')
  await tapMenuTab()
  await browser.pause(2000)
  await screenshot('recovery_tab_cuenta')

  // Si estamos autenticados (menú visible), hacer logout primero
  const autenticado = await isAuthenticatedMenuVisible()
  if (autenticado) {
    console.log('  [navigateToLogin] Sesión activa detectada — cerrando sesión...')
    // Buscar y tapear CERRAR SESIÓN en el page source
    const src = await browser.getPageSource()
    const logoutLabels = ['CERRAR SESIÓN', 'Cerrar sesión', 'CERRAR SESION', 'Cerrar sesion', 'LOGOUT', 'Logout', 'SALIR', 'Salir']
    let logoutTapped = false
    for (const label of logoutLabels) {
      const idx = src.indexOf(label)
      if (idx === -1) continue
      const tagStart = src.lastIndexOf('<', idx)
      const tagEnd   = src.indexOf('>', idx)
      if (tagStart === -1 || tagEnd === -1) continue
      const tag = src.slice(tagStart, tagEnd + 1)
      const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
      if (!b) continue
      const x = Math.round((+b[1] + +b[3]) / 2)
      const y = Math.round((+b[2] + +b[4]) / 2)
      const { execSync } = require('child_process')
      execSync(`adb -s ${process.env.DEVICE_NAME || '192.168.1.193:5555'} shell input tap ${x} ${y}`, { timeout: 5000 })
      console.log(`  [navigateToLogin] "${label}" tapeado → tap (${x}, ${y})`)
      logoutTapped = true
      break
    }
    if (!logoutTapped) throw new Error('[navigateToLogin] No se encontró botón de logout')
    await browser.pause(3000)
    await screenshot('recovery_tras_logout')
  }

  try {
    await LoginPage.waitUntilVisible(20000)
    console.log('  [navigateToLogin] Login screen encontrado')
  } catch (_) {
    throw new Error('[navigateToLogin] No se pudo llegar al login screen — revisar estado de la app')
  }
}

// ─── Helper: valida pantalla tras submit con credenciales incorrectas ─────────
// Retorna true si la alerta de error apareció correctamente en el login screen.
// Si la app dejó ingresar (no está en login), loguea el fallo y lanza error.
async function validarRechazoCredenciales(label, screenshotPrefix) {
  const enLogin = await LoginPage.isVisible()

  if (!enLogin) {
    console.log(`  ⚠ [${label}] Login screen ya no visible — verificando autenticación...`)
    await tapMenuTab()
    await browser.pause(2000)
    const autenticado = await isAuthenticatedMenuVisible()
    await screenshot(`${screenshotPrefix}_seguridad_check`)

    if (autenticado) {
      throw new Error(
        `FALLO DE SEGURIDAD [${label}]: la app permitió acceso con credenciales incorrectas.\n` +
        `Menú autenticado visible: FAVORITOS, MI CUENTA, CERRAR SESIÓN.\n` +
        `→ Revisar validación en el servidor.`
      )
    } else {
      throw new Error(
        `FALLO [${label}]: login screen desapareció pero no se identificó menú autenticado.\n` +
        `→ Revisar screenshot ${screenshotPrefix}_seguridad_check.`
      )
    }
  }

  // Estamos en login — esperar alerta de error del servidor
  // Variantes conocidas: "customer_bad_request", "invalid" — agregar más en helpers.js
  const errorMsg = await waitForErrorMessage(8000)
  console.log(`  ✓ [${label}] Alerta de error detectada: "${errorMsg}"`)
  await screenshot(`${screenshotPrefix}_alerta_visible`)
  return errorMsg
}

describe('Flujo de Login', () => {

  before(async () => {
    if (!EMAIL || !PASSWORD) {
      throw new Error('TEST_EMAIL y TEST_PASSWORD son requeridos en el .env')
    }
  })

  // ─── 1. Verificar que la app esté abierta ───────────────────────────────────

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
          wait: true
        })
      }

      await browser.pause(6000)
    }

    await screenshot('01_app_abierta')
  })

  // ─── 2. Tapear el tab de Menú ───────────────────────────────────────────────

  it('deberia hacer click en el tab de Menu de la navbar', async () => {
    await screenshot('02_antes_de_click_menu')

    console.log('  Tapeando tab de Menu...')
    await tapMenuTab()

    await browser.pause(1500)
    await screenshot('02_despues_de_click_menu')
  })

  // ─── 3. Esperar pantalla de login ───────────────────────────────────────────

  it('deberia mostrar la pantalla de login', async () => {
    await browser.pause(1500)
    await screenshot('03_esperando_login')

    await LoginPage.waitUntilVisible(45000)
    await screenshot('03_login_visible')

    const visible = await LoginPage.isVisible()
    expect(visible).toBe(true)
  })

  // ─── 4. Login fallido — email inválido ─────────────────────────────────────

  it('deberia mostrar error con email invalido', async () => {
    // Asegurar que estamos en login (por si algún test anterior terminó en otra pantalla)
    await navigateToLogin()

    console.log('  Ingresando email inválido...')
    await LoginPage.fillEmail('mateovargas060203@g')
    await LoginPage.fillPassword(PASSWORD)

    await tapPasswordToggle()
    await browser.pause(1500)
    await screenshot('04a_credenciales_email_invalido')

    await hideKeyboard()
    await browser.pause(800)

    await tapSubmitButton()
    await browser.pause(3000)
    await screenshot('04a_resultado_email_invalido')

    await validarRechazoCredenciales('email inválido', '04a')
  })

  // ─── 5. Login fallido — contraseña incorrecta ──────────────────────────────

  it('deberia mostrar error con contrasena incorrecta', async () => {
    // Navegar a login por si el test anterior terminó en otra pantalla (ej. fallo de seguridad)
    await navigateToLogin()

    console.log('  Ingresando contraseña incorrecta...')
    await LoginPage.fillEmail(EMAIL)
    await LoginPage.fillPassword('Winnn213')

    await tapPasswordToggle()
    await browser.pause(1500)
    await screenshot('05a_credenciales_password_incorrecto')

    await hideKeyboard()
    await browser.pause(800)

    await tapSubmitButton()
    await browser.pause(4000)
    await screenshot('05a_resultado_password_incorrecto')

    await validarRechazoCredenciales('contraseña incorrecta', '05a')
  })

  // ─── 6. Ingresar credenciales correctas ────────────────────────────────────

  it('deberia ingresar email y contrasena correctos', async () => {
    // Navegar a login por si los tests negativos terminaron en otra pantalla
    await navigateToLogin()

    await LoginPage.fillEmail(EMAIL)
    await screenshot('06_email_ingresado')

    await LoginPage.fillPassword(PASSWORD)
    await screenshot('06_password_ingresado')
  })

  // ─── 7. Submit con ojo + ingresar ──────────────────────────────────────────

  it('deberia presionar el boton de ingresar y autenticarse', async () => {
    await screenshot('07_antes_de_submit')

    await LoginPage.submit()
    await screenshot('07_submit_presionado')

    await browser.pause(5000)
    await screenshot('07_resultado_login')
  })

})
