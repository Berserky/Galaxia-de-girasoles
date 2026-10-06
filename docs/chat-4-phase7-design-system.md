# Galaxy Chat 4.0 — Phase 7 Design System

## Tokens
Chat visuals use centralized `--chat-*` semantic tokens in `android/app/src/main/assets/mobile/app.css`: spacing, radii, typography, touch targets, icon sizes, surfaces, text, accent, semantic status colors, borders, elevation, overlay and disabled opacity.

## Component rules
- MessageBubble/TextMessage: shared geometry; own/partner differ only semantically.
- ReplyPreview: one compact accent treatment in messages and Composer.
- Media/Location/GalaxyCard/Voice: shared radii, surfaces and semantic colors.
- Delivery/error/loading: semantic status tokens; never color alone for delivery because icon/text remain present.
- Composer/AttachmentSheet/ContextMenu: 44–48 px minimum interactive targets.
- Consecutive messages from the same sender within five minutes may group visually; replies, cards, deleted messages and day boundaries do not group.
- Reduced motion disables nonessential chat transitions/animations.
- Existing theme variables remain the source for light/dark identity; chat tokens map to them rather than hardcoded component hex values.

## QA matrix
Text own/other/long/emoji/links; reply; image/video/audio/location; Galaxy Card; system/date/unread; reactions/context menu; sending/sent/failed; Composer/attachment sheet; dark theme; font scaling; landscape/keyboard/safe areas; reduced motion; virtualization/performance.

No backend, Delivery Engine, CameraX or recorder behavior is changed by this phase.
