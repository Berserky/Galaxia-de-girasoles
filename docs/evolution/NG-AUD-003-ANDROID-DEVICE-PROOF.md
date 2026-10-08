# NG-AUD-003 — Android landscape onboarding, device-level proof

## Objective
Close the original portrait/landscape onboarding evidence gap identified in F1 after CSS changes in PR #121. Contract tests and a green build cannot prove that the pairing call-to-action is in the first visible viewport.

## Automated acceptance
Run `GalaxyOnboardingViewportTest` against a fresh emulator, **without a paired device token**. It rotates the actual `MainActivity` WebView from portrait to landscape and checks:

- Both screens contain the pairing form; the labeled, required code input is preserved.
- Neither orientation has horizontal overflow.
- **Landscape:** code field and submit CTA fit inside the first visual viewport without scroll, the CTA is at least 40 CSS pixels high, and the code field can be focused after rotating.
- Two screenshots are taken while the form is empty: `portrait.png`, `landscape.png`. No credentials or personal information are entered.
- The `NG_AUD_003_ANDROID` and `NG_AUD_003_JUNIT_VERIFIED` proof markers require the real case to execute (not be skipped).

The workflow `ng-aud-003-onboarding.yml` runs on Android API35 with QA application suffix `.onboardingqa`, not the stable application ID, and produces downloadable GitHub Action artifacts. Failure must block merging the PR; do not fake screenshots or call unit checks a visual pass.

## Limits
The emulated Pixel 6 viewport does not cover all OEMs, keyboard resize behaviors and accessibility font scales. A human must still inspect the screenshots to assess readability and overlapping system UI. This test does not pair a device or contact production.
