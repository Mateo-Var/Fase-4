module.exports = {
  android: {
    hostname: '127.0.0.1',
    port: 4723,
    connectionRetryTimeout: 120000,
    capabilities: {
      platformName: 'Android',
      'appium:automationName': 'UiAutomator2',
      'appium:deviceName': '192.168.1.187:5555',
      'appium:noReset': true,
      'appium:skipDeviceInitialization': true,
      'appium:ignoreHiddenApiPolicyError': true,
    }
  }
}