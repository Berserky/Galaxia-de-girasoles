# P8 — campaña Android integrada local (29/oct/2026)

**Estado: evidencias parciales verificadas. P8 NO CERTIFICADO / PR #204 DRAFT / no merge ni deploy.**

## Fuente, equipo, aislamiento y trazabilidad

- Repositorio: `Berserky/Galaxia-de-girasoles`; HEAD remoto al abrir campaña `68b49d13e79896787da9f2085519040928e6299d`. Único árbol local aislado: `NG-V5-P8-20261028-isolated`. Las modificaciones nuevas de instrumentación y QA deberán publicarse y verificarse en el nuevo SHA final.
- AVD exclusivo de QA `NG_V5_P8_ISOLATED_API35` (API 35 / Google APIs x86_64); `-gpu host` en PC Radeon integrada; Android Emulator 37.2.12. **No** se utilizó base productiva, pareja real, medios reales ni ubicación personal. Parámetros QA `localhost` y datos sintéticos.
- Evidencia restringida a `build/p8-local-avd/` (ignorada por Git). Sin duplicar imágenes privadas en el repositorio.

## Evidencia real, no sintética del navegador

1. **P5**: `GalaxyDeviceClosureTest.visualEvolutionP5_realMomentsAndroidScreens_andPrivacy` — Gradle `BUILD SUCCESSFUL`, XML JUnit **1 PASS / 0 FAIL / 0 SKIP**, 15 PNG reales distintos (4 anchos CSS 320/360/393/412, 4 pruebas de tamaño de fuente 135%, 7 temas). Archivo local `build/p8-local-avd/p5-evidence/native-p5-frames.json`.
2. **Navegación P6/P7 y regresión**: cuatro métodos Android reales en una sola ejecución `connectedDebugAndroidTest` — **4 PASS / 0 FAIL / 0 SKIP**, cubrieron Memorias, Mapa, paneles de respaldos/actualizaciones, privacidad con estado inmutable, temas oscuros, fontScale y navegación/rotación. Log `build/p8-local-avd/p8-cross-navigation-p6-p7-hostgpu.log`.
3. **Capturas P6/P7 añadidas**: método `visualEvolutionP8_realMemoriesMoreScreens_andPrivateControls` — **1 PASS / 0 FAIL / 0 SKIP**, seis capturas Android nativas de 1080×2400: Descubrir, Colecciones, Nuestra historia, Privacidad, Datos y copias, Sistema y actualizaciones. Se detectó que las primeras tres capturas de Más eran iguales; se corrigió desplazamiento real a cada grupo, se repitió instrumentación y se verificaron **6 SHA256 diferentes**. Log `build/p8-local-avd/p8-memories-more-visible-native.log`; manifiesto `build/p8-local-avd/p6-p7-evidence/native-p6p7-frames.json`.
4. Se preservaron los controles estrictos `awaitV5QaPainted`, navegación real, validación de privacidad, screenshot PNG físico y permisos intactos. **Verificación visual humana completa aún pendiente.**

## Riesgos y siguientes gates (no declarar PASS sin evidencia)

- Completar auditoría de **todos** los métodos Android y las clases de Media/Voice en los shards sin perder casos. `scripts/p8-verify-phase11-shards.mjs` exige XML JUnit, cobertura exactamente una vez, cero errors/failures/skips.
- Confirmar P6 con foto/audio/video reales y estados offline/error, Drive y cápsulas selladas; P7 revocación de dispositivos, restauración segura, GPS, push, temas y opciones sensibles; TalkBack y estados 0/8 del jardín. Una pantalla visible no basta para certificar estas funciones.
- La CI del commit `68b49d1` terminó **11/15 SUCCESS, 4 FAILURE**: tres jobs AVD aún desconectaron `emulator-5554` y Phase8 Motion falló al descomprimir SDK; recuperación acotada de SDK preparada en el clon, no incorporada aún al HEAD. No reducir gates para aparentar verde.
- Mantener PR #204 como DRAFT y no fusionar a `desarrollo`, ni desplegar `qa`/`prod`, hasta validar el SHA final y aprobación del dueño.

## Hallazgos del primer shard Android amplio (host GPU)

- Al ampliar la instrumentación de `GalaxyDeviceClosureTest` se detectaron **dos fallos reales** dentro de 17 casos programados del shard 0; no declarar suite verde:
  - `galaxyChat_phase1MessageEngine_windowingAndLifecycleAreMeasured`: el acceso real `#chatFab.click()` no llegó a `view='chat'` en 30 segundos, `fabPresent=true`, `fabHidden=false`, `chatEnabled=true`, `paired=true`. Se añadió manejo directo reutilizando el mismo desbloqueo y permisos, más `chatOpenPhase` y telemetría sintética para depurar sin datos privados; **todavía falta validación nativa**.
  - `visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe`: prueba física registró colisión exactamente igual entre `fab` y `add` (ambos `x≈342,y=690,w=52,h=52`) en 412×842 CSS. Se identificó transición `bottom` aplicada mientras aparecía una acción flotante y se reemplazó por transición de `transform/box-shadow` para reposicionamiento instantáneo seguro. **La corrección necesita confirmación nativa**.
- El método nuevo de capturas P6/P7 pasa en Android (1/1 JUnit). La primera revisión de fotos mostró tres PNG idénticos de Más, lo cual **no fue aceptado**. Se añadió `scrollIntoView({block:'start',behavior:'instant'})` y condición de rectángulo visible para cada grupo, se repitió Android y se verificaron **seis PNG diferentes** con controles presentes. No se cambiaron respaldos, permisos ni rutas server-verified.
- Los `24` métodos `GalaxyDeviceClosureTest` deben ejecutarse por shards con JUnit completo y todos PASS; `tests/p8-verify-phase11-shards.test.mjs` fue sincronizado a 24. El detalle por SHA estará en el reporte de CI posterior. No publicar con los dos fallos anteriores.

## Correcciones posteriores y regresión focalizada

- **Interfaz flotante / P1:** la medición nativa anterior demostró que `#chatFab` y el botón temporal `.floating-add` tenían la misma posición exacta `(342,690,52,52)` a 412×842 CSS al entrar/salir del reproductor. El estilo de V5 animaba `bottom` desde la posición anterior. Ahora la transición sólo anima `transform` y `box-shadow`, conservando la posición `bottom` final y evitando frames intermedios de colisión. **Regresión Android real P1 PASS** al repetir en el host con GPU.
- **Chat / Phase1:** con el test genérico se observó `chat=false,route=home,chatOpenPhase=idle` tras 30s. Se centralizó el flujo de apertura en `openGalaxyChat`, con escucha directa en el FAB persistente y fallback de acciones delegadas; ambas conservan `unlockChat`, `native.paired` y `cloud.capabilities.chat`. La prueba `galaxyChat_phase1MessageEngine_windowingAndLifecycleAreMeasured` se ajustó para llamar `launchChat()`, que **siempre pulsa el botón real**, comprueba la ruta, chat-state y el foco. **Android real Phase1 PASS (1/1 JUnit)** en ejecución focalizada; no hay bypass ni llamada `go('chat')` desde el test.
- **Node/contratos** del árbol local: `npm test` **1033: 1028 PASS, 0 FAIL, 5 SKIP**; `node scripts/qa-android-mobile.mjs` PASS; `git diff --check` PASS.
- Estas correcciones se probaron focalmente. **La campaña de cobertura completa por dos AVD frescos y required checks GitHub del SHA final sigue siendo obligatoria** antes de declarar P8 completo.

## Campaña completa de 24 métodos: segundo diagnóstico + fixes

- **Shard 0 inicial en GPU host, 17 de 17 métodos ejecutados:** 16 PASS / 1 FAIL. La única falla nativa fue `visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe`, accesibilidad del filtro «No leídas» a ancho CSS 320, `getBoundingClientRect.height < 44` al interactuar. No se trató de QEMU ni de Chat: la regresión Phase1 de Chat ya pasó previamente.
- **Causa y corrección de producto:** `.v5-notification-filter` tenía `min-height:44px`; el feedback global `button:active { transform: scale(.985) }` reducía temporalmente el rectángulo real. Ajuste del módulo `galaxy-discovery-v5.css` a `min-height:48px`, que mantiene ~47px bajo presión, sin quitar animación, controles ni escenarios. Regresión Android focal `visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe` **1/1 PASS / 0 fallos** en GPU host, Gradle `BUILD SUCCESSFUL in 2m13s`, log `build/p8-local-avd/p8-touch48-native.log`.
- **Node del árbol de correcciones:** `npm test`: **1034 total / 1029 PASS / 0 FAIL / 5 SKIP**; QA móvil PASS, `git diff --check` PASS. Tests incluyen nuevo contrato para 48px con factor `.985`.
- **Sin garantía de cierre todavía:** se reinicia el AVD aislado limpio para repetir shard 0 tras el último fix, luego shard 1 y Media/Voice. No heredar resultados entre compilaciones, no dar los 19 gates por cumplidos.

## Cierre de la batería completa de dispositivos — 29/oct/2026

- **Shard 0, versión de código con los fixes incluidos:** `p8-shard0-touch48-final.log` y `p8-shard0-final-junit.xml`: **17/17 PASS, 0 FAIL, 0 SKIP**.
- **Shard 1, mismos archivos y mismo APK de prueba:** `p8-shard1-seven-hostgpu.log`, `p8-shard1-final-junit.xml`: **7/7 PASS, 0 FAIL, 0 SKIP**, `BUILD SUCCESSFUL in 1m34s`.
- **Media/Voice, mismo candidato:** `p8-media-voice-hostgpu.log`, `p8-media-voice-final-junit.xml`: **4/4 PASS, 0 FAIL, 0 SKIP**, `BUILD SUCCESSFUL in 34s`. Corresponden a tres métodos `GalaxyMediaExperienceTest` y uno `GalaxyVoiceMessagesDeviceTest`.
- Verificación automatizada con `node scripts/p8-verify-phase11-shards.mjs build/p8-local-avd/p8-real-junit-shards`: `VERIFIED_REAL_ANDROID`, **`EXACTLY_ONCE`**, `closure-0=17`, `closure-1=7`, `media=4`, **28 casos únicos; cero fallos, errores u omitidos**. Se compararon contra 24 métodos de `GalaxyDeviceClosureTest`, 3 Media y 1 Voice, sin faltantes ni duplicados. Los tres XML completos y el recibo `receipt.json` permanecen solo en el clon QA, bajo `build/p8-local-avd`.
- Verificación final Node del mismo árbol local: `npm test` **1034 total / 1029 PASS / 0 FAIL / 5 SKIP**, `node scripts/qa-android-mobile.mjs` **PASS**, `git diff --check` **PASS**.
- **Limitación:** esto certifica estrictamente los **28 casos Android de estas tres clases** en el emulador local con `-gpu host`. No certifica por sí solo todos los **19 gates P8**, la interfaz completa con TalkBack, todas las funciones sensibles P6/P7 o los required checks GitHub del SHA final. No fusionar ni publicar automáticamente.

## Nueva prioridad cerrada: extremos del jardín P8-08 (29/oct/2026)

- Se añadió el test nativo `visualEvolutionP8_realBondGardenZeroAndEightStages` en `GalaxyDeviceClosureTest`, **sin demo ni datos de pareja reales**. Comprueba etapas oficiales **0 y 8** procedentes de un fixture local del estado Bond autenticado, el número real de `.ng-plant` (0 y 8), `data-official-stage`, `data-demo=false`, el título visible y la pintura física mediante `awaitV5QaPainted`.
- Se detectó un detalle real de interfaz: cuando la respuesta Bond omitía `garden.label`, las etapas 0 y 8 decían ambas «Nuestro girasol». Se corrigió el fallback: **«El comienzo»** para la etapa 0 y **«Ocho girasoles»** para la 8, sin sobrescribir las etiquetas oficiales del servidor. Se confirmó mediante la misma prueba nativa tras recompilar el APK.
- **Android de esta iteración: 1/1 JUnit PASS, 0 FAIL, 0 ERROR, 0 SKIP; Gradle BUILD SUCCESSFUL in 35s**. Evidencias en `build/p8-local-avd/p8-garden-zero-eight-evidence/`: dos PNG físicos 1080 × 2400 (aprox. 1.0 MB y 1.3 MB), hashes SHA256 distintos y XML JUnit real. No subir capturas al repositorio.
- Combinado con la prueba P5 anterior de **etapa 3**, las etapas **0/3/8** ya tienen evidencia Android real; **la expansión posterior a ocho girasoles aún no ha sido validada visualmente en el dispositivo**, por lo que P8-08 permanece PARTIAL.
- **No afirmar 29/29 JUnit del mismo binario**: la batería previa 28/28 fue sobre el árbol previo a la adición del método 29, mientras el nuevo método 0/8 pasó focalmente sobre el árbol actualizado. El nuevo SHA debe cumplir la campaña consolidada y el cierre global P8.
- **CI histórica SHA 244148f:** 12/15 SUCCESS, 3 FAIL (Phase5/Phase11/V5 P0 con pérdida del AVD). No anular required checks por el éxito Android local.
- **Validación de código tras la corrección de rótulos:** `npm test` **1036 total / 1031 PASS / 0 FAIL / 5 SKIP**; `node scripts/qa-android-mobile.mjs` **PASS**, `node --check` y `git diff --check` **PASS**.

## Expansión oficial de Bond, prueba local

El 29/oct se desarrolló el contrato aditivo `bloomTotal` en `bond-engine.ts` y su lectura validada por puente/renderer Android. La expansión **9/22/23** conserva el esquema oficial de nueve hitos, es reproducible sin red y no habilita modo demo. Las capturas `V5-P8-official-expansion-8/9/22/23.png`, más el XML JUnit de **1/1 PASS** y cero omisiones, están en `build/p8-local-avd/p8-authenticated-expansion-evidence/`. Se verificó que la etiqueta accesible de expansión tiene el número real de flores; fallback del payload antiguo continúa en ocho. Los cuatro tests Node de progresión pasan y la suite local completa terminó **1035 PASS / 0 FAIL / 5 SKIP**. Véase `P8_BOND_GARDEN_EXPANSION_20261029.md`.

**P8 continúa NO CERTIFICADO** hasta CI del SHA nuevo, 30 casos Android sobre ese mismo SHA y aceptación visual más pendientes funcionales P6/P7.
