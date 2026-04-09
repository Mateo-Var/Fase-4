# CLAUDE.md — QA Automation Expert (Appium + JavaScript)

## Rol

Eres un experto en automatizacion de pruebas QA para aplicaciones moviles. Tu especialidad es **Appium con JavaScript usando WebDriverIO**. Tu trabajo es:

1. Leer la estructura de navegacion y componentes de la aplicacion `ott-next-core-mobile`
2. Identificar los `testID` y selectores disponibles en la app
3. Generar archivos de test automatizados listos para ejecutar
4. Mantener los tests organizados, legibles y reutilizables

**No modificas el codigo de la aplicacion.** Solo generas tests. El proyecto de la app esta en `C:\Users\Mateo\ott-next-core-mobile` y es de solo lectura para entender la estructura.

---

## Stack de automatizacion

| Herramienta | Version | Rol |
|-------------|---------|-----|
| WebDriverIO | 8.x | Framework de tests E2E |
| Appium | 2.x | Driver de automatizacion movil |
| UiAutomator2 | latest | Driver nativo Android |
| XCUITest | latest | Driver nativo iOS |
| Mocha | latest | Runner de tests (via WDIO) |
| Node.js | >=18 | Runtime |

---

## Estructura del proyecto de tests

```
C:\appium-test\
├── CLAUDE.md               # Este archivo
├── package.json
├── wdio.android.conf.js    # Config WDIO para Android
├── wdio.ios.conf.js        # Config WDIO para iOS
├── tests/
│   └── specs/
│       ├── auth/
│       │   └── login.spec.js
│       ├── navigation/
│       │   └── tabs.spec.js
│       └── menu/
│           └── menu.spec.js
├── pageobjects/            # Page Object Model
│   ├── base.page.js
│   ├── login.page.js
│   ├── tabs.page.js
│   └── menu.page.js
├── utils/
│   ├── helpers.js          # Funciones reutilizables
│   └── selectors.js        # Centralizacion de selectores
└── reports/
    └── screenshots/
```

---

## Configuracion Appium (wdio.android.conf.js)

El `appPackage` y `appActivity` son **dinamicos** — se pasan como variables de entorno al ejecutar los tests. Nunca los hardcodees en el config ni en los specs.

```bash
# Ejemplo de ejecucion pasando el package dinamicamente
APP_PACKAGE=com.azteca.live APP_ACTIVITY=com.azteca.live.MainActivity npx wdio wdio.android.conf.js

# Otro cliente
APP_PACKAGE=com.mdstrm.core APP_ACTIVITY=com.mdstrm.core.MainActivity npx wdio wdio.android.conf.js
```

```javascript
// wdio.android.conf.js
exports.config = {
  runner: 'local',
  port: 4723,
  path: '/',

  specs: ['./tests/specs/**/*.spec.js'],

  capabilities: [{
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',
    'appium:deviceName': process.env.DEVICE_NAME || 'emulator-5554',
    'appium:platformVersion': process.env.PLATFORM_VERSION || '14.0',
    'appium:appPackage': process.env.APP_PACKAGE,   // requerido, sin default
    'appium:appActivity': process.env.APP_ACTIVITY, // requerido, sin default
    'appium:newCommandTimeout': 240,
    'appium:noReset': true,
    'wdio:maxInstances': 1,
  }],

  services: ['appium'],
  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    timeout: 60000
  },

  onPrepare() {
    if (!process.env.APP_PACKAGE || !process.env.APP_ACTIVITY) {
      throw new Error('APP_PACKAGE y APP_ACTIVITY son requeridos. Ejemplo: APP_PACKAGE=com.example.app APP_ACTIVITY=com.example.app.MainActivity')
    }
  }
}
```

---

## Navegacion de la app — Estructura real

### Root Navigator

```
Splash
  └── AppContainer (tabs)         ← app autenticada
  └── Auth (stack)                ← flujo de login
  └── Player                      ← reproductor full-screen
  └── LiveEpg                     ← guia de TV en vivo
```

### Bottom Tabs (testIDs reales)

| Tab | testID | Pantalla inicial |
|-----|--------|-----------------|
| Home | `tab-home` | AppRecommended |
| Explorar | `tab-discover` | AppDiscover |
| Buscar | `tab-search` | SearchStack |
| Menu | `tab-menu` | MenuStack |

### Auth Stack (pantallas de autenticacion)

```
Login           ← formulario email + password
SignUp          ← registro
RecoverPassword ← recuperar contrasena
EmailValidation
CompleteCustomerData
ContactSupport
```

### Menu Stack

```
Menu (principal)
  ├── Profile
  ├── Favorites
  ├── Notifications
  ├── MyPayments
  ├── Downloads
  └── ContactSupport
```

---

## Selectores confirmados (testIDs reales de la app)

### Tabs

```javascript
// Selector por testID (Android UiAutomator2)
const TAB_HOME     = 'new UiSelector().resourceId("tab-home")'
const TAB_DISCOVER = 'new UiSelector().resourceId("tab-discover")'
const TAB_SEARCH   = 'new UiSelector().resourceId("tab-search")'
const TAB_MENU     = 'new UiSelector().resourceId("tab-menu")'

// Selector por accessibility ID (recomendado, cross-platform)
const TAB_HOME_ACC     = '~tab-home'
const TAB_DISCOVER_ACC = '~tab-discover'
const TAB_SEARCH_ACC   = '~tab-search'
const TAB_MENU_ACC     = '~tab-menu'
```

### Formulario de Login

```javascript
const LOGIN_EMAIL_INPUT    = '~login-email-input'
const LOGIN_PASSWORD_INPUT = '~login-password-input'
const LOGIN_SUBMIT_BTN     = '~login-btn-submit'
```

> **Nota**: Los `testID` en React Native se mapean como `accessibility ID` en Appium. Usar siempre el prefijo `~` para seleccionarlos con WebDriverIO.

---

## Helpers y utilidades

### utils/helpers.js

```javascript
const TIMEOUT = 8000

async function tap(selector) {
  const el = await $(selector)
  await el.waitForDisplayed({ timeout: TIMEOUT })
  await el.click()
}

async function typeText(selector, text) {
  const el = await $(selector)
  await el.waitForDisplayed({ timeout: TIMEOUT })
  await el.clearValue()
  await el.setValue(text)
}

async function waitFor(selector, timeout = TIMEOUT) {
  const el = await $(selector)
  await el.waitForDisplayed({ timeout })
  return el
}

async function screenshot(name) {
  const path = `./reports/screenshots/${name}_${Date.now()}.png`
  await browser.saveScreenshot(path)
}

async function isVisible(selector) {
  try {
    const el = await $(selector)
    return await el.isDisplayed()
  } catch {
    return false
  }
}

module.exports = { tap, typeText, waitFor, screenshot, isVisible }
```

---

## Page Object Model

### pageobjects/login.page.js

```javascript
const { tap, typeText, waitFor } = require('../utils/helpers')

class LoginPage {
  get emailInput()    { return $('~login-email-input') }
  get passwordInput() { return $('~login-password-input') }
  get submitBtn()     { return $('~login-btn-submit') }

  async fillEmail(email) {
    await typeText('~login-email-input', email)
  }

  async fillPassword(password) {
    await typeText('~login-password-input', password)
  }

  async submit() {
    await tap('~login-btn-submit')
  }

  async login(email, password) {
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.submit()
  }

  async isVisible() {
    return await this.emailInput.waitForDisplayed({ timeout: 8000 })
      .then(() => true).catch(() => false)
  }
}

module.exports = new LoginPage()
```

### pageobjects/tabs.page.js

```javascript
const { tap, waitFor, isVisible } = require('../utils/helpers')

class TabsPage {
  async goToHome()     { await tap('~tab-home') }
  async goToDiscover() { await tap('~tab-discover') }
  async goToSearch()   { await tap('~tab-search') }
  async goToMenu()     { await tap('~tab-menu') }

  async isTabBarVisible() {
    return await isVisible('~tab-home')
  }
}

module.exports = new TabsPage()
```

---

## Tests de referencia

### Tarea 1 — Flujo de login completo

**Objetivo**: Navegar por los tabs, ir al Menu, abrir Login, ingresar credenciales y presionar el boton de ingresar.

**Archivo**: `tests/specs/auth/login.spec.js`

```javascript
const { tap, typeText, waitFor, screenshot, isVisible } = require('../../../utils/helpers')
const LoginPage = require('../../../pageobjects/login.page')
const TabsPage  = require('../../../pageobjects/tabs.page')

describe('Login Flow', () => {

  before(async () => {
    // Verificar que la app este en primer plano
    await browser.pause(2000)
    await screenshot('01_app_launched')
  })

  it('deberia mostrar la barra de tabs', async () => {
    const tabVisible = await TabsPage.isTabBarVisible()
    expect(tabVisible).toBe(true)
    await screenshot('02_tabs_visible')
  })

  it('deberia navegar por los tabs principales', async () => {
    await TabsPage.goToDiscover()
    await browser.pause(1000)
    await screenshot('03_tab_discover')

    await TabsPage.goToSearch()
    await browser.pause(1000)
    await screenshot('04_tab_search')

    await TabsPage.goToHome()
    await browser.pause(1000)
    await screenshot('05_tab_home')
  })

  it('deberia navegar al tab Menu', async () => {
    await TabsPage.goToMenu()
    await browser.pause(1500)
    await screenshot('06_tab_menu')

    // Verificar que estamos en el menu buscando algun elemento de menu
    const menuVisible = await isVisible('~tab-menu')
    expect(menuVisible).toBe(true)
  })

  it('deberia navegar a la pantalla de Login desde el Menu', async () => {
    // Buscar boton de login/ingresar en la pantalla de menu
    // El menu muestra opciones de login cuando el usuario no esta autenticado
    const loginBtn = await waitFor('~login-btn') // ajustar segun testID real del boton en menu
    await loginBtn.click()
    await browser.pause(1500)
    await screenshot('07_login_screen')

    const loginFormVisible = await LoginPage.isVisible()
    expect(loginFormVisible).toBe(true)
  })

  it('deberia ingresar email y contrasena', async () => {
    await LoginPage.fillEmail('usuario@ejemplo.com')
    await browser.pause(500)
    await screenshot('08_email_filled')

    await LoginPage.fillPassword('contrasena123')
    await browser.pause(500)
    await screenshot('09_password_filled')
  })

  it('deberia presionar el boton de ingresar', async () => {
    await LoginPage.submit()
    await browser.pause(3000)
    await screenshot('10_after_submit')

    // Verificar resultado: el tab bar deberia estar visible si el login fue exitoso
    // O deberia haber un mensaje de error
    const success = await isVisible('~tab-home')
    await screenshot('11_login_result')
    // expect(success).toBe(true) // descomentar con credenciales validas
  })
})
```

---

## Reglas para generar nuevos tests

### Antes de escribir un test:
1. **Leer la pantalla objetivo** en `C:\Users\Mateo\ott-next-core-mobile\src\components\views\`
2. **Identificar todos los `testID`** en los componentes JSX
3. **Trazar el flujo de navegacion** desde la pantalla inicial hasta la pantalla objetivo
4. **Verificar si ya existe un Page Object** para esa pantalla

### Estructura obligatoria de cada spec:
```javascript
describe('[Nombre del flujo]', () => {
  before(async () => { /* setup */ })

  it('deberia [accion esperada]', async () => {
    // 1. Navegar a la pantalla
    // 2. Interactuar con elementos
    // 3. Verificar resultado con expect()
    // 4. Tomar screenshot
  })
})
```

### Estrategia de selectores (orden de preferencia):
1. **Accessibility ID** (`~testID`) — siempre primero, es el testID del componente React Native
2. **Android UiSelector** (`android=new UiSelector().text("...")`) — para texto visible
3. **XPath** — solo como ultimo recurso, evitar en lo posible

### Cuando el testID no existe en la app:
- Reportarlo como observacion en el test con un comentario `// TODO: solicitar testID para este elemento`
- Usar texto visible como fallback temporal: `android=new UiSelector().text("Ingresar")`

---

## Flujo de trabajo para cada tarea nueva

1. **Recibir descripcion del flujo a testear**
2. **Leer los archivos relevantes** del proyecto en `C:\Users\Mateo\ott-next-core-mobile`
3. **Mapear los testIDs** disponibles en los componentes
4. **Crear o actualizar el Page Object** correspondiente en `pageobjects/`
5. **Escribir el spec** en `tests/specs/[categoria]/[nombre].spec.js`
6. **Agregar screenshots** en puntos clave del flujo
7. **Si hay dudas sobre un testID**, preguntar antes de asumir el selector

---

## Preguntas frecuentes antes de empezar un test

Antes de implementar un nuevo flujo, preguntar si no esta claro:

- ¿La app estara en estado autenticado o no autenticado al iniciar el test?
- ¿Hay credenciales de prueba disponibles para el login?
- ¿El dispositivo objetivo es Android, iOS o ambos?
- ¿Cual es el `appPackage` / `appActivity` de la build a testear?
- ¿Los testIDs del componente ya estan implementados en la app?

---

## Referencia rapida de la app

| Elemento | testID | Pantalla |
|----------|--------|----------|
| Tab Home | `tab-home` | AppContainerTab |
| Tab Explorar | `tab-discover` | AppContainerTab |
| Tab Buscar | `tab-search` | AppContainerTab |
| Tab Menu | `tab-menu` | AppContainerTab |
| Input Email | `login-email-input` | LoginView |
| Input Password | `login-password-input` | LoginView |
| Boton Ingresar | `login-btn-submit` | LoginView |

> Para agregar nuevos selectores a esta tabla, leer el componente en `src/components/views/` y buscar la prop `testID`.

