---
name: "conventions"
description: "Coding conventions for this project: Spanish test names, selector priority, Page Object Model, env vars for credentials/package"
type: feedback
---

# Conventions

## Language: Spanish Test Names

All `describe()` and `it()` descriptions are written in **Spanish**. Examples from CLAUDE.md:

```javascript
describe('Login Flow', () => {
  it('deberia mostrar la barra de tabs', async () => { ... })
  it('deberia navegar por los tabs principales', async () => { ... })
  it('deberia navegar al tab Menu', async () => { ... })
  it('deberia navegar a la pantalla de Login desde el Menu', async () => { ... })
  it('deberia ingresar email y contrasena', async () => { ... })
  it('deberia presionar el boton de ingresar', async () => { ... })
})
```

Convention: `it('deberia [accion esperada]', ...)`

---

## Selector Priority (Order of Preference)

1. **Accessibility ID** — `~testID` — always first choice. Cross-platform, maps directly to React Native `testID` prop via `content-desc` on Android.
   ```javascript
   $('~login-email-input')
   $('~tab-menu')
   ```

2. **Android UiSelector by text** — for visible text when no testID exists:
   ```javascript
   $('android=new UiSelector().text("Ingresar")')
   $('android=new UiSelector().textContains("Ingresar")')
   ```

3. **Android UiSelector by resourceId** — for elements identified by resource-id:
   ```javascript
   $('android=new UiSelector().resourceIdMatches(".*:id/login-email-input")')
   ```

4. **XPath** — last resort only. Fragile, slow, avoid:
   ```javascript
   $('//*[@content-desc="login-btn-submit"]')
   ```

> The existing `login.test.js` uses XPath (`//*[@content-desc="..."]`). New code should prefer `~testID` (Accessibility ID).

---

## No Hardcoded Package Names or Credentials

### App Package / Activity

Always use environment variables:
```javascript
// CORRECT
'appium:appPackage': process.env.APP_PACKAGE,
'appium:appActivity': process.env.APP_ACTIVITY,

// WRONG — never do this
'appium:appPackage': 'com.azteca.live',
```

Invocation:
```bash
APP_PACKAGE=com.azteca.live APP_ACTIVITY=com.azteca.live.MainActivity npx wdio wdio.android.conf.js
```

### Credentials

Never hardcode credentials in committed test files. Use env vars:
```javascript
const EMAIL    = process.env.TEST_EMAIL
const PASSWORD = process.env.TEST_PASSWORD
```

> Note: The current `login.test.js` has hardcoded credentials (`mateovargas060203@gmail.com` / `Winner2025`). This is a known issue that should be fixed in new test files.

---

## Page Object Model

All tests use the Page Object Model pattern. Each screen has its own page object in `pageobjects/`:

```javascript
// pageobjects/login.page.js
class LoginPage {
  get emailInput()    { return $('~login-email-input') }
  get passwordInput() { return $('~login-password-input') }
  get submitBtn()     { return $('~login-btn-submit') }

  async fillEmail(email)       { ... }
  async fillPassword(password) { ... }
  async submit()               { ... }
  async login(email, password) { ... }
  async isVisible()            { ... }
}

module.exports = new LoginPage()  // Export singleton
```

Spec files import page objects:
```javascript
const LoginPage = require('../../../pageobjects/login.page')
const TabsPage  = require('../../../pageobjects/tabs.page')
```

---

## Spec File Structure

Every spec file follows this mandatory structure:

```javascript
const { tap, typeText, waitFor, screenshot, isVisible } = require('../../../utils/helpers')
const LoginPage = require('../../../pageobjects/login.page')

describe('[Nombre del flujo en español]', () => {

  before(async () => {
    await browser.pause(2000)
    await screenshot('00_setup')
  })

  it('deberia [accion esperada]', async () => {
    // 1. Navegar a la pantalla
    // 2. Interactuar con elementos
    // 3. Verificar resultado con expect()
    // 4. Tomar screenshot
  })
})
```

---

## Screenshot Convention

Screenshots are taken at every meaningful step. Naming: sequential prefix + descriptive name:

```javascript
await screenshot('01_app_launched')
await screenshot('02_tabs_visible')
await screenshot('03_tab_discover')
await screenshot('ERROR_login')    // For error states
```

Screenshots save to `./reports/screenshots/` with timestamp suffix added automatically.

---

## Helper Functions (Target `utils/helpers.js`)

The project's target helpers API (from CLAUDE.md):

```javascript
// WDIO Mocha runner style — browser is global
async function tap(selector)                  // find + waitForDisplayed + click
async function typeText(selector, text)        // find + waitForDisplayed + clearValue + setValue
async function waitFor(selector, timeout)      // find + waitForDisplayed + return element
async function screenshot(name)               // browser.saveScreenshot to reports/screenshots/
async function isVisible(selector)            // returns boolean — safe (no throw)
```

The existing `e2e/utils/helpers.js` (standalone runner style) takes `driver` as first param:
```javascript
// Standalone remote() style — driver is explicit
async function tap(driver, element)           // uses clickGesture with coordinates
async function screenshot(driver, name)       // saves to reports/screenshots/
async function waitForElement(driver, selector, timeout)
async function clearAndType(element, text)
async function byTestId(testID)               // returns UiSelector string
```

> When writing WDIO Mocha-based specs (the target architecture), use the `browser`-global style. When writing standalone scripts (like `login.test.js`), pass `driver` explicitly.

---

## Tap Strategy

In the existing code, tapping uses coordinates via `mobile: clickGesture` for reliability:

```javascript
async function tap(driver, element) {
  const loc  = await element.getLocation()
  const size = await element.getSize()
  const x    = Math.round(loc.x + size.width / 2)
  const y    = Math.round(loc.y + size.height / 2)
  await driver.executeScript('mobile: clickGesture', [{ x, y }])
}
```

This is preferred over `.click()` for React Native elements which can be unreliable with standard click.

---

## When a TestID Is Missing

If a testID is not found in the source:
1. Add a comment: `// TODO: solicitar testID para este elemento`
2. Use text-based fallback: `$('android=new UiSelector().text("Ingresar")')`
3. Never assume or invent a testID — always verify in source

---

## Device Config Convention

Device configuration is centralized in `utils/device.config.js`. Capabilities that vary by run (package, activity, device name, platform version) are passed via environment variables:

```javascript
// utils/device.config.js — stable settings only
module.exports = {
  android: {
    hostname: '127.0.0.1',
    port: 4723,
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': process.env.DEVICE_NAME || '192.168.1.187:5555',
      'appium:noReset': true,
      // appPackage and appActivity NEVER here
    }
  }
}
```

---

## File Naming Convention

| Type          | Pattern                                    | Example                           |
|---------------|--------------------------------------------|-----------------------------------|
| Spec files    | `[feature].spec.js` in `tests/specs/[area]/` | `tests/specs/auth/login.spec.js` |
| Page objects  | `[screen].page.js` in `pageobjects/`       | `pageobjects/login.page.js`       |
| Utils         | descriptive name in `utils/`               | `utils/helpers.js`                |
| Standalone E2E| `[feature].test.js` in `tests/e2e/`       | `tests/e2e/login.test.js`         |
