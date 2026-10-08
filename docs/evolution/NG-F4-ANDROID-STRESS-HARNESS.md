# NG-F4 Android regression harness: foreground focus on API35

## Reproduced failure
The initial Android stress run for PR #128, and the QA promotion PR #126, reported **the same 3 timeouts in GalaxyDeviceClosureTest**:
- `chatPhase4Composer2_realWebViewInputReplyDraftSheetAnd20k_areStable`
- `cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem`
- `startNavigationModalKeyboardForegroundAndRotation_areReal`

The helper `tapWebElement` waited 30s for **`web.hasFocus() && web.hasWindowFocus()` before dispatching its first user touch**, which can deadlock on a headless AVD. Android and WebView input behaviors may need an actual touch to acquire focus. The test still performs a real Android screen tap, a WebView touch fallback, DOM activeElement verification, and checks actual IME readiness. We no longer interpret a pre-touch window flag as proof of failure.

For `ACTION_OPEN_DOCUMENT`, the prior test compared the foreground package with the package from `resolve-activity`. Actual system choice can be an OEM/system chooser under another package. This test now asserts the Android process actually hands foreground to a non-app package and then returns to the app after Back, while preserving the resolved handler and observed foreground package in diagnostic output. It still fails when no external UI opens.

## Verification and limits
- Node contract tests assert real-touch and post-touch assertions remain; no tests are skipped and no app code or permissions changed.
- Real Android instrumented lifecycle and stress suites **must pass** on this PR before merging.
- Avoid conflating a stable emulated test harness with real-device camera, FCM, GPS or production readiness.
- The earlier failures remain recorded in issue #129 with original SHA and job references.

**No device personal data, Supabase changes, app release, QA branch promotion or prod changes.**
