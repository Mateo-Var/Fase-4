---
name: "navigation_paths"
description: "Verified navigation paths from app launch to each main screen"
type: reference
---

# Navigation Paths

## App Launch State

The app always launches to the `Splash` screen, then transitions to either:
- `AppContainer` (bottom tabs) — if the user session is active (`noReset: true` on Appium)
- `Auth` stack (Login screen) — if no session exists

With `appium:noReset: true` (current config), the app resumes from its last state.

---

## Path: App Launch → Login Screen

### Scenario A: App starts on AppContainer (user was logged out, tabs visible)

```
Splash → AppContainer (tabs visible)
  → tap ~tab-menu
    → Menu screen (unauthenticated state)
      → tap login button (testID TBD — investigate Menu screen component)
        → Auth stack → Login screen
          Elements: ~login-email-input, ~login-password-input, ~login-btn-submit
```

### Scenario B: App starts directly on Auth/Login (fresh install or logged out)

```
Splash → Auth stack → Login screen
  Elements: ~login-email-input, ~login-password-input, ~login-btn-submit
```

### Scenario C: App was on Login screen (noReset preserves state)

```
App resumes → Login screen already visible
  Elements: ~login-email-input, ~login-password-input, ~login-btn-submit
```

---

## Path: Login → Home (post-authentication)

```
Login screen
  → fill ~login-email-input
  → fill ~login-password-input
  → tap ~login-btn-submit (must be enabled — no validation errors)
  → [API call — wait up to 5-10 seconds]
  → AppContainer (tabs visible)
    → ~tab-home is visible = login success
```

### Login Error Paths

| Error Code                             | Navigation Target              |
|----------------------------------------|-------------------------------|
| `FEDERATION_EMAIL_REQUIRES_VALIDATION` | `Auth > EmailValidation`       |
| `CUSTOMER_PASSWORD_NOT_FOUND`          | `Auth > RecoverPassword`       |
| `CUSTOMER_COMPLETE_DATA_IS_REQUIRED`   | `Auth > CompleteCustomerData`  |
| Other errors                           | Toast shown, stays on Login    |

---

## Path: AppContainer → Bottom Tabs

All tabs are accessible from the bottom tab bar. Tap by testID:

```
AppContainer visible
  → tap ~tab-home     → AppRecommended (Home content)
  → tap ~tab-discover → AppDiscover (Explore content)  [may not exist in all clients]
  → tap ~tab-search   → SearchStack (Search screen)    [may not exist in all clients]
  → tap ~tab-menu     → MenuStack → Menu screen
```

---

## Path: Tab Menu → Menu Sub-screens

```
tap ~tab-menu
  → Menu screen (main)
    → tap Profile item    → Profile screen
    → tap Favorites item  → Favorites screen
    → tap Notifications   → Notifications screen
    → tap MyPayments      → MyPayments screen
    → tap Downloads       → Downloads screen
    → tap ContactSupport  → ContactSupport screen
    → tap AccountDelete   → AccountDelete screen
```

> testIDs for Menu items are NOT yet confirmed. Read `src/components/views/Menu/` before implementing.

---

## Path: AppContainer → Player

Player is accessed from content (not a tab). Launched from `AppContainer` via deep link or content tap:

```
[any tab with content]
  → tap content item
    → Details screen (within MenuStack or content stack)
      → tap play button
        → Player (full-screen, root stack)
```

---

## Path: Auth → SignUp

```
Login screen
  → tap "Sign up" button (FormButton with title `%login_btn_sign_up%`)
    → navigate('Auth', { screen: 'SignUp' })
      → SignUp screen
```

---

## Path: Auth → RecoverPassword

```
Login screen
  → tap FormLink component (recover password link)
    → RecoverPassword screen
```

---

## Navigation Helpers in Source

The app's own e2e utils (`e2e/utils/helpers.js`) provide these selector helpers (for reference):

```javascript
byTestId(testID)    // android=new UiSelector().resourceIdMatches(".*:id/${testID}")
byLabel(label)      // ~${label}  — same as Accessibility ID
byText(text)        // android=new UiSelector().text("${text}")
byTextContains(text)// android=new UiSelector().textContains("${text}")
```

## Important Timing Notes

- App launch/splash: wait at least 2-3 seconds
- Tab navigation: 1-2 second pause after tap
- Post-login API response: wait 3-5 seconds (up to 8s timeout for element visibility)
- Keyboard dismiss: call `driver.hideKeyboard()` after filling text inputs
- Login button: use `waitForEnabled` before tapping (disabled when form has errors)
