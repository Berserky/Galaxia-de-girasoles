# Nuestra Galaxia 4.1.1 — Barrido completo de las 80 etiquetas de rescate

**Fecha:** 2026-10-08 · **Base:** origin/desarrollo · **Método:** lectura Git de 80 refs, conciliación SHA contra docs/branch-audit-2026-10-08.csv, merge-base y diff de rutas de archivo por ref.

> AUDITORÍA ESTÁTICA COMPLETA DE REFERENCIAS, NO CERTIFICACIÓN FUNCIONAL. Cada etiqueta fue recorrida para confirmar su historial de commits y archivos divergentes. No se revisó línea por línea ni se probó E2E el código dentro de cada tag; ninguna se restauró. Un archivo faltante no implica función perdida: puede haberse movido, rediseñado o descartado a propósito.

## Resultado de consistencia
- Etiquetas de archivo reconciliadas: **80/80**, sin discrepancias de SHA con CSV.
- Todas las etiquetas tienen ancestro común verificable con origin/desarrollo; se inspeccionaron sus archivos históricos divergentes contra ese ancestro.
- Los cambios han sido clasificados por dominio de forma **heurística**; la decisión funcional individual está en NG-4.1.1-RECOVERY-DECISIONS.md y necesita evidencia E2E.

| Archivo histórico | SHA | Fecha UTC | Dominio tentativo | Rutas tocadas | Existen hoy | Ya no están en desarrollo | Ejemplos de rutas ausentes |
|---|---|---|---|---:|---:|---:|---|
| `archive/2026-10-08/aegiron/android-companion` | `785419e6a` | 2026-10-02 | Entrega / plataforma | 28 | 28 | 0 | — |
| `archive/2026-10-08/aegiron/anime-assets-v1` | `817983d51` | 2026-10-02 | Hogar / RPG / tienda | 10 | 4 | 6 | `app/public/assets/home/album.svg`, `app/public/assets/home/calendar.svg`, `app/public/assets/home/memorybox.svg`, `app/public/assets/home/planner.svg`, `app/public/assets/home/recordplayer.svg`, `app/public/assets/home/telephone.svg` |
| `archive/2026-10-08/aegiron/camera-fileprovider-3.2.2` | `280e8fc29` | 2026-10-03 | Chat / cámara | 6 | 6 | 0 | — |
| `archive/2026-10-08/aegiron/camera-visibility-3.2.3` | `85bef3f77` | 2026-10-03 | Chat / cámara | 6 | 6 | 0 | — |
| `archive/2026-10-08/aegiron/chat-attachments-3.2.4` | `e5745de76` | 2026-10-03 | Chat / cámara | 10 | 10 | 0 | — |
| `archive/2026-10-08/aegiron/chat-composer-camera-3.2.1` | `2c9943fef` | 2026-10-03 | Chat / cámara | 7 | 7 | 0 | — |
| `archive/2026-10-08/aegiron/curated-shop-v30` | `3dc3d7ea6` | 2026-10-02 | Hogar / RPG / tienda | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/dynamic-motion-markers` | `78d48f08f` | 2026-10-02 | Mapas / privacidad | 5 | 5 | 0 | — |
| `archive/2026-10-08/aegiron/fix-hogar-launch` | `cf447a902` | 2026-10-02 | Hogar / RPG / tienda | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/fix-map-js-syntax` | `2ca410516` | 2026-10-02 | Mapas / privacidad | 1 | 1 | 0 | — |
| `archive/2026-10-08/aegiron/fix-pages-deploy` | `500c9de8f` | 2026-10-02 | Entrega / plataforma | 1 | 1 | 0 | — |
| `archive/2026-10-08/aegiron/fix-pages-v26` | `06a78a7f7` | 2026-10-02 | Entrega / plataforma | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/fix-rpg-tiles-hud-v4` | `b63eb644b` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/fix-shop-category-layout-v29` | `ba05b49a5` | 2026-10-02 | Hogar / RPG / tienda | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/free-assets-home-v1` | `5ab75b683` | 2026-10-02 | Hogar / RPG / tienda | 5 | 3 | 2 | `app/public/assets/home/ASSET-LICENSES.md`, `app/public/assets/home/free-assets.js` |
| `archive/2026-10-08/aegiron/full-theme-coverage` | `f0342c97f` | 2026-10-02 | Diseño / tema | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/galaxy-chat-core-3.2.0` | `157b817e6` | 2026-10-03 | Chat / cámara | 16 | 15 | 1 | `supabase/migrations/20261004023000_galaxy_chat_core_320.sql` |
| `archive/2026-10-08/aegiron/hogar-adventure-v2` | `dc5ddf77c` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/hogar-fullscreen-v3` | `d1f8b9391` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/home-clean-rebuild-v4` | `22aba1ff9` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/home-hotspot-hitbox-v5` | `a20cb8d55` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/home-library-v28` | `8176ea8a1` | 2026-10-02 | Hogar / RPG / tienda | 4 | 2 | 2 | `app/public/assets/home/ASSET-LICENSES.md`, `app/public/assets/home/manifest.js` |
| `archive/2026-10-08/aegiron/home-rpg-own-theme-v5` | `9b49cc932` | 2026-10-02 | Hogar / RPG / tienda | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/home-scale-fix-v3` | `d5839f68a` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/home-visual-overhaul-v2` | `2dd2ef721` | 2026-10-02 | Hogar / RPG / tienda | 4 | 3 | 1 | `app/public/assets/home/free-assets.js` |
| `archive/2026-10-08/aegiron/hotfix-chat-fk-indexes-3.1` | `6a0d828d4` | 2026-10-03 | Chat / cámara | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/hotfix-chat-layout-3.1.1` | `a84915cbd` | 2026-10-03 | Chat / cámara | 6 | 6 | 0 | — |
| `archive/2026-10-08/aegiron/hotfix-map-gps-eta-3.0.2` | `cf96a3c62` | 2026-10-03 | Mapas / privacidad | 8 | 8 | 0 | — |
| `archive/2026-10-08/aegiron/hotfix-navigation-goals-ai-3.0.1` | `e797717be` | 2026-10-03 | Entrega / plataforma | 8 | 8 | 0 | — |
| `archive/2026-10-08/aegiron/live-motion-speed` | `932d55d8f` | 2026-10-02 | Mapas / privacidad | 6 | 6 | 0 | — |
| `archive/2026-10-08/aegiron/map-floating-statuses` | `f8aadb2d1` | 2026-10-02 | Mapas / privacidad | 4 | 4 | 0 | — |
| `archive/2026-10-08/aegiron/map-floating-ui-lucide` | `d25b06964` | 2026-10-02 | Mapas / privacidad | 5 | 5 | 0 | — |
| `archive/2026-10-08/aegiron/map-insights-privacy` | `b5e386e25` | 2026-10-02 | Mapas / privacidad | 7 | 7 | 0 | — |
| `archive/2026-10-08/aegiron/mega-update-3.1-chat-notifications` | `4127dcdcb` | 2026-10-03 | Chat / cámara | 17 | 17 | 0 | — |
| `archive/2026-10-08/aegiron/music-player-v2` | `086b63c44` | 2026-10-02 | Música | 6 | 6 | 0 | — |
| `archive/2026-10-08/aegiron/nuestro-hogar-v1` | `6f1d886ce` | 2026-10-02 | Hogar / RPG / tienda | 4 | 4 | 0 | — |
| `archive/2026-10-08/aegiron/nuestro-mapa-v1` | `7e48e3f43` | 2026-10-02 | Mapas / privacidad | 7 | 7 | 0 | — |
| `archive/2026-10-08/aegiron/nuestro-mapa-v2` | `db834095b` | 2026-10-02 | Mapas / privacidad | 6 | 6 | 0 | — |
| `archive/2026-10-08/aegiron/panoramic-home-camera` | `f7a8b547f` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/private-mobility-history` | `a749cf747` | 2026-10-02 | General | 6 | 6 | 0 | — |
| `archive/2026-10-08/aegiron/pulido-estabilidad` | `68eb47886` | 2026-10-02 | Diseño / tema | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/pwa-mobile` | `889000758` | 2026-10-02 | Diseño / tema | 6 | 6 | 0 | — |
| `archive/2026-10-08/aegiron/qa-hardening-3.3.0` | `d0a06c96d` | 2026-10-04 | Momentos / widgets | 35 | 35 | 0 | — |
| `archive/2026-10-08/aegiron/release-audit-hardening` | `c5b04cfa6` | 2026-10-02 | Entrega / plataforma | 8 | 8 | 0 | — |
| `archive/2026-10-08/aegiron/remove-home-game-v32` | `fc3efdae1` | 2026-10-02 | Hogar / RPG / tienda | 6 | 3 | 3 | `app/public/assets/home/ASSET-LICENSES.md`, `app/public/assets/home/manifest.js`, `app/public/assets/home/rpg-indoors.js` |
| `archive/2026-10-08/aegiron/roguelike-home-movement-v1` | `b9e4aa08d` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/roguelike-room-rebuild-v3` | `eccf7e84f` | 2026-10-02 | Diseño / tema | 4 | 3 | 1 | `app/public/assets/home/manifest.js` |
| `archive/2026-10-08/aegiron/rpg-assets-clean-foundation` | `48d770a78` | 2026-10-02 | Hogar / RPG / tienda | 4 | 3 | 1 | `app/public/assets/home/manifest.js` |
| `archive/2026-10-08/aegiron/rpg-catalog-mass-v7` | `2158d3df1` | 2026-10-02 | Hogar / RPG / tienda | 4 | 3 | 1 | `app/public/assets/home/manifest.js` |
| `archive/2026-10-08/aegiron/rpg-door-layout-v6` | `b62d18838` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/rpg-indoors-v1` | `3d5ef5090` | 2026-10-02 | Hogar / RPG / tienda | 6 | 3 | 3 | `app/public/assets/home/ASSET-LICENSES.md`, `app/public/assets/home/manifest.js`, `app/public/assets/home/rpg-indoors.js` |
| `archive/2026-10-08/aegiron/rpg-ui-clean-catalog-v2` | `7e4bf75c6` | 2026-10-02 | Hogar / RPG / tienda | 12 | 3 | 9 | `app/public/assets/home/ASSET-LICENSES.md`, `app/public/assets/home/album.svg`, `app/public/assets/home/calendar.svg`, `app/public/assets/home/free-assets.js`, `app/public/assets/home/manifest.js`, `app/public/assets/home/memorybox.svg` |
| `archive/2026-10-08/aegiron/semantic-home-catalog-v27` | `df30d8f38` | 2026-10-02 | Hogar / RPG / tienda | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/shop-layout-cache-v31` | `293ee47f5` | 2026-10-02 | Hogar / RPG / tienda | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/theme-engine` | `fc2d02e3a` | 2026-10-02 | Diseño / tema | 4 | 4 | 0 | — |
| `archive/2026-10-08/aegiron/theme-leak-fix` | `6d4f4c69c` | 2026-10-02 | Diseño / tema | 2 | 2 | 0 | — |
| `archive/2026-10-08/aegiron/theme-system-v2` | `b4013a101` | 2026-10-02 | Diseño / tema | 3 | 3 | 0 | — |
| `archive/2026-10-08/aegiron/universe-connected-suite` | `c34f9f9c5` | 2026-10-02 | Diseño / tema | 11 | 11 | 0 | — |
| `archive/2026-10-08/dependabot/github_actions/actions/checkout-7` | `37daffea9` | 2026-10-08 | Mapas / privacidad | 19 | 19 | 0 | — |
| `archive/2026-10-08/dependabot/github_actions/actions/deploy-pages-5` | `87b958984` | 2026-10-04 | Entrega / plataforma | 1 | 1 | 0 | — |
| `archive/2026-10-08/dependabot/github_actions/actions/setup-java-6` | `cde70d94a` | 2026-10-08 | Mapas / privacidad | 10 | 10 | 0 | — |
| `archive/2026-10-08/dependabot/github_actions/actions/setup-node-7` | `fa8d4b613` | 2026-10-08 | Chat / cámara | 7 | 7 | 0 | — |
| `archive/2026-10-08/dependabot/github_actions/gradle/actions-6` | `eb4ac42f7` | 2026-10-08 | Mapas / privacidad | 9 | 9 | 0 | — |
| `archive/2026-10-08/dependabot/gradle/android/androidx.core-core-1.19.1` | `df42e1f4e` | 2026-10-05 | Entrega / plataforma | 1 | 1 | 0 | — |
| `archive/2026-10-08/dependabot/gradle/android/androidx.work-work-runtime-2.12.0` | `9cc6ae553` | 2026-10-06 | Entrega / plataforma | 1 | 1 | 0 | — |
| `archive/2026-10-08/dependabot/gradle/android/com.android.application-9.4.1` | `77e1b2f09` | 2026-10-08 | Entrega / plataforma | 1 | 1 | 0 | — |
| `archive/2026-10-08/feat/android-in-app-updater` | `afade0871` | 2026-10-02 | Entrega / plataforma | 7 | 7 | 0 | — |
| `archive/2026-10-08/feat/contemporary-galaxy` | `c67b9cdbb` | 2026-10-02 | Mapas / privacidad | 44 | 44 | 0 | — |
| `archive/2026-10-08/feat/couple-moments` | `6f7922ca8` | 2026-10-02 | Momentos / widgets | 45 | 44 | 1 | `supabase/migrations/20261002183012_couple_moments.sql` |
| `archive/2026-10-08/feature/android-mobile-1.4.0` | `5feedffa4` | 2026-10-02 | Entrega / plataforma | 12 | 12 | 0 | — |
| `archive/2026-10-08/feature/complete-universe-2-1` | `322bf6bab` | 2026-10-02 | Momentos / widgets | 13 | 13 | 0 | — |
| `archive/2026-10-08/fix/android-mobile-quality-1.4.1` | `96ea80916` | 2026-10-02 | Entrega / plataforma | 24 | 24 | 0 | — |
| `archive/2026-10-08/fix/android-startup-freeze` | `e5024f88b` | 2026-10-02 | Entrega / plataforma | 6 | 6 | 0 | — |
| `archive/2026-10-08/fix/android-startup-splash` | `83a9def43` | 2026-10-02 | Entrega / plataforma | 10 | 10 | 0 | — |
| `archive/2026-10-08/fix/map-progressive-loading` | `d29094867` | 2026-10-02 | Mapas / privacidad | 6 | 6 | 0 | — |
| `archive/2026-10-08/fix/qa-phase-0-privacy-boundaries` | `e3f951c26` | 2026-10-04 | Entrega / plataforma | 16 | 14 | 2 | `supabase/migrations/20261004212500_qa_phase0_privacy_firewall.sql`, `supabase/rollbacks/20261004212500_qa_phase0_privacy_firewall_rollback.sql` |
| `archive/2026-10-08/fix/qa-phase-1-data-integrity` | `2cba240fc` | 2026-10-04 | Entrega / plataforma | 49 | 49 | 0 | — |
| `archive/2026-10-08/fix/qa-phase-2-chat-correctness` | `562e1b073` | 2026-10-04 | Chat / cámara | 13 | 11 | 2 | `supabase/migrations/20261005023000_qa_phase2_chat_correctness.sql`, `supabase/rollbacks/20261005023000_qa_phase2_chat_correctness_rollback.sql` |
| `archive/2026-10-08/fix/qa-phase-2-chat-correctness-history` | `c2d66ef33` | 2026-10-04 | Chat / cámara | 8 | 8 | 0 | — |
| `archive/2026-10-08/fix/qa-phase-3-multimedia-android` | `1d08cd695` | 2026-10-04 | Chat / cámara | 13 | 13 | 0 | — |

## Restricciones para integración
1. No hacer merge ni cherry-pick de estas referencias por estar divergidas del Android 4.1.1.
2. Conservar assets/mobile y el puente nativo. No reaplicar migraciones/destructivas ni recuperar secretos.
3. Para cada candidata, correlacionar con NG-LEG y NG-FNC antes de iniciar un PR funcional.
4. Mantener las pruebas de privacidad/adversariales y QA de dos parejas como gate para cualquier módulo compartido.

## Significado de rutas
La columna “Existen hoy” solo indica una ruta de nombre idéntico en desarrollo. “Ya no están” tampoco demuestra pérdida funcional (puede tratarse de antiguas rutas de PWA reemplazadas por WebView Android). Esta lista no autoriza implementaciones.
