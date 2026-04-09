'use strict'

/**
 * Catálogo centralizado de selectores para los tests E2E (Android)
 *
 * React Native 0.74 en Android:
 *   testID prop → resource-id = "{appPackage}:id/{testID}"
 *   NO mapea a content-desc (que es lo que usa ~selector)
 *
 * Por eso usamos resourceIdMatches con wildcard de package:
 *   android=new UiSelector().resourceIdMatches(".*:id/testID")
 *
 * Esto es agnóstico al APP_PACKAGE y funciona con cualquier cliente.
 *
 * Fuente de los testIDs:
 *   - Tabs:  src/core/Navigation/Navigators/AppContainerTab.js (tabBarTestID)
 *   - Login: src/components/views/Auth/LoginView/FormSignInSection.js
 */

const byId = (id) => `android=new UiSelector().resourceIdMatches(".*:id/${id}")`

// ─── Bottom Tab Bar ───────────────────────────────────────────────────────────
// Fuente: AppContainerTab.js — tabBarTestID pasado a NavigationTabBar → TabBarButtonComponent
// tab-discover y tab-search son condicionales según configuración del cliente.

// testID definidos en AppContainerTab.js → resource-id en Android
// Son consistentes en todos los clientes/idiomas, a diferencia de content-desc
// que varía según la traducción (nav_menu puede ser "Menú", "Menu", "Cuenta", etc.)
const TABS = {
  home:     byId('tab-home'),
  discover: byId('tab-discover'),
  search:   byId('tab-search'),
  menu:     byId('tab-menu'),   // siempre es tab-menu independiente del idioma
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
// Detectado via page source dump en dispositivo real.
// Los TextInput NO tienen content-desc — se usan por clase + instancia.
// El botón submit tiene content-desc="INGRESAR".

// Selectores genéricos para la pantalla de login — no asumen testID ni label.
// EditText por índice de clase: funciona en cualquier app Android/React Native.
// El submit se maneja via tapSubmitButton() en helpers.js (onSubmitEditing + detección dinámica).
const LOGIN = {
  emailInput:    'android=new UiSelector().className("android.widget.EditText").instance(0)',
  passwordInput: 'android=new UiSelector().className("android.widget.EditText").instance(1)',
}

// ─── Menu Screen ─────────────────────────────────────────────────────────────
// MenuItem NO tiene testID — los items se identifican por texto visible.

const MENU = {
  itemTexts: {
    favorites:      'android=new UiSelector().textContains("avorit")',
    notifications:  'android=new UiSelector().textContains("otificac")',
    downloads:      'android=new UiSelector().textContains("escarga")',
    purchases:      'android=new UiSelector().textContains("ompra")',
    profile:        'android=new UiSelector().textContains("erfil")',
    contactSupport: 'android=new UiSelector().textContains("oporte")',
    logout:         'android=new UiSelector().textContains("alir")',
  }
}

module.exports = { TABS, LOGIN, MENU }
