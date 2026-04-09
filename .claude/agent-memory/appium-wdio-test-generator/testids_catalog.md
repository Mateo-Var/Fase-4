---
name: "testids_catalog"
description: "All confirmed testIDs found in the app source code, organized by screen"
type: reference
---

# TestIDs Catalog

All testIDs below are confirmed directly from app source code. In React Native, `testID` maps to:
- **Android**: `content-desc` attribute (XPath: `//*[@content-desc="testID"]`)
- **Appium WebDriverIO**: use `~testID` (Accessibility ID selector) or UiSelector by resourceIdMatches

## Selector Patterns

```javascript
// Preferred: Accessibility ID (cross-platform, works on Android via content-desc)
$('~testID')

// Android-specific: UiSelector by resourceId (used in app's own e2e utils)
`android=new UiSelector().resourceIdMatches(".*:id/${testID}")`

// XPath fallback (used in current login.test.js)
`//*[@content-desc="${testID}"]`
`//android.widget.EditText[@content-desc="${testID}"]`
`//android.widget.FrameLayout[@content-desc="${testID}"]`
```

---

## Bottom Tab Bar — `AppContainerTab.js`

Source: `src/core/Navigation/Navigators/AppContainerTab.js`
Applied via: `tabBarTestID` option on each `Tab.Screen`

| Element        | testID         | Selector              |
|---------------|----------------|-----------------------|
| Tab Home       | `tab-home`     | `~tab-home`           |
| Tab Explorar   | `tab-discover` | `~tab-discover`       |
| Tab Buscar     | `tab-search`   | `~tab-search`         |
| Tab Menu       | `tab-menu`     | `~tab-menu`           |

> Note: Tabs are conditionally rendered. `tab-discover` requires `hasDiscoverContent=true`. `tab-search` requires `hasSearch=true`. Verify per client before asserting existence.

---

## Login Screen — `FormSignInSection.js`

Source: `src/components/views/Auth/LoginView/FormSignInSection.js`
Screen name in navigator: `Login` (inside `Auth` stack)

| Element               | testID                 | Component     | Selector                    |
|----------------------|------------------------|---------------|-----------------------------|
| Email input           | `login-email-input`    | `FormInput`   | `~login-email-input`        |
| Password input        | `login-password-input` | `FormInput`   | `~login-password-input`     |
| Submit button         | `login-btn-submit`     | `FormButton`  | `~login-btn-submit`         |

> The submit button is **disabled** when form has validation errors. Wait for `waitForEnabled` before tapping.

> Elements without confirmed testIDs (not found in source — use text-based selectors as fallback):
> - "Remember me" checkbox (`FormInputCheckBox`) — no testID found
> - "Recover password" link (`FormLink`) — no testID found
> - "Sign up" button (second `FormButton`) — no testID found

---

## Menu Screen (ViewMenu) — Investigated 2026-04-07

Source: `src/components/views/ViewMenu/ViewMenu.js`
        `src/components/views/ViewMenu/components/MenuItem/MenuItem.js`
        `src/components/views/ViewMenu/constants/menuItems.js`

IMPORTANT FINDINGS:
- **MenuItem has NO testID prop** — menu items cannot be selected by testID
- Items are identified only by their translated title text (runtime translation)
- The app directory is `ViewMenu` (NOT `Menu`) — different from what was assumed

Authentication behavior in ViewMenu:
| Condition             | Behavior                                              |
|-----------------------|-------------------------------------------------------|
| `hasAuth=false`       | Shows `NoAuthMenu` — only ContactSupport item visible |
| `hasAuth=true, isAuth=false` | `Redirect reset` → Auth stack → Login screen  |
| `hasAuth=true, isAuth=true`  | Full authenticated menu with all items         |

For the login flow: tapping `~tab-menu` when the user is NOT authenticated (and hasAuth=true)
automatically redirects to the Login screen. NO "Ingresar" button needed.

| Element               | testID     | Notes                                     |
|----------------------|------------|-------------------------------------------|
| Any menu item         | NONE       | Use text: `android=new UiSelector().textContains(...)` |
| Logout button         | NONE       | `MenuItem` with translated `%btn_logout%` |

NO_AUTH_ROUTES: Only items with `requiresAuth=false` → only `ContactSupport`.

## Screens Without Confirmed TestIDs (need investigation)

The following screens exist in navigators but their component testIDs have NOT been read yet:

| Screen           | Stack      | Source path to check                                    |
|-----------------|------------|---------------------------------------------------------|
| Menu (main)      | MenuStack  | ✅ DONE — see ViewMenu section above                    |
| Profile          | MenuStack  | `src/components/views/Profile/`                         |
| Favorites        | MenuStack  | `src/components/views/Favorites/`                       |
| Notifications    | MenuStack  | `src/components/views/Notifications/`                   |
| MyPayments       | MenuStack  | `src/components/views/MyPayments/`                      |
| Downloads        | MenuStack  | `src/components/views/Downloads/`                       |
| SignUp           | AuthStack  | `src/components/views/Auth/SignUpView/`                 |
| RecoverPassword  | AuthStack  | `src/components/views/Auth/RecoverPasswordView/`        |
| Home content     | AppRecommended | `src/components/views/Home/` or similar             |
| Discover content | AppDiscover | `src/components/views/Discover/` or similar            |
| Search           | SearchStack | `src/components/views/Search/` or similar              |

> Before writing tests for these screens, always read the source component files to find actual `testID` props.

---

## Convention for Adding New TestIDs

When a new testID is discovered:
1. Confirm it in source code (grep for `testID=` in the component file)
2. Add it to this catalog under the correct screen
3. Note if it's conditional (disabled state, auth-gated, etc.)
