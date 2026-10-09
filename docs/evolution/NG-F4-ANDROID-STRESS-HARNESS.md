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

## CameraX accessibility timing gate

On PR #130, two CameraX runs reached a visible `GalaxyCameraActivity` and opened Camera2 sessions, but `UiDevice.wait(Until.hasObject(By.desc(...)),8000)` failed to find the initial shutter labels. The native view hierarchy does set those descriptions; the accessibility-node search is not an adequate stand-alone indicator on the headless API35 runner.

The instrumented test now resolves a **shown and measured native view** from the Activity window, uses its actual on-screen center, and delivers `UiDevice.click` (real Android touch). It still asserts captured photo/video review, preview quality, MIME/duration and file cleanup, recreations and lens switching. No CameraX app code is changed. Missing controls remain **test failures**, not skipped tests; added diagnostic names and bounded timeouts.

**Evidence required:** new JUnit runs for both camera tests with 0 skips and CameraX `CAMERAX_QA_EVIDENCE.status=VERIFIED`, plus all other PR CI suites. Historical green PR #119 is not enough for the new commit.
