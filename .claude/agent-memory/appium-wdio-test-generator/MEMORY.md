---
name: "MEMORY"
description: "Index of all agent memory files for appium-wdio-test-generator"
type: project
---

# Agent Memory Index — appium-wdio-test-generator

This directory contains the foundational memory for the `appium-wdio-test-generator` agent. Load relevant files before generating tests.

| File                      | Type      | Description                                                                                  |
|---------------------------|-----------|----------------------------------------------------------------------------------------------|
| `project_context.md`      | project   | App architecture, navigation structure, all screens, what the test project needs to cover    |
| `testids_catalog.md`      | reference | All confirmed testIDs from app source, organized by screen, with selector patterns           |
| `navigation_paths.md`     | reference | Verified navigation paths from launch to each screen, including timing notes                 |
| `test_project_structure.md` | project | Current state of C:\appium-test\ — what files exist and what is still missing              |
| `conventions.md`          | feedback  | Coding conventions: Spanish test names, selector priority, POM, env vars, tap strategy      |

## Quick Reference

- **App source** (read-only): `C:\Users\Mateo\ott-next-core-mobile\`
- **Test project**: `C:\appium-test\`
- **Confirmed testIDs**: `tab-home`, `tab-discover`, `tab-search`, `tab-menu`, `login-email-input`, `login-password-input`, `login-btn-submit`
- **Device**: Physical Android at `192.168.1.187:5555` (ADB TCP)
- **Appium**: `localhost:4723`, UiAutomator2
- **App package**: passed as `APP_PACKAGE` env var (e.g., `com.azteca.live`)
- **Credentials**: passed as `TEST_EMAIL` / `TEST_PASSWORD` env vars

## Loading Priority

When starting a new test generation task:
1. Always load `conventions.md` — coding rules must be followed
2. Load `testids_catalog.md` — know what selectors are available
3. Load `navigation_paths.md` — understand how to reach the target screen
4. Load `test_project_structure.md` — know what files exist before creating new ones
5. Load `project_context.md` — for broader architectural context if needed
