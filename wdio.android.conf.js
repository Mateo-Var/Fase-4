'use strict'

require('dotenv').config()

/**
 * WebdriverIO configuration for Android (Appium UiAutomator2)
 *
 * Required env vars:
 *   APP_PACKAGE   — e.g. com.azteca.live
 *   APP_ACTIVITY  — e.g. com.azteca.live.MainActivity
 *   DEVICE_NAME   — e.g. 192.168.1.187:5555  (default applied below)
 *
 * Optional env vars:
 *   TEST_EMAIL    — credentials for login spec
 *   TEST_PASSWORD — credentials for login spec
 *
 * Usage:
 *   APP_PACKAGE=com.azteca.live \
 *   APP_ACTIVITY=com.azteca.live.MainActivity \
 *   TEST_EMAIL=user@example.com \
 *   TEST_PASSWORD=secret \
 *   npx wdio wdio.android.conf.js
 */

exports.config = {
  // ─── Appium server ──────────────────────────────────────────────────────────
  hostname: '127.0.0.1',
  port: 4723,
  path: '/',

  // ─── Runner ─────────────────────────────────────────────────────────────────
  runner: 'local',

  // ─── Specs ──────────────────────────────────────────────────────────────────
  specs: [
    [
      './tests/e2e/login-test.js',
      './tests/e2e/home-navegacion-test.js',
      './tests/e2e/hero_EPG-test.js',
      './tests/e2e/navegacion_vod-test.js',
    ]
  ],
  exclude: [],

  // ─── Capabilities ───────────────────────────────────────────────────────────
  maxInstances: 1,
  capabilities: [{
    platformName: 'Android',
    'appium:automationName': 'UiAutomator2',

    // Device: physical Android over ADB/TCP. Override with DEVICE_NAME env var.
    'appium:deviceName': process.env.DEVICE_NAME || '192.168.1.187:5555',

    // App — MUST be provided via env vars; no hardcoded values.
    'appium:appPackage':  process.env.APP_PACKAGE,
    'appium:appActivity': process.env.APP_ACTIVITY,

    // Session behaviour
    'appium:noReset':                              true,
    'appium:autoLaunch':                           true,
    'appium:newCommandTimeout':                    120,
    'appium:adbExecTimeout':                       60000,
    // MIUI (Xiaomi): evita instalar APKs que MIUI bloquea por permisos
    'appium:skipDeviceInitialization':             true,
    'appium:ignoreHiddenApiPolicyError':           true,
    // Reinstalar el servidor UiAutomator2 si ya está instalado para evitar crash
    'appium:skipServerInstallation':               false,
    'appium:uiautomator2ServerInstallTimeout':     90000,
    'appium:uiautomator2ServerLaunchTimeout':      90000,
    // Mantener la sesion activa — MIUI mata procesos en background
    'appium:disableWindowAnimation':               false,
  }],

  // ─── Framework ──────────────────────────────────────────────────────────────
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 600000,  // 10 min per test — navegación dinámica puede tardar
  },

  // ─── Reporters ──────────────────────────────────────────────────────────────
  reporters: [
    'spec',
    ['junit', {
      outputDir:       './reports/junit/',
      outputFileFormat: (options) => `results-${options.cid}.xml`
    }],
    ['allure', {
      outputDir:        './reports/allure-results/',
      disableWebdriverStepsReporting: true,
      disableWebdriverScreenshotsReporting: false,
    }]
  ],

  // ─── Services ───────────────────────────────────────────────────────────────
  // NOTE: Do NOT include 'appium' service here — assumes Appium server is
  // already running externally (npx appium). Add '@wdio/appium-service' to
  // package.json and uncomment if you want WDIO to manage it.
  services: [],

  // ─── Hooks ──────────────────────────────────────────────────────────────────
  before: async function () {
    // Ensure reports directory exists
    const fs   = require('fs')
    const path = require('path')
    const dirs = [
      path.join(__dirname, 'reports', 'screenshots'),
      path.join(__dirname, 'reports', 'junit'),
      path.join(__dirname, 'reports', 'allure-results'),
    ]
    dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) })

    // Reset de estado: si la app quedó en video player u otra pantalla, volver al home
    const { execSync } = require('child_process')
    const device = process.env.DEVICE_NAME || '192.168.1.175:5555'
    const adb = (cmd) => { try { execSync(`adb -s ${device} ${cmd}`, { timeout: 5000 }) } catch (_) {} }

    // Presionar BACK varias veces para salir de cualquier pantalla fullscreen
    for (let i = 0; i < 3; i++) adb('shell input keyevent 4')
    await browser.pause(1000)
    // Tap en el tab Inicio (coordenada fija del nav bar)
    adb('shell input tap 135 2222')
    await browser.pause(1500)
    console.log('  [before] ✓ estado de pantalla reseteado al home')
  },

  afterTest: async function (test, context, { error }) {
    // Adjuntar screenshot a Allure solo cuando falla un test
    if (error) {
      try {
        const AllureReporter = require('@wdio/allure-reporter').default
        const screenshot = await browser.takeScreenshot()
        AllureReporter.addAttachment('Screenshot (fallo)', Buffer.from(screenshot, 'base64'), 'image/png')
      } catch (_) {}
    }
  },

  onPrepare: async function () {
    if (!process.env.APP_PACKAGE) {
      console.warn('[WARN] APP_PACKAGE env var is not set')
    }
    if (!process.env.APP_ACTIVITY) {
      console.warn('[WARN] APP_ACTIVITY env var is not set')
    }

    // Verificar que la app esté instalada antes de lanzar la sesión
    const { execSync } = require('child_process')
    const pkg    = process.env.APP_PACKAGE
    const device = process.env.DEVICE_NAME || '192.168.1.193:5555'

    if (pkg) {
      try {
        const installed = execSync(`adb -s ${device} shell pm list packages ${pkg}`, { timeout: 10000 }).toString()
        if (installed.includes(pkg)) {
          console.log(`[onPrepare] App ${pkg} encontrada en el dispositivo`)
        } else {
          console.warn(`[onPrepare] App ${pkg} NO encontrada en el dispositivo`)
        }
      } catch (e) {
        console.warn(`[onPrepare] No se pudo verificar la app: ${e.message.split('\n')[0]}`)
      }
    }
  },

  // ─── Log level ──────────────────────────────────────────────────────────────
  logLevel: 'warn',
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
}
