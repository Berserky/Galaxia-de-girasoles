# Galaxy Chat 4.0 — SUPERNOVA Phase 5 · Camera & Media

## Architecture

Galaxy Chat keeps one multimedia pipeline and one message-delivery pipeline.

`Composer 2.0 → Attachment Launcher → native capture/picker → native review → media inspection → MobileApiClient upload → Composer draft attachment → Delivery Engine → Message Engine`

- **Capture:** `GalaxyCameraActivity` uses CameraX Preview, ImageCapture and VideoCapture. It owns only private cache files under `cache/camera-media`.
- **Selection:** Android Photo Picker remains the gallery entry and can return images or videos without broad storage permission.
- **Review:** `GalaxyCameraActivity` reviews captures; `GalaxyMediaReviewActivity` reviews ordered picker selections. Neither uploads before explicit confirmation.
- **Validation/preparation:** `MediaInspector` derives real MIME through `MediaSniffer`, plus size, dimensions, video duration and rotation. `MobileApiClient` revalidates before upload.
- **Upload:** existing `MobileApiClient` streaming upload remains authoritative. Phase 5 adds measured progress, cancellation and source metadata without adding a second Storage path.
- **Message:** uploaded media returns to Composer 2.0 as draft attachments. Delivery Engine remains the only path that creates chat messages; Realtime reconciliation remains unchanged.
- **Rendering:** width/height/duration metadata travels with draft attachments so Message Engine/Scroll Engine can reserve media geometry and keep heavy resources limited to the virtualized window.

## Permissions

- Camera permission is requested only when capture is invoked.
- Microphone permission is requested only for video capture.
- Photo Picker requires no broad storage permission.
- No `MANAGE_EXTERNAL_STORAGE`, universal file access or `file://` flow is introduced.
- Camera/review activities are `exported=false`.
- FileProvider continues using `content://` and private cache paths.
- `openChatFile` keeps the existing signed `galaxy-chat-media` allowlist and WebView file/content access remains disabled.

Denied and revoked permissions return to Composer through the existing contextual permission/error path; permanent denial continues to use the current app-settings affordance.

## Formats and validation

Accepted Galaxy Chat media remains:

| Type | Accepted source |
| --- | --- |
| Image | JPEG, PNG, WebP, HEIC, HEIF |
| Video | MP4, WebM |

Validation does not trust file extensions. Android compares the ContentResolver MIME with signature/magic-byte inspection. Image/video kinds are rejected when the real content does not match the allowlist. Backend `validateUploadMedia` remains a second validation boundary.

HEIC/HEIF is previewed natively with ImageDecoder on supported Android versions. The existing Android normalization to JPEG is retained because the current chat-photo backend intentionally stores JPEG/PNG/WebP; conversion is therefore pipeline-required rather than unconditional product behavior. Conversion is bounded to 4096 px and the existing upload-size cap.

## Temporaries and cleanup

- Captures are created only under private app cache.
- Cancel/retake deletes the capture immediately.
- Confirmed captures remain only until validation/upload completes, then the owned temp is deleted.
- Picker URIs are never copied to permanent app storage merely for review.
- Cancelling a streaming upload checks a cancellation token between chunks.
- Already-uploaded but not-yet-referenced paths are sent to `chat-media-discard`. The backend deletes only paths owned by the requesting person and only when no `galaxy_chat_attachments` row references the path.
- Removing a media draft from Composer invokes the same unreferenced-media cleanup.
- Retry still uses the existing `x-upload-id` idempotency contract, preventing duplicate blobs during retry.

## Upload/message states

The UI exposes only states backed by real work:

`preparing → uploading → ready`

Failure/cancel terminal states are `failed` and `cancelled`. A percentage is rendered only when the content length is known; no synthetic progress is shown.

The Composer can cancel active native upload, remove prepared items, retain its text/reply context and send only after media is ready. Captions are mapped onto the existing message body contract rather than creating a new incompatible attachment-caption schema.

## Media UX

Camera controls are deliberately small in scope: close, shutter/record, camera switch, torch when available, tap-to-focus, recording timer and current mode. Photo/video review provides cancel, retake, optional caption and explicit confirm. Video review is playable before confirm.

Photo Picker review preserves selection order, presents one original at a time to avoid decoding all originals into RAM, supports previous/next navigation and removal, and uploads sequentially to cap memory/network concurrency.

## Required validation matrix

| # | Scenario | Automated gate |
| ---: | --- | --- |
| 1 | open camera | CameraX emulator instrumentation |
| 2 | close camera | CameraX emulator instrumentation |
| 3 | rear photo | CameraX emulator instrumentation |
| 4 | front camera switch | CameraX emulator when front lens exists |
| 5 | flash control | CameraX activity + device capability gate |
| 6 | photo retake | CameraX emulator instrumentation |
| 7 | send photo | native review/upload contract + staging Delivery Engine |
| 8 | cancel photo | CameraX emulator temp-cleanup assertion |
| 9 | record video | CameraX emulator instrumentation |
| 10 | stop video | CameraX emulator instrumentation |
| 11 | video preview/playback | CameraX emulator instrumentation |
| 12 | video retake | CameraX emulator instrumentation |
| 13 | send video | native review/upload contract + staging Delivery Engine |
| 14 | Photo Picker | Android device-closure + native review instrumentation |
| 15 | JPEG | signature validation tests |
| 16 | PNG | signature validation tests |
| 17 | WebP | signature validation tests |
| 18 | HEIC/HEIF | signature + normalization tests |
| 19 | MP4 | signature validation + CameraX instrumentation |
| 20 | corrupt file | backend/media contract tests |
| 21 | incorrect MIME | real-MIME contract tests |
| 22 | permission denied | existing clean-install/device permission boundary |
| 23 | permission revoked | Android lifecycle/device boundary |
| 24 | network loss during upload | Delivery/QA network regression + cancellable stream contract |
| 25 | background/foreground | existing device-closure instrumentation |
| 26 | rotation | activity config/lifecycle instrumentation |
| 27 | upload cancellation | native observer + bridge + cleanup contract |
| 28 | two consecutive sends | Delivery Engine regression |
| 29 | multimedia under Realtime | Delivery/reconciliation regression |
| 30 | reopen sent file | existing secure `openChatFile` regression |

## Metrics

Phase 0 baseline records the previous chat media path as external camera intent → immediate native upload → Composer draft. Phase 5 instrumentation emits `GALAXY_CHAT_PHASE5_ANDROID` records for:

- camera open → shutter-ready time;
- capture → photo review time;
- stop-recording → video review time;
- media inspection/preparation time;
- process PSS before/after photo/video;
- emulator logcat fatal-exception/ANR scan.

CI artifacts keep the raw instrumentation and logcat evidence. The Phase 5 gate additionally runs full Node regression, Deno validation, Android unit tests, lint and debug build.

## Real limitations

- Photo Picker selection is capped at 12 items for Galaxy Chat in this phase to keep review/upload concurrency bounded.
- HEIC/HEIF is normalized only because the existing server chat-photo storage contract does not persist HEIF directly.
- Android Emulator camera coverage is deterministic but does not replace a physical-device pass for OEM camera/flash/front-lens behavior.
- Upload cancellation can stop client streaming and clean blobs already returned by the server. A server request that has crossed the final storage commit boundary may finish before cancellation arrives; `chat-media-discard` then performs safe unreferenced cleanup.
- Advanced editing, filters, AR effects, global motion redesign and Voice Messages redesign remain outside Phase 5.
