'use strict'

/**
 * Page Object — Bottom Tab Bar
 *
 * Encapsula la barra de tabs inferior presente en AppContainer.
 * Fuente: src/core/Navigation/Navigators/AppContainerTab.js
 *
 * TestIDs confirmados (tabBarTestID):
 *   tab-home, tab-discover, tab-search, tab-menu
 *
 * NOTA: tab-discover y tab-search son condicionales según la configuración
 * del cliente (hasDiscoverContent, hasSearch). No asumir que existen.
 */

const { tap, waitFor, isVisible, screenshot } = require('../utils/helpers')
const { TABS } = require('../utils/selectors')

class TabsPage {

  // ─── Getters (lazy — se evalúan en el momento del acceso) ──────────────────

  get homeTab()     { return $(TABS.home)     }
  get discoverTab() { return $(TABS.discover) }
  get searchTab()   { return $(TABS.search)   }
  get menuTab()     { return $(TABS.menu)     }

  // ─── Navegación ────────────────────────────────────────────────────────────

  /**
   * Navega al tab Home tapeando su botón en la barra inferior.
   */
  async goToHome() {
    await tap(TABS.home)
    await browser.pause(1500)
  }

  /**
   * Navega al tab Menu tapeando su botón en la barra inferior.
   * Si el usuario no está autenticado y la app tiene hasAuth=true,
   * ViewMenu hará un Redirect automático a la pantalla de Login.
   */
  async goToMenu() {
    await tap(TABS.menu)
    await browser.pause(1500)
  }

  /**
   * Navega al tab Discover (si existe para este cliente).
   */
  async goToDiscover() {
    await tap(TABS.discover)
    await browser.pause(1500)
  }

  /**
   * Navega al tab Search (si existe para este cliente).
   */
  async goToSearch() {
    await tap(TABS.search)
    await browser.pause(1500)
  }

  // ─── Verificaciones ────────────────────────────────────────────────────────

  /**
   * Verifica que la barra de tabs sea visible comprobando el tab Home,
   * que siempre está presente.
   * @returns {Promise<boolean>}
   */
  async isVisible() {
    return isVisible(TABS.home)
  }

  /**
   * Espera a que la barra de tabs sea visible (útil después de login).
   * @param {number} [timeout=15000]
   */
  async waitUntilVisible(timeout = 15000) {
    await waitFor(TABS.home, timeout)
  }

  /**
   * Espera a que el tab Menu esté visible.
   * @param {number} [timeout=15000]
   */
  async waitUntilMenuTabVisible(timeout = 15000) {
    await waitFor(TABS.menu, timeout)
  }
}

module.exports = new TabsPage()
