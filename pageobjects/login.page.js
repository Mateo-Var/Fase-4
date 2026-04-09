'use strict'

/**
 * Page Object — Login Screen
 *
 * Implementación black-box: no asume testIDs ni labels específicos del proyecto.
 *
 * Detecta elementos por clase nativa de Android:
 *   - Campos de texto → android.widget.EditText (primero=email, segundo=password)
 *   - Botón submit    → onSubmitEditing en el último campo, o primer elemento
 *                       clickable debajo de los inputs
 *
 * Detecta login visible cuando hay al menos 2 EditText en pantalla.
 */

const { typeText, waitFor, isVisible, hideKeyboard, tapSubmitButton, tapPasswordToggle, screenshot } = require('../utils/helpers')
const { LOGIN } = require('../utils/selectors')

class LoginPage {

  // ─── Verificaciones ────────────────────────────────────────────────────────

  /**
   * Retorna true si la pantalla de login está visible (hay inputs de texto).
   */
  async isVisible() {
    return isVisible(LOGIN.emailInput)
  }

  /**
   * Espera a que la pantalla de login esté visible.
   * Espera por el primer EditText (email input).
   * @param {number} [timeout=15000]
   */
  async waitUntilVisible(timeout = 15000) {
    await waitFor(LOGIN.emailInput, timeout)
  }

  // ─── Acciones ──────────────────────────────────────────────────────────────

  /**
   * Escribe el email en el primer campo de texto.
   */
  async fillEmail(email) {
    await typeText(LOGIN.emailInput, email)
  }

  /**
   * Escribe la contraseña en el segundo campo de texto.
   */
  async fillPassword(password) {
    await typeText(LOGIN.passwordInput, password)
  }

  /**
   * Presiona el botón de submit.
   *
   * Estrategia black-box (sin conocer el label del botón):
   *   1. onSubmitEditing: agrega '\n' al campo de password
   *      → React Native dispara el submit del formulario
   *   2. Si no funciona: detecta el primer elemento clickable bajo los inputs
   *   3. Fallback posicional: tap en zona típica de botones
   */
  async submit() {
    await hideKeyboard()
    await browser.pause(800)
    await tapSubmitButton()
  }

  /**
   * Flujo completo de login: email → password → submit.
   */
  async login(email, password) {
    await this.waitUntilVisible()
    await screenshot('login_01_pantalla_visible')

    await this.fillEmail(email)
    await screenshot('login_02_email_ingresado')

    await this.fillPassword(password)
    await screenshot('login_03_password_ingresado')

    await this.submit()
    await screenshot('login_04_submit_presionado')
  }
}

module.exports = new LoginPage()
