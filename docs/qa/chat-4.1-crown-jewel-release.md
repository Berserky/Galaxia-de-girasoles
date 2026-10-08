# Nuestra Galaxia 4.1.0 — CROWN JEWEL
## QA / Release Candidate ledger — Bloque 4/4

### Alcance
Release única de Galaxy Chat 4.1.0 sobre `feat/galaxy-chat-4.1-crown-jewel`, integrando los Bloques 1, 2 y 3 y cerrando VIS-001 → VIS-066. No agrega features fuera del alcance y no autoriza promoción `android-stable`.

### Base e integración
- Base de la rama: `main = 0c54c09c485af41e352b868f6b332790fa99366d`.
- PR único: #109 — **Galaxy Chat 4.1 — Crown Jewel**.
- Bloque 1 confirmado en la rama y cubierto por `tests/chat-4.1-crown-jewel-foundation.test.mjs`.
- Bloque 2 confirmado en la rama y cubierto por `tests/chat-4.1-crown-jewel-block2.test.mjs`, Phase 5 Camera/Media y media validation.
- Bloque 3 confirmado en la rama y cubierto por `tests/chat-4.1-crown-jewel-block3.test.mjs` y suites premium/universe.
- Release metadata: `versionCode = 37`, `versionName = "4.1.0"`.
- El histórico de Supernova 4.0 permanece intacto cuando describe fases históricas.

### Regla de estado
Un VIS se marca PASS únicamente cuando existe evidencia automatizada/regresiva ejecutable que comprueba el contrato afectado; la mera presencia de código no cuenta. El smoke físico se registra como gate independiente porque prueba hardware/ADB, no sustituye la matriz funcional.

### Matriz VIS-001 → VIS-066
| VIS | Hallazgo / objetivo | Estado | Evidencia principal |
|---|---|---|---|
| VIS-001 | Header de Galaxy Chat en dos filas / exceso de acciones | PASS | foundation: header one-row + Search/More |
| VIS-002 | Voice Composer provoca overflow horizontal | PASS | foundation: single GalaxyChatVoice + viewport bounds |
| VIS-003 | Shared Hub con jerarquía deficiente | PASS | foundation: Shared Hub surface/tabs |
| VIS-004 | Categorías de Shared Hub mal contenidas | PASS | foundation: contained horizontal tabs |
| VIS-005 | Búsqueda de compartidos redundante o desalineada | PASS | foundation: integrated live search |
| VIS-006 | Transición controles/contenido compartido poco pulida | PASS | foundation: unified Surface System |
| VIS-007 | Buscador del chat sobrecargado | PASS | foundation: one primary textbox |
| VIS-008 | Filtros de búsqueda ambiguos | PASS | foundation: progressive filters/defaults |
| VIS-009 | Flujo de búsqueda demasiado manual | PASS | foundation: debounce + live states |
| VIS-010 | Resultados no integrados con navegación exacta | PASS | foundation: nextBeforeSeq + jumpToChatMessage |
| VIS-011 | CTA Buscar sobredimensionado | PASS | foundation: live search without oversized submit |
| VIS-012 | Sin menú Galaxy propio para acciones de mensaje | PASS | foundation: long-press bottom sheet |
| VIS-013 | Selección/callout nativo Android interfiere | PASS | foundation: contextmenu/selectstart suppression |
| VIS-014 | Foto rota expone filename/placeholder técnico | PASS | block2: Galaxy error placeholder + retry contract |
| VIS-015 | Video CameraX rechazado como formato no permitido | PASS | block2 + phase5: ISO-BMFF sniff/metadata/upload validation |
| VIS-016 | Compartir ubicación sin estructura visual clara | PASS | block2: guided Location Surface |
| VIS-017 | Títulos y descripciones de ubicación concatenados | PASS | block2: structured Location Hub layout |
| VIS-018 | Ubicación actual sin affordance de acción | PASS | block2: selectable guided location action |
| VIS-019 | Galaxy Cards sin discovery real | PASS | block3: searchable categorized library |
| VIS-020 | Galaxy Cards sin categorías útiles | PASS | block3: category navigation |
| VIS-021 | Galaxy Cards sin búsqueda integrada | PASS | block3: chatGalaxySearch |
| VIS-022 | Metadata contextual insuficiente | PASS | block3: identity-aware metadata |
| VIS-023 | Títulos largos rompen jerarquía | PASS | block3: multiline/contained card layout |
| VIS-024 | Estados vacíos poco accionables | PASS | block3: actionable empty states |
| VIS-025 | Colecciones grandes sin estrategia de scroll/render | PASS | block3: content-visibility + unbounded source set |
| VIS-026 | Items visualmente similares pueden confundirse/deduplicarse | PASS | block3: identity-aware rows |
| VIS-027 | Acompáñame sin jerarquía visual clara | PASS | block2: guided Acompáñame Surface |
| VIS-028 | Títulos/descripciones pegados en Acompáñame | PASS | block2: structured cards |
| VIS-029 | Acciones y lugares guardados no se diferencian | PASS | block2: guided destination flow |
| VIS-030 | Tarjetas de Acompáñame demasiado altas | PASS | block2: compact Surface layout |
| VIS-031 | Iconos/títulos/descripciones desalineados | PASS | block2: unified layout tokens |
| VIS-032 | Otro lugar guardado sin peso de sección | PASS | block2: guided destination grouping |
| VIS-033 | Copy técnico de Galaxy Context Engine | PASS | block2: user-facing guided copy |
| VIS-034 | Affordance ambigua sobre qué ocurre al tocar | PASS | block2: explicit action flow |
| VIS-035 | Acompáñame se siente lista de datos, no experiencia | PASS | block2: destino → iniciar → estados |
| VIS-036 | Nueva encuesta parece formulario genérico | PASS | block3: Poll Composer 4.1 |
| VIS-037 | Opciones de encuesta en textarea único | PASS | block3: real option rows |
| VIS-038 | Textarea de encuesta sobredimensionado | PASS | block3: bounded row composer |
| VIS-039 | Sin controles claros para agregar opciones | PASS | block3: add option control |
| VIS-040 | Sin controles claros para eliminar/reordenar | PASS | block3: remove + accessible reorder |
| VIS-041 | Ayuda 2–10 opciones aislada | PASS | block3: inline limits/validation |
| VIS-042 | Checkbox de múltiples respuestas inconsistente | PASS | block3: structured advanced options |
| VIS-043 | Cierre opcional ambiguo | PASS | block3: explicit closesAt control |
| VIS-044 | CTA Crear encuesta domina demasiado | PASS | block3: balanced composer hierarchy |
| VIS-045 | Encuesta sin preview / estilos mezclados | PASS | block3: preview + common studio pattern |
| VIS-046 | Nueva checklist parece formulario genérico | PASS | block3: Checklist Composer 4.1 |
| VIS-047 | Ítems de checklist en textarea plano | PASS | block3: independent item rows |
| VIS-048 | Sin agregar/eliminar/reordenar ítems claramente | PASS | block3: shared row controls |
| VIS-049 | Textarea de checklist sobredimensionado | PASS | block3: bounded row composer |
| VIS-050 | Checklist sin preview de cómo se compartirá | PASS | block3: VISTA PREVIA |
| VIS-051 | Título de checklist con poco protagonismo | PASS | block3: title-first hierarchy |
| VIS-052 | CTA Compartir checklist domina demasiado | PASS | block3: balanced composer hierarchy |
| VIS-053 | Poll y Checklist duplican patrón visual deficiente | PASS | block3: shared Composer Studio language |
| VIS-054 | Stickers/GIFs no funcionan como biblioteca real | PASS | block3: Studio tabs/library |
| VIS-055 | Búsqueda GIF depende de integración visible no operativa | PASS | block3 + media validation: server-side GIPHY graceful degrade |
| VIS-056 | Copy expone detalles técnicos de infraestructura | PASS | block3: user-facing copy, backend-only secret |
| VIS-057 | Buscador y CTA aparecen visualmente separados | PASS | block3: integrated debounced search |
| VIS-058 | Sin navegación clara GIFs/Stickers/Nuestros | PASS | block3: Recientes/Favoritos/GIFs/Stickers/Nuestros |
| VIS-059 | Sin exploración: recientes/favoritos/trending | PASS | block3: discovery + trending |
| VIS-060 | Crear sticker propio está escondido | PASS | block3: Studio + existing photo long-press path preserved |
| VIS-061 | Sin biblioteca visible de stickers privados | PASS | block3: Nuestros library |
| VIS-062 | Sin mecanismo claro para incorporar stickers externos | PASS | block3: server-side import-online |
| VIS-063 | Estado vacío consume demasiado espacio / poca utilidad | PASS | block3: actionable loading/error/empty states |
| VIS-064 | Chrome superior de cámara flotante / safe area pobre | PASS | block2: insets + cohesive top chrome |
| VIS-065 | Controles de foto rudimentarios/superpuestos | PASS | block2: premium bottom dock / ≥48dp targets |
| VIS-066 | Video/REC/timer/stop sin jerarquía clara | PASS | block2: REC + timer + explicit stop transition |

### Gates ejecutables del RC
Deben quedar verdes en el HEAD final del PR:
- `npm test`
- `node scripts/qa-android-mobile.mjs`
- `node scripts/phase11-gate.mjs`
- `deno check --node-modules-dir=auto supabase/functions/android-companion/index.ts`
- `deno test supabase/functions/android-companion/media-validation.test.ts`
- Gradle: `testDebugUnitTest lintDebug assembleDebug assembleRelease assembleDebugAndroidTest`
- Instrumentation: `GalaxyDeviceClosureTest`, `GalaxyMediaExperienceTest`, `GalaxyMediaPerformanceTest`, `GalaxyVoiceMessagesDeviceTest` y suites 4.1 aplicables.
- DB/chat correctness, privacy firewall, data integrity y QA real integration.
- Phase 11 torture: P0=0, P1=0, duplicates=0, lostMessages=0, spontaneousScrollJumps=0, criticalCrashes=0, privateResourcesExposed=0.

### Seguridad y privacidad
La regresión de release debe mantener:
- `GIPHY_API_KEY` backend-only y ausente de APK/BuildConfig/bridge.
- FileProvider/`content://` y ausencia de `file://` para media propia.
- signed media URLs y sin paths privados expuestos.
- RLS/chat correctness y privacy firewall.
- ubicación/live location bajo consentimiento; cámara/mic bajo gesto y permisos.
- limpieza de temporales de cámara/media.
- sin logs con contenido privado.
- validación real de MIME/container/tamaño/duración/dimensiones; archivos externos siguen estrictos.

### Performance / Supernova invariants
No se relajan garantías de Supernova: DOM/cache bounded, historial grande, media lazy, originales on-demand, sin full-chat rerender innecesario, Scroll Engine determinístico y Delivery Engine optimista/retry/reconciliation.

### Responsive / visual
Los contratos automatizados cubren 320/360/390 px, landscape, safe areas, font scaling y reduced motion. La regla de cierre sigue siendo:
`documentElement.scrollWidth <= documentElement.clientWidth`.
La instrumentación del PR debe cubrir keyboard/lifecycle/dark-light donde aplique.

### Evidencia
Antes del bump de release, el HEAD funcional `a7185725f2befd9aae52bfdbb77737f66647a5cb` registró 17/17 workflows del PR en SUCCESS, incluyendo Android CI, Phase 11 Torture, Camera/Media, Android Performance, Media Performance, Motion, Chat Correctness DB, Privacy Firewall DB, Data Integrity DB y QA Phase 5 Real Integration. Los commits de release 4.1 disparan una nueva corrida y esa corrida debe quedar completamente verde antes de mergear.

### Physical smoke
**Physical smoke: NOT TESTED** en el HEAD de release porque Desktop Commander reportó `Bati-Compu` offline durante el cierre. No existe evidencia física de este mismo SHA que permita omitirlo. Cuando el Moto g75 5G Android 16 esté disponible por ADB, validar: chat/header/search/long-press, voice hold-lock-cancel-send, photo rear/front, video completo y ausencia del error “formato no soportado”, envío/apertura media, current/live location, Acompáñame, poll, checklist, GIF y sticker; revisar logcat por FATAL EXCEPTION, ANR, SecurityException, SQLiteException, CameraX fatal y WebView crash.

### Riesgos restantes
- P0/P1 funcional automatizado: ninguno conocido antes de la corrida final de release.
- Riesgo de cierre: smoke físico de hardware aún no ejecutado en el SHA final.
- No mergear el PR si la corrida final introduce FAIL, skips no justificados, P0/P1 o regresiones de versionado.
- No ejecutar android-stable automáticamente.

### Rollback / promoción
La gobernanza sigue `docs/RELEASE_GOVERNANCE.md`. El push a `main` puede producir candidate, nunca reemplazar stable. La promoción estable requiere aprobación explícita posterior, Run ID válido, ledger completo, staging smoke VERIFIED, firma/checksum/upgrade PASS y las confirmaciones de seguridad vigentes.
