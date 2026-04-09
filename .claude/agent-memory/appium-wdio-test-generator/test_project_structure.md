---
name: "test_project_structure"
description: "Current state of C:\\appium-test\\ — what files exist, what still needs to be created"
type: project
---

# Test Project Structure

Root: `C:\appium-test\`

## Current File Tree (as of 2026-04-07)

```
C:\appium-test\
├── CLAUDE.md                          # Agent instructions (read-only reference)
├── package.json                       # npm config — wdio ^9.27.0, mocha framework, spec reporter, jest
├── package-lock.json
├── wdio.android.conf.js               # ✅ WDIO config (Mocha, UiAutomator2, env vars)
├── smoke.test.js                      # Root-level smoke: connects to device, closes session
├── ui.xml                             # Dumped UI hierarchy (Appium XML snapshot, large file)
├── node_modules/                      # Installed dependencies
├── coverage/                          # Jest coverage output
├── reports/
│   └── screenshots/                   # PNG screenshots from test runs
├── utils/
│   ├── device.config.js               # Appium connection config (device IP, port, capabilities)
│   ├── helpers.js                     # ✅ WDIO Mocha helpers: tap, typeText, waitFor, screenshot, isVisible
│   └── selectors.js                   # ✅ All confirmed testIDs organized by screen
├── pageobjects/
│   ├── login.page.js                  # ✅ Login Page Object (fillEmail, fillPassword, submit, login)
│   └── tabs.page.js                   # ✅ Bottom Tab Bar Page Object (goToMenu, goToHome, isVisible)
├── tests/
│   ├── unit/
│   │   └── example.test.js            # Placeholder unit test (Jest)
│   ├── e2e/
│   │   ├── runner.js                  # Basic e2e runner (smoke: connects, gets package, closes)
│   │   ├── login.test.js              # Standalone e2e test (remote() style, NOT WDIO Mocha)
│   │   └── e2e/
│   │       └── screens/              # Empty directory
│   └── specs/
│       └── auth/
│           └── login.spec.js          # ✅ Complete login spec (WDIO Mocha, env vars, POM)
└── .claude/
    ├── agents/
    │   └── appium-wdio-test-generator.md  # This agent's definition
    └── agent-memory/
        └── appium-wdio-test-generator/    # Memory files
```

---

## What Currently Exists

### `utils/device.config.js`
Exports an `android` config object for `webdriverio.remote()`. Key settings:
- `hostname: '127.0.0.1'`, `port: 4723`
- `deviceName: '192.168.1.187:5555'` (physical device over TCP/ADB)
- `noReset: true`, `skipDeviceInitialization: true`, `ignoreHiddenApiPolicyError: true`
- **No appPackage/appActivity** — must be passed per-test

### `tests/e2e/login.test.js`
Full standalone e2e test (NOT using WDIO framework, uses `remote()` directly):
- Hard-coded credentials: `mateovargas060203@gmail.com` / `Winner2025`
- Hard-coded package: `com.azteca.live` / `com.azteca.live.MainActivity`
- Steps: open app → tap tab-menu → fill login form → submit → verify
- Selector strategy: XPath (`//*[@content-desc="..."]`, `//android.widget.EditText[@content-desc="..."]`)
- Takes screenshots at each step to `reports/screenshots/`

### `tests/e2e/runner.js`
Minimal runner: connects to device, calls `getCurrentPackage()`, closes session.

### `smoke.test.js`
Standalone WebDriverIO script. Connects to device with raw capabilities (no package), disconnects.

### `tests/unit/example.test.js`
Placeholder Jest test with two trivial assertions.

---

## What Is Missing (per CLAUDE.md expected structure)

| Missing File/Dir                          | Status       | Notes                                      |
|------------------------------------------|--------------|--------------------------------------------|
| `wdio.android.conf.js`                    | ✅ DONE       | Created 2026-04-07                         |
| `wdio.ios.conf.js`                        | not started  | iOS not yet in scope                       |
| `tests/specs/auth/login.spec.js`          | ✅ DONE       | Created 2026-04-07                         |
| `tests/specs/navigation/tabs.spec.js`     | not started  |                                            |
| `tests/specs/menu/menu.spec.js`           | not started  |                                            |
| `pageobjects/base.page.js`                | not started  | Not yet needed — login.page doesn't extend |
| `pageobjects/login.page.js`               | ✅ DONE       | Created 2026-04-07                         |
| `pageobjects/tabs.page.js`                | ✅ DONE       | Created 2026-04-07                         |
| `pageobjects/menu.page.js`                | not started  | Menu items have no testID — text selectors needed |
| `utils/helpers.js`                        | ✅ DONE       | Created 2026-04-07                         |
| `utils/selectors.js`                      | ✅ DONE       | Created 2026-04-07                         |

---

## npm Scripts

```json
{
  "test:unit": "jest tests/unit --coverage",
  "test:e2e": "node tests/e2e/runner.js",
  "test": "npm run test:unit && npm run test:e2e"
}
```

> `test:e2e` runs only `runner.js` (the smoke runner), NOT `login.test.js`. To run the login test: `node tests/e2e/login.test.js`

---

## Device Configuration

- **Current device**: Physical Android device at `192.168.1.187:5555` (ADB over TCP/IP)
- **Appium server**: `localhost:4723` (Appium v2, path `/`)
- **App tested**: `com.azteca.live` (Azteca Live)
- **App activity**: `com.azteca.live.MainActivity`

---

## Dependencies Installed

```json
{
  "dependencies": {
    "@wdio/cli": "^9.27.0",
    "webdriverio": "^9.27.0"
  },
  "devDependencies": {
    "jest": "^29.7.0"
  }
}
```

> WDIO 9.x is installed. The CLAUDE.md describes WDIO 8.x — use v9 patterns. Note: in WDIO v9, some APIs may differ slightly.

---

## Past Test Runs (Evidence from Screenshots)

Screenshots in `reports/screenshots/` show multiple runs:
- `01_app_open_*.png` — App open state captured successfully
- `02_tab_menu_*.png` — Menu tab navigation worked
- `ERROR_login_*.png` — Login failed in multiple runs (credentials, selector, or timing issues)
- `01_estado_inicial_*.png` — Some earlier test naming convention

The login test has failed multiple times (ERROR screenshots). This may indicate:
- Login form not visible after tapping Menu tab (app may show different UI when authenticated)
- Credential issues
- Selector not finding elements
