'use strict'

/**
 * Helpers para tests E2E con WebdriverIO + Mocha (Appium Android)
 *
 * Estrategia (inspirada en runner.js):
 *   1. Detección de pantalla/estado via getPageSource() — busca texto en el XML
 *   2. Interacción con elementos por texto visible (UiSelector().text / textContains)
 *   3. Tap real via ADB con coordenadas dinámicas del elemento (bypass GestureController MIUI)
 */

const fs   = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'reports', 'screenshots')

// ─── getDevice ───────────────────────────────────────────────────────────────
function getDevice() {
  return process.env.DEVICE_NAME || '192.168.1.193:5555'
}

// ─── pageContains ─────────────────────────────────────────────────────────────
/**
 * Retorna true si el texto aparece en el árbol de UI actual (page source XML).
 * Mucho más rápido que buscar elementos uno a uno.
 *
 * @param {string} text
 */
async function pageContains(text) {
  try {
    const src = await browser.getPageSource()
    return src.includes(text)
  } catch (_) { return false }
}

// ─── tapElement ──────────────────────────────────────────────────────────────
/**
 * Tapa un elemento WDIO usando coordenadas dinámicas vía UiAutomator2 + ADB.
 * Bypasea GestureController (falla silenciosamente en MIUI).
 *
 * @param {WebdriverIO.Element} el
 */
async function tapElement(el) {
  const loc  = await el.getLocation()
  const size = await el.getSize()
  const x    = Math.round(loc.x + size.width  / 2)
  const y    = Math.round(loc.y + size.height / 2)
  execSync(`adb -s ${getDevice()} shell input tap ${x} ${y}`, { timeout: 5000 })
}

// ─── tapByText ────────────────────────────────────────────────────────────────
/**
 * Encuentra un elemento por texto exacto visible y lo tapea.
 *
 * @param {string} text     - Texto exacto del elemento
 * @param {number} [timeout=10000]
 */
async function tapByText(text, timeout = 10000) {
  const el = await $(`android=new UiSelector().text("${text}")`)
  await el.waitForDisplayed({ timeout })
  await tapElement(el)
}

// ─── tapByTextContains ────────────────────────────────────────────────────────
/**
 * Encuentra un elemento por texto parcial y lo tapea.
 *
 * @param {string} partial  - Substring del texto del elemento
 * @param {number} [timeout=10000]
 */
async function tapByTextContains(partial, timeout = 10000) {
  const el = await $(`android=new UiSelector().textContains("${partial}")`)
  await el.waitForDisplayed({ timeout })
  await tapElement(el)
}

// ─── tap ─────────────────────────────────────────────────────────────────────
/**
 * Encuentra un elemento por selector y lo tapea.
 *
 * @param {string} selector
 * @param {number} [timeout=15000]
 */
async function tap(selector, timeout = 15000) {
  const el = await $(selector)
  await el.waitForDisplayed({ timeout })
  await tapElement(el)
}

// ─── tapMenuTab ───────────────────────────────────────────────────────────────
/**
 * Tapea el tab de Menú/Cuenta del navbar inferior.
 *
 * Estrategia:
 *   1. resource-id ".*:id/tab-menu" (tabBarTestID en AppContainerTab.js — consistente en todos los clientes)
 *   2. Fallback: busca por texto visible en page source (labels comunes del tab de menú)
 */
async function tapMenuTab() {
  // Busca el tab en el page source y tapea via ADB (sin llamar getLocation/getSize).
  const menuLabels = ['Cuenta', 'Menú', 'Menu', 'Mi perfil', 'Perfil', 'Profile', 'More']
  const deadline = Date.now() + 30000

  while (Date.now() < deadline) {
    try {
      const src = await browser.getPageSource()

      for (const label of menuLabels) {
        // Buscar content-desc="label" o text="label" en el XML
        // sin importar el orden de atributos en el tag
        for (const attr of [`content-desc="${label}"`, `text="${label}"`]) {
          const attrIdx = src.indexOf(attr)
          if (attrIdx === -1) continue

          // Extraer el tag completo que contiene este atributo
          const tagStart = src.lastIndexOf('<', attrIdx)
          const tagEnd   = src.indexOf('>', attrIdx)
          if (tagStart === -1 || tagEnd === -1) continue
          const tag = src.slice(tagStart, tagEnd + 1)

          // Extraer bounds del mismo tag
          const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
          if (!b) continue

          const x = Math.round((+b[1] + +b[3]) / 2)
          const y = Math.round((+b[2] + +b[4]) / 2)
          console.log(`  [tapMenuTab] "${label}" encontrado via ${attr.split('=')[0]} → tap (${x}, ${y})`)
          execSync(`adb -s ${getDevice()} shell input tap ${x} ${y}`, { timeout: 5000 })
          return
        }
      }
    } catch (_) {}

    console.log('  [tapMenuTab] navbar aún no visible, esperando...')
    await browser.pause(2000)
  }

  throw new Error('[tapMenuTab] No se encontró el tab de Menú/Cuenta después de 30s')
}

// ─── tapSubmitButton ─────────────────────────────────────────────────────────
/**
 * Tapea el botón de submit del formulario activo sin conocer su label/testID.
 *
 * Estrategia (page source, inspirada en runner.js):
 *   1. Lee el XML via getPageSource()
 *   2. Ubica el último EditText (fin de los campos del formulario)
 *   3. Después de él, busca el primer nodo con clickable="true" y enabled="true" con texto
 *   4. Tapea ese elemento por su texto visible
 *   5. Reintenta hasta 3s para dar tiempo a Formik/validación
 */
async function tapSubmitButton() {
  // Mismo patrón que tapMenuTab: buscar el texto del botón en page source,
  // extraer bounds del tag y tapear via ADB. Sin llamar getLocation/getSize.
  const submitLabels = ['INGRESAR', 'Ingresar', 'LOGIN', 'Login', 'ENTRAR', 'Entrar',
                        'ACCEDER', 'Acceder', 'CONTINUAR', 'Continuar', 'SIGN IN', 'SUBMIT']

  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const src = await browser.getPageSource()

      for (const label of submitLabels) {
        for (const attr of [`text="${label}"`, `content-desc="${label}"`]) {
          const attrIdx = src.indexOf(attr)
          if (attrIdx === -1) continue

          const tagStart = src.lastIndexOf('<', attrIdx)
          const tagEnd   = src.indexOf('>', attrIdx)
          if (tagStart === -1 || tagEnd === -1) continue
          const tag = src.slice(tagStart, tagEnd + 1)

          // Solo si el botón está habilitado
          if (!tag.includes('enabled="true"')) continue

          const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
          if (!b) continue

          const x = Math.round((+b[1] + +b[3]) / 2)
          const y = Math.round((+b[2] + +b[4]) / 2)
          console.log(`  [tapSubmitButton] "${label}" encontrado → tap (${x}, ${y})`)
          execSync(`adb -s ${getDevice()} shell input tap ${x} ${y}`, { timeout: 5000 })
          return
        }
      }
    } catch (e) {
      console.log(`  [tapSubmitButton] intento ${attempt + 1}: ${e.message?.split('\n')[0]}`)
    }

    console.log(`  [tapSubmitButton] esperando que Formik habilite el botón (${attempt + 1}/6)...`)
    await new Promise(r => setTimeout(r, 500))
  }

  throw new Error('[tapSubmitButton] No se encontró botón de submit habilitado')
}

// ─── tapPasswordToggle ───────────────────────────────────────────────────────
/**
 * Tapea el botón mostrar/ocultar contraseña (ícono ojo).
 *
 * No tiene text, content-desc ni resource-id — se localiza como el
 * ViewGroup clickable que está en el mismo rango Y que el EditText
 * con password="true" (inmediatamente a su derecha).
 */
async function tapPasswordToggle() {
  const src = await browser.getPageSource()

  // Encontrar el campo de contraseña: siempre es el ÚLTIMO EditText visible.
  // No depender de password="true"/"false" porque cambia al toggelar y puede matchear mal.
  const editTextRegex = /(<android\.widget\.EditText[^>]+>)/g
  const allEditTexts = [...src.matchAll(editTextRegex)]
  if (allEditTexts.length === 0) throw new Error('[tapPasswordToggle] No se encontraron EditText en pantalla')

  const pwdTag = allEditTexts[allEditTexts.length - 1][0]  // último EditText = password field
  const pwdTagEnd = src.indexOf(pwdTag) + pwdTag.length - 1
  const pwdB = pwdTag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
  if (!pwdB) throw new Error('[tapPasswordToggle] No se encontraron bounds del campo de contraseña')

  const pwdY1 = +pwdB[2]
  const pwdY2 = +pwdB[4]

  // Buscar el primer ViewGroup clickable+enabled que venga después del EditText
  // y esté dentro del mismo rango Y (es el ojo, a la derecha del input)
  const afterPwd = src.slice(pwdTagEnd + 1)
  let idx = 0
  while (idx < afterPwd.length) {
    const tagStart = afterPwd.indexOf('<', idx)
    if (tagStart === -1) break
    const tagEnd = afterPwd.indexOf('>', tagStart)
    if (tagEnd === -1) break

    const tag = afterPwd.slice(tagStart, tagEnd + 1)
    idx = tagEnd + 1

    if (!tag.includes('clickable="true"')) continue
    if (!tag.includes('enabled="true"'))  continue

    const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (!b) continue

    // Verificar que está en el mismo rango Y que el campo de contraseña
    if (+b[2] >= pwdY1 && +b[4] <= pwdY2 + 10) {
      const x = Math.round((+b[1] + +b[3]) / 2)
      const y = Math.round((+b[2] + +b[4]) / 2)
      console.log(`  [tapPasswordToggle] ojo encontrado bounds [${b[1]},${b[2]}][${b[3]},${b[4]}] → tap (${x}, ${y})`)
      execSync(`adb -s ${getDevice()} shell input tap ${x} ${y}`, { timeout: 5000 })
      return
    }
  }

  throw new Error('[tapPasswordToggle] No se encontró el botón mostrar/ocultar contraseña')
}

// ─── typeText ─────────────────────────────────────────────────────────────────
async function typeText(selector, text, timeout = 15000) {
  const el = await $(selector)
  await el.waitForDisplayed({ timeout })
  await el.clearValue()
  await el.setValue(text)
  return el
}

// ─── waitFor ──────────────────────────────────────────────────────────────────
async function waitFor(selector, timeout = 15000) {
  const el = await $(selector)
  await el.waitForDisplayed({ timeout })
  return el
}

// ─── waitForText ──────────────────────────────────────────────────────────────
/**
 * Espera hasta que el texto aparezca en el page source (como runner.js).
 *
 * @param {string} text
 * @param {number} [timeoutMs=15000]
 * @param {number} [intervalMs=1000]
 */
async function waitForText(text, timeoutMs = 15000, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await pageContains(text)) return true
    await browser.pause(intervalMs)
  }
  throw new Error(`[waitForText] "${text}" no apareció en ${timeoutMs}ms`)
}

// ─── screenshot ───────────────────────────────────────────────────────────────
async function screenshot(name) {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
  }
  const filePath = path.join(SCREENSHOTS_DIR, `${name}_${Date.now()}.png`)
  try {
    await browser.saveScreenshot(filePath)
  } catch {
    try {
      const dev = getDevice()
      execSync(`adb -s ${dev} shell screencap /sdcard/sc.png`, { timeout: 5000 })
      execSync(`adb -s ${dev} pull /sdcard/sc.png "${filePath}"`, { timeout: 5000 })
    } catch (e2) {
      console.log(`  [screenshot] SKIP: ${e2.message.split('\n')[0]}`)
      return filePath
    }
  }
  console.log(`  [screenshot] ${path.basename(filePath)}`)
  return filePath
}

// ─── isVisible ────────────────────────────────────────────────────────────────
async function isVisible(selector) {
  try {
    const el = await $(selector)
    return await el.isDisplayed()
  } catch {
    return false
  }
}

// ─── hideKeyboard ─────────────────────────────────────────────────────────────
async function hideKeyboard() {
  try {
    await browser.hideKeyboard()
  } catch { /* ya estaba oculto */ }
}

// ─── waitForErrorMessage ─────────────────────────────────────────────────────
/**
 * Espera hasta que aparezca un mensaje de error en pantalla.
 * Busca keywords comunes de error en el page source.
 *
 * @param {number} [timeoutMs=10000]
 * @returns {string} El texto de error encontrado
 */
async function waitForErrorMessage(timeoutMs = 10000) {
  const errorKeywords = [
    // Banner de error de TV Azteca (respuesta del servidor)
    'customer_bad_request', 'bad_request',
    'unauthorized', 'Unauthorized', 'UNAUTHORIZED',
    'forbidden', 'Forbidden',
    // Variantes comunes de error de autenticación en español
    'incorrecto', 'incorrecta', 'Incorrecto', 'Incorrecta',
    'inválido', 'invalido', 'Inválido', 'Invalido',
    'inválida', 'invalida', 'Inválida', 'Invalida',
    'no válido', 'no valido',
    'Usuario o contraseña', 'usuario o contraseña',
    'credenciales', 'Credenciales',
    'credencial', 'Credencial',
    'autenticación', 'autenticacion', 'Autenticación',
    'no encontrado', 'No encontrado',
    'no existe', 'No existe',
    'acceso denegado', 'Acceso denegado',
    'intenta de nuevo', 'intente de nuevo', 'Intente',
    'fallido', 'falló', 'Falló',
    'no coincide', 'No coincide',
    'verifique', 'Verifique', 'verifica', 'Verifica',
    // Variantes en inglés
    'invalid', 'Invalid', 'incorrect', 'Incorrect',
    'wrong', 'Wrong', 'not found', 'Not found',
    // Genérico
    'Error', 'error', 'ERROR',
  ]

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const src = await browser.getPageSource()
      for (const kw of errorKeywords) {
        if (src.includes(kw)) {
          // Extraer el texto completo del nodo que contiene el error
          const kwIdx = src.indexOf(kw)
          const tagStart = src.lastIndexOf('<', kwIdx)
          const tagEnd   = src.indexOf('>', kwIdx)
          const tag = src.slice(tagStart, tagEnd + 1)
          const textMatch = tag.match(/\btext="([^"]+)"/)
          const errorText = textMatch ? textMatch[1] : kw
          console.log(`  [waitForErrorMessage] error detectado: "${errorText}"`)
          return errorText
        }
      }
    } catch (_) {}
    await browser.pause(1000)
  }

  throw new Error('[waitForErrorMessage] No apareció mensaje de error en pantalla')
}

// ─── isAuthenticatedMenuVisible ──────────────────────────────────────────────
/**
 * Verifica si el menú del usuario autenticado está en pantalla.
 * Busca los 4 elementos clave del menú post-login de TV Azteca.
 * Si están presentes → el usuario está logueado.
 *
 * Selectores estables: texto visible en page source (no dependen de testID ni posición).
 */
async function isAuthenticatedMenuVisible() {
  try {
    const src = await browser.getPageSource()
    const menuItems = ['FAVORITOS', 'NOTIFICACIONES', 'MI CUENTA', 'CERRAR SESIÓN']
    const found = menuItems.filter(item => src.includes(item))
    if (found.length > 0) {
      console.log(`  [isAuthenticatedMenuVisible] elementos encontrados: ${found.join(', ')}`)
    }
    // Considera autenticado si al menos 2 de los 4 elementos clave están presentes
    return found.length >= 2
  } catch (_) { return false }
}

// ─── ensureAppInForeground ───────────────────────────────────────────────────
/**
 * Verifica que la app objetivo esté en primer plano y la relanza si no lo está.
 *
 * Estrategia:
 *   1. Obtiene el package activo via browser.getCurrentPackage()
 *   2. Compara contra APP_PACKAGE (process.env)
 *   3. Si no coincide: intenta activateApp(), fallback a ADB am start
 *   4. Espera 2s tras el relanzamiento para que la app cargue
 *
 * Defensivo: loguea y continúa — nunca rompe el test.
 *
 * @returns {boolean} true si la app estaba o quedó en primer plano, false si no se pudo verificar
 */
async function ensureAppInForeground() {
  const pkg = process.env.APP_PACKAGE
  if (!pkg) {
    console.log('  [ensureAppInForeground] APP_PACKAGE no definido — skip')
    return false
  }

  try {
    const currentPkg = await browser.getCurrentPackage()
    if (currentPkg === pkg) {
      console.log(`  [ensureAppInForeground] app en primer plano: ${currentPkg}`)
      return true
    }

    console.log(`  [ensureAppInForeground] paquete activo: "${currentPkg}" — esperado: "${pkg}" — relanzando...`)

    // Intento 1: API de Appium (más limpia, preserva estado si noReset=true)
    try {
      await driver.activateApp(pkg)
      await browser.pause(2000)
      const afterActivate = await browser.getCurrentPackage()
      if (afterActivate === pkg) {
        console.log(`  [ensureAppInForeground] app relanzada via activateApp`)
        return true
      }
    } catch (activateErr) {
      console.log(`  [ensureAppInForeground] activateApp falló: ${activateErr.message?.split('\n')[0]} — intentando ADB`)
    }

    // Intento 2: ADB am start (fallback para MIUI donde activateApp puede fallar)
    const activity = process.env.APP_ACTIVITY
    if (activity) {
      execSync(`adb -s ${getDevice()} shell am start -n ${pkg}/${activity}`, { timeout: 10000 })
      await browser.pause(2000)
      console.log(`  [ensureAppInForeground] app relanzada via ADB am start`)
      return true
    }

    console.log('  [ensureAppInForeground] APP_ACTIVITY no definido — no se puede usar ADB fallback')
    return false
  } catch (err) {
    console.log(`  [ensureAppInForeground] error al verificar/relanzar app: ${err.message?.split('\n')[0]} — continuando`)
    return false
  }
}

// ─── dismissPromoPopupIfVisible ──────────────────────────────────────────────
/**
 * Cierra el popup publicitario in-app si está visible, tapeando "OMITIR".
 *
 * Regla de negocio: SIEMPRE omitir — nunca tapear "ABRIR".
 * Defensivo: no lanza error si el popup no aparece.
 *
 * @returns {boolean} true si el popup fue encontrado y cerrado, false si no estaba presente
 */
async function dismissPromoPopupIfVisible() {
  try {
    const src = await browser.getPageSource()
    if (!src.includes('OMITIR')) return false

    // Extraer bounds del tag que contiene "OMITIR"
    const idx = src.indexOf('OMITIR')
    const tagStart = src.lastIndexOf('<', idx)
    const tagEnd   = src.indexOf('>', idx)
    if (tagStart === -1 || tagEnd === -1) return false

    const tag = src.slice(tagStart, tagEnd + 1)
    const b   = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/)
    if (!b) return false

    const x = Math.round((+b[1] + +b[3]) / 2)
    const y = Math.round((+b[2] + +b[4]) / 2)
    console.log(`  [dismissPromoPopup] popup publicitario detectado → tap OMITIR (${x}, ${y})`)
    execSync(`adb -s ${getDevice()} shell input tap ${x} ${y}`, { timeout: 5000 })
    await browser.pause(500)
    return true
  } catch (_) { return false }
}

// ─── waitForEnabled ───────────────────────────────────────────────────────────
async function waitForEnabled(selector, timeout = 10000) {
  const el = await $(selector)
  await el.waitForEnabled({ timeout })
  return el
}

module.exports = {
  tap,
  tapByText,
  tapByTextContains,
  tapMenuTab,
  tapSubmitButton,
  tapPasswordToggle,
  ensureAppInForeground,
  dismissPromoPopupIfVisible,
  waitForErrorMessage,
  isAuthenticatedMenuVisible,
  pageContains,
  waitForText,
  typeText,
  waitFor,
  screenshot,
  isVisible,
  hideKeyboard,
  waitForEnabled,
}
