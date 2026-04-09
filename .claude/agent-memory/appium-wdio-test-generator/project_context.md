---
name: "project_context"
description: "App architecture, navigation structure, what screens exist, and what the test project needs to cover"
type: project
---

# Project Context

## Overview

The test project automates QA for **ott-next-core-mobile**, a React Native OTT (Over-The-Top) streaming app with multiple clients (e.g., Azteca Live, mdstrm). Tests run via WebDriverIO + Appium against real Android devices or emulators. The app source is at `C:\Users\Mateo\ott-next-core-mobile` (read-only). The test project lives at `C:\appium-test\`.

## App Architecture

The app is a multi-client React Native OTT platform. Navigation is driven by `@react-navigation`. The root navigator is defined in `C:\Users\Mateo\ott-next-core-mobile\src\core\Navigation\index.js`.

### Root Stack (`RootStack.Navigator`, initialRoute: `Splash`)

| Screen Name    | Description                                  |
|---------------|----------------------------------------------|
| `Splash`       | Launch/loading screen                        |
| `Steps`        | Onboarding steps (optional)                  |
| `AppContainer` | Authenticated app — renders Bottom Tab bar   |
| `Auth`         | Auth stack (login, signup, recover password) |
| `Player`       | Full-screen media player                     |
| `LiveEpg`      | Live TV guide                                |

### Bottom Tab Navigator (`AppContainerTab`) — Screens

Defined in `AppContainerTab.js`. Tabs are configurable per client (some may be hidden via `hasSearch` / `hasDiscoverContent` flags from `useConfig()`):

| Tab Name         | testID          | Stack Component     | Default Visible |
|-----------------|-----------------|---------------------|----------------|
| `AppRecommended` | `tab-home`      | `AppRecommendedStack` | Always         |
| `AppDiscover`    | `tab-discover`  | `AppDiscoverStack`    | If `hasDiscoverContent` |
| `SearchStack`    | `tab-search`    | `SearchStack`         | If `hasSearch` |
| `MenuStack`      | `tab-menu`      | `MenuStack`           | Always         |

### Auth Stack (`AuthStack.js`) — Screens

| Screen Name            | Description                              |
|------------------------|------------------------------------------|
| `Login`                | Email + password sign-in form            |
| `SignUp`               | User registration                        |
| `RecoverPassword`      | Password recovery                        |
| `SendPassword`         | Send password (linked from recover)      |
| `EmailValidation`      | Email validation (federation flow)       |
| `ContactSupport`       | Support contact form                     |
| `ContactSupportSuccess`| Support contact confirmation             |
| `CompleteCustomerData` | Complete user profile after social login |

### Menu Stack (`MenuStack.js`) — Screens

| Screen Name            | Description                              |
|------------------------|------------------------------------------|
| `Menu`                 | Main menu screen (entry point)           |
| `Profile`              | User profile                             |
| `Favorites`            | User favorites                           |
| `Notifications`        | Notification settings/list               |
| `MyPayments`           | Payment history/subscription             |
| `Downloads`            | Downloaded content                       |
| `AccountDelete`        | Account deletion                         |
| `ContactSupport`       | Support contact                          |
| `ContactSupportSuccess`| Support contact confirmation             |
| `Details`              | Content details                          |
| `ShowPodcast`          | Podcast show screen                      |
| `ShowEpisode`          | Podcast episode screen                   |

## Multi-Client Architecture

The `appPackage` and `appActivity` are **always passed as environment variables** at runtime. Never hardcode them. Example clients:
- `com.azteca.live` / `com.azteca.live.MainActivity`
- `com.mdstrm.core` / `com.mdstrm.core.MainActivity`

Credentials are also client-specific and must come from env vars or constants defined per test run, not hardcoded in shared config.

## What the Test Project Needs to Cover

1. **Auth flow** — Navigate tabs → tap Menu → find login button → fill form → submit → verify outcome
2. **Tab navigation** — Verify all tabs (home, discover, search, menu) are reachable and visible
3. **Menu navigation** — Navigate within Menu stack to sub-screens (Profile, Favorites, etc.)
4. **Post-login flows** — Authenticated-only screens accessible after login
5. **Error handling** — Login with bad credentials, field validation

## Key Source Paths (read-only)

- Navigation root: `C:\Users\Mateo\ott-next-core-mobile\src\core\Navigation\index.js`
- Bottom tabs: `C:\Users\Mateo\ott-next-core-mobile\src\core\Navigation\Navigators\AppContainerTab.js`
- Auth stack: `C:\Users\Mateo\ott-next-core-mobile\src\core\Navigation\Navigators\AuthStack.js`
- Menu stack: `C:\Users\Mateo\ott-next-core-mobile\src\core\Navigation\Navigators\MenuStack.js`
- Login form: `C:\Users\Mateo\ott-next-core-mobile\src\components\views\Auth\LoginView\FormSignInSection.js`
- All views: `C:\Users\Mateo\ott-next-core-mobile\src\components\views\`
