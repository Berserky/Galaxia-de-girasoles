# GIPHY production attribution — 2026-10-08

- The artwork bundled in `android/app/src/main/assets/mobile/giphy-official-logo.png` is the **full GIPHY icon+wordmark** sourced as an unmodified crop from the **official GIPHY Brand Guidelines, June 2025, page 8** (0-index page 7).
- Official download: https://support.giphy.com/hc/en-us/article_attachments/9599173349274
- Official API Terms: https://support.giphy.com/hc/en-us/articles/360028134111-GIPHY-API-Terms-of-Service
- This trademark is used **solely** as attribution to content served by GIPHY's API, not as this app's branding.
- Combined rendered label is **Powered by** + official **GIPHY** logo, displayed in search discovery, stickers libraries, and received GIF/sticker embeds. No source URLs or brand assets are uploaded to Supabase Storage.
- API beta rate limit is **100 calls/hour** and key upgrade requires a separate GIPHY developer dashboard approval. Verify current key tier before scaling beyond private QA/limited users; this patch does not claim a production-approved key.
