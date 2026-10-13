> **Estado verificado 13-oct-2026, P2-G:** `6fd71a4` completó **15/15 GitHub Actions SUCCESS**, incluyendo Android Phase5, Phase11, CameraX y V5 real WebView. Al analizar el [artefacto Android #11852377142](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38472503407/artifacts/11852377142), se detectó una **brecha de evidencia**: las cuatro capturas `p2-bottom-viewports` presentan los mismos píxeles centrales que las `p1-responsive-viewports` pese a la aserción JS `scrollY` al final. **No se acepta prueba visual de scroll inferior en ese SHA**. La rama añadió `awaitV5BottomFramePainted` con confirmación de dos capturas sucesivas del display real y 15% de píxeles distintos fuera de barras fijas, más contrato Node. Si no se ve scroll verdadero, fallará la prueba y se investigará (no se marca PASS por geometría del DOM). El CI del nuevo HEAD no está aún cerrado. PR [#168](https://github.com/Berserky/Galaxia-de-girasoles/pull/168) DRAFT; ni merge ni despliegue. La revisión estética humana sigue pendiente.

# Visual Evolution 5.0 · P2 — Galaxy Welcome

**Estado:** P2-A implementado en rama aislada; QA y aceptación visual PENDIENTES. **Inicio:** 2026-10-13.
**Base exacta:** desarrollo f12ed0ee526988a90ddf0e32e6ee66772a161c07 (P1 aprobado, PR #167 fusionado).
**Rama:** feat/visual-evolution-5-p2-galaxy-welcome. **Épica:** #160.

## Alcance de este primer corte, no del P2 completo

- VE-002/003: bienvenida con identidad contextual, profundidad visual sobria, sin nueva llamada a servidor
- VE-004/009: métricas de historia basadas en los datos originales; botones reales hacia Recuerdos y Momentos; no inventar días si falta fecha inicial
- VE-006/007/008: calendario, Un día como hoy y encuentros en una grilla de destacados, preservando handlers
- VE-012/025/026/027: resumen de conexión integrado en una sección, detalles de ubicación en un disclosure accesible y bento de cinco acciones, sin retirar permisos ni funciones
- VE-019/020/021: estado emocional con aria-pressed, título humano para pregunta diaria y respuesta autoexpansible con límites
- VE-028: fecha próxima no se repite si ya está presentada por el momento destacado cercano

**Ningún ID se marca completo** hasta validar render real, estados y aprobación estética. Lo restante de VE-002–029, y los criterios transversales VE-032–034, se mantiene pendiente.

## Archivos

- Android WebView únicamente: app.js, index.html y nuevo galaxy-welcome.css; no se modifica web/PWA, Chat, IA ni GPS/FCM.
- Node: tests/visual-evolution-p2.test.mjs verifica activos, rutas, compatibilidad, privacidad y estilos.
- Los componentes originales (monthlySummaryTeaser, todayHistoryTeaser, encounterStatsTeaser, coupleDistanceCard, nowCard, dailyQuestionCard, livingMomentCard, personCard, actionCard) siguen reutilizados.

## Plan de QA y gates

| Prueba | Estado inicial | Exigencia |
|---|---|---|
| Node 24 completa y P2 contract | PENDIENTE | sin regresiones, no quitar data-actions |
| Android unit/lint/build | PENDIENTE | APK de QA empaqueta galaxy-welcome.css |
| AVD instrumentado de 7 temas y 4 anchos | PENDIENTE | capturas reales y comparación antes/después con P1 |
| Contraste/targets/nav/scroll al final | PENDIENTE | 320/360/393/412 y fuente grande |
| Teclado, modales, player+FAB y privacy disclosure | PENDIENTE | no solapar ni filtrar información |
| Aprobación visual propietario | PENDIENTE | separada del CI |
| PR merge desarrollo, qa/prod | NO AUTORIZADO | no fusionar ni publicar automáticamente |

**Cuidado:** el Home usa datos existentes; privacidad GPS depende de permisos previos y frescura del motor, no se redefine aquí. El nuevo <details> solo organiza una vista ya expuesta para usuarios vinculados. No se agregan dependencias, migrations ni cambios de versión.

**Rollback:** revertir PR P2, sin esquema de datos ni pérdida de contenido.

## QA incremental P2-A · Android scroll/geometry (sin PASS hasta CI)

- Se añadió verificación real Android por cada ancho CSS 320/360/393/412: hero dentro del viewport, 5 acciones bento, ausencia de desbordamiento horizontal, desplazamiento completo y última tarjeta **por encima de la barra fija**.
- Evidencias nuevas `build/p0-avd/p2-bottom-viewports/{320,360,393,412}.png` exportadas por script; JUnit y recibo JSON deben verificar 4/4. Antes de terminar CI: **PENDIENTE**.
- Se eliminó un límite artificial de caracteres que no pertenecía al contrato original de respuesta de la pregunta diaria.

## Regresión reproducible de próxima fecha (13-oct-2026)

- En HEAD `418e2dc`, QA Phase 5 y Phase 11 Android fallaron en el mismo caso `dailyGoalsPlansEventsCapsulesMapContextBackupAndUpdate_areReachable`: XML JUnit `GalaxyDeviceClosureTest.java:864` exige texto visible `PRÓXIMA FECHA`. El Home P2 ocultaba la tarjeta duplicada cuando el evento próximo ya figuraba como momento destacado, pero el destacado tenía otro rótulo.
- Corrección P2-A: se sigue evitando la tarjeta duplicada, pero el destacado reutilizado muestra `PRÓXIMA FECHA` cuando efectivamente enseña el evento. La función de tarjeta conserva comportamiento anterior para el resto de estados.
- Contrato Node P2 ampliado y aserción de Android preexistente mantenida **sin suprimir tests ni aflojar seguridad**. Resultado final **PENDIENTE** hasta completar CI del SHA que contiene esta corrección.

### Compatibilidad del test histórico (13-oct-2026)

- Se conserva la firma **`function livingMomentCard()`** que utiliza `tests/android-insights.test.mjs` para delimitar el bloque de aniversario derivado. No se cambia el contrato histórico ni se desactiva su test.
- Cuando `livingMoment()` presenta la próxima fecha, el rótulo de **esa misma tarjeta** cambia de «Se acerca algo especial» a «PRÓXIMA FECHA»; ningún componente extra, evento duplicado o petición adicional. Comprobar P2/Node completo y Android en el nuevo SHA antes de aprobación.

## P2-B · Calidad de presencia en Inicio (13-oct-2026)

**Motivo:** El nuevo `nowPersonCard` del Inicio heredaba velocidad de un registro GPS aunque su última lectura fuera antigua, y consumía presencia de `settings.data.presence` pese a que `normalizedPresence` ya admite filas más recientes de `cloud.presence`. Ello daba apariencia de telemetría en vivo sin frescura comprobada.

**Corrección implementada en la MISMA rama aislada:**
- Reutiliza `locationFreshState`, `locationAgeMs`, `distanceAgeLabel` y `ageDurationLabel`, sin cambiar API ni clasificación de GPS.
- Diferencia ubicación pausada, sin lectura, desactualizada y reciente; velocidad solo si hay lectura fresca y un número válido.
- Un `speed: null` nunca se presenta como 0.0 km/h. Actividad/mood de hoy permanece independiente de GPS.
- Fuente `normalizedPresence` única para batería y canción compartida de la pareja; respeta `shareBattery` / `shareListening` y oculta porcentajes fuera de 0–100.
- «Tu persona» reemplaza el ambiguo badge «Ahora» para no simular presencia en tiempo real.
- Tres pruebas Node de comportamiento con escenarios sintéticos: GPS antiguo, velocidad ausente y privacidad con GPS pausado. No contienen fotografías, ubicaciones privadas ni tokens.

**Cobertura de hallazgos:** VE-010/013/014/015/016 en curso; **sin cerrar IDs** hasta Android AVD y aceptación visual. VE-011/017/018/022/023/024/029 pendientes para el siguiente incremento.

**Estado de CI por revisión:**
- `e3609aca` (P2-A, antes de este parche): 15/15 workflows SUCCESS confirmados sobre ese SHA.
- Los nuevos commits P2-B requieren nuevamente `npm test`, Android QA, JUnit y APK para declarar PASS. **No trasladar automáticamente el 15/15 anterior.**
- Verificar explícitamente los tests sobre `nowPersonCard` y que no se alteraron GPS/FCM, permisos, RLS ni acciones de Chat.
- AVD no sustituye pruebas físicas de GPS y privacidad. Revisión visual 7 temas, 4 anchuras, keyboard/FAB/scroll y aceptación del propietario siguen pendientes de cierre final.

**Protecciones:** PR #168 continúa DRAFT, `desarrollo` no se modifica por P2-B; `qa` y `prod` siguen en 4.1.2.

## P2-B · Selector emocional responsivo y accesibilidad

- Hallazgo VE-018: la cuadrícula original de cinco columnas con texto de 11px comprimía «Sin energía» y estados similares.
- P2 adapta el selector a **tres columnas por debajo de 540px**, cinco columnas a partir de 540px, control con altura mínima de 56px, fuente de 13px y foco visible.
- Preserva los cinco `data-action="mood"`, las claves, `aria-pressed`, los eventos existentes y el motor de guardado; solo CSS visual.
- Prueba Node de contrato añadida al archivo `tests/visual-evolution-p2.test.mjs` para prevenir regresar al selector comprimido.
- **Pendiente**: verificar en artefactos Android de los cuatro anchos y siete temas, fuente ampliada, teclado y respuesta de guardado/error; no cerrar VE-018 aún.
- El último SHA con cambios de selector deberá revalidar los 15 workflows; los PASS anteriores no se transfieren.

## P2-C · Pregunta diaria y contrato de privacidad (13-oct-2026)

- VE-022/023: las tres acciones existentes (Galaxy Chat, Barajas, Guardar como recuerdo) se mantienen accesibles; se ordenan en grid 2 columnas para teléfonos compactos y 3 columnas desde 540px, con objetivos táctiles de altura mínima de 44px. El favorito tiene objetivo táctil 44x44. No se cambia ningún `data-action`, endpoint, persistencia ni flujo de consentimiento.
- VE-024: contador visible y accesible `0/1/2 de 2 respuestas listas` basado **exclusivamente** en las respuestas que el estado del usuario ya entrega al cliente. Nunca incluye el texto privado en `data-title`, rutas compartidas ni payloads nuevos. `role=status` facilita tecnología asistiva. Respeta la regla existente que impide crear un recuerdo conjunto hasta que ambos respondan.
- VE-010/014, robustez: `nowPersonCard` exige latitud y longitud no nulas y marca como no verificables timestamps futuros más de 60s antes de reutilizar `locationFreshState`; datos insuficientes nunca se presentan como GPS en vivo o velocidad. El motor de tracking, `GalaxyDistance` y el mapa NO se modificaron.
- Pruebas Node con VM aislado de `dailyQuestionCard` para estados 0/1/2 y acciones; con ubicaciones sintéticas ausentes/futuras para ocultamiento de movimiento/velocidad. CSS de estado y controles verificado por contrato.
- **No declarar PASS sin CI del HEAD vigente**. Verificar Android instrumentado, fuente grande, contraste, modal/IME, privacidad y aprobación del propietario. Todos los IDs anteriores permanecen ABIERTOS hasta su evidencia.

## P2-D · Cierre de gates Android en CI (13-oct-2026)

**Resultado confirmado de HEAD `1024512` antes de este incremento:** 13/15 GitHub workflows SUCCESS, dos FAIL. Se confirmó **Galaxy Chat Phase 11 Torture SUCCESS** (ambos jobs: instrumentación stress y gate Node). El arreglo de volver desde `ACTION_OPEN_DOCUMENT` pasó la prueba instrumentada real; nunca se sustituyó por mocks ni se saltó el retorno de la WebView.

**Riesgos/bloqueos detectados (sin ocultar fallas):**
- `V5 P0 baseline and synthetic visual preview`, job `AVD QA unpaired APK`: `visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe` falló en `runJs` para clic del botón Inicio, con timeout de callback JavaScript de **5s** en emulador tras una matriz de arranques en frío. APK startup, capturas unpaired y mediciones brutas sí se generaron, pero el workflow es **FAIL**. No atribuir causalidad al render sin repetir el test.
- `Galaxy Chat 4 Phase 5 Camera Media`, job CameraX emulator: `cameraX_photoRearFrontReviewRetakeAndCancel_whenCameraExists` falló con *Camera switch did not bind the front lens.* La prueba anterior usaba `tapVisibleCameraControl`, `sleep(600)` y luego comprobación única, sin esperar asincronía de CameraX. Los otros 2 casos de la misma matriz no fallaron.

**Endurecimiento implementado solo en pruebas (sin cambiar código productivo):**
- La instrumentación V5 usa `runV5Js` con timeout delimitado de 20s **y aserción explícita de que JS devolvió `ok`** para 11 acciones V5 de navegación, tema, scroll y limpieza. Chat y el resto de tests mantienen plazo original de 5s; las capturas reales, marcador de píxeles y contraste permanecen obligatorios.
- La instrumentación CameraX reemplaza sleeps fijos por `awaitCameraLensBound` (máximo 12s), validando con CameraX el sensor trasero/frontal realmente vinculado. Si el emulador reconoce el toque pero no lo entrega, se permite **una** segunda pulsación real mediante MotionEvent de ventana **solo si** `lensFacing` interno nunca cambió después de 3s. Si cambió, se espera el bind sin pulsar dos veces. Si no vincula, **FAIL**. Conserva foto, revisión, retoma, vídeo y borrado de temporales obligatorios.

**Estado de salida:** revalidar CI de HEAD actual (este ledger no certifica PASS por adelantado), evidencia del runner Android V5 y CameraX, revisiones por temas/ancho/IME y aprobación estética humana. PR #168 DRAFT; **no merge a desarrollo ni promoción QA/prod**. IA excluida.

## P2-E · QA Phase 5: retorno real desde selector de archivos (13-oct-2026)

**Baseline `3650970`: 14/15 workflows GitHub PASS y uno FAIL**. En particular, V5 P0 baseline/synthetic visual preview, CameraX Phase 5 y Galaxy Chat Phase 11 Torture **PASS** en el mismo SHA. El único FAIL fue `QA Phase 5 Real Integration` ([run #38468053525](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38468053525)), job `Android instrumentation + lifecycle`, JUnit `cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem`, mensaje `Android did not handle Back while closing document picker`. La prueba posterior `visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe` también encontró la pantalla Inicio oculta; no basta atribuirlo a la UI.

**Corrección:** `cancelPickerAndVerifyForeground` conserva tres intentos acotados de cierre del selector mediante input Android real; si `UiDevice.pressBack()` devuelve falso (acknowledgement no fiable del emulador), envía un evento Android `input keyevent KEYCODE_BACK`. El test solo pasa con **`isResumedPackage(appPkg)` Y `document.visibilityState === 'visible'`**, nunca por el retorno booleano. La ruta del proveedor solo se fuerza a detener en emulador, nunca en teléfono físico. Contrato `tests/ng-phase4-android-harness.test.mjs` actualizado para exigir fallback Android real, evidencia de reanudación y prohibir el antiguo check superficial.

**Criterio de salida obligatorio:** CI Node + 15 workflows del nuevo HEAD; recuperar 34 casos instrumentados QA Phase5, V5 Android, CameraX y Galaxy Chat11 sin FALLAS; mantener marker de píxeles para screenshots reales, no cerrar hallazgos VE antes de revisión visual y aceptación humana.

**Protecciones:** la corrección está únicamente en instrumentación Android/tests/doc de la rama P2. Ninguna lógica de producto, Chat, GPS, FCM, IA, permisos, producción ni despliegue se alteró. PR #168 sigue DRAFT.

## P2-F · Coherencia GPS en tarjeta detallada (VE-014) — 13-oct-2026

**Auditoría adicional:** aunque el resumen de la conexión `nowPersonCard` ya había dejado de inventar 0 km/h, la tarjeta secundaria `personCard(l)`, visible al abrir `Ver estado detallado de ubicación`, seguía aplicando `Math.max(0,Number(l.speed||0)*3.6)`. En una lectura GPS reciente con `speed:null`, ello mostraba erróneamente `0.0 km/h` y una actividad aparente de marcha; el detalle contradice el resumen. El origen es local a la visualización, no al motor GPS ni a los permisos.

**Cambio implementado en rama P2:**
- Se reutiliza `locationFreshState`, pero se requiere también coordenadas NO nulas, timestamp legible y que la hora del registro no esté a más de 60 segundos en el futuro.
- Sólo se calcula velocidad cuando `speed` no es nulo, es finito y no negativo **y** el fix es fresco; de otro modo el detalle usa `— km/h` con etiqueta accesible `Velocidad sin lectura`.
- Diferencia el estado `Ubicación pausada`, `Sin lectura GPS reciente`, `Hora del dispositivo por verificar` y `Sin actualizar · hace ...`. El modo de transporte no se anuncia como dato actual en esas condiciones.
- Se conserva la lectura **cero explícita** si el sistema realmente la envió: no se sustituye por otra velocidad ficticia.
- No se alteran `GalaxyDistance`, `transportLabel`, `coupleDistanceCard`, `Map`, RLS, API, tracking, roles, controles de privacidad ni carga de datos.

**Regresión añadida en `tests/visual-evolution-p2.test.mjs`:** casos VM herméticos para speed `null`, `undefined`, inválido, negativo, 0 explícito, número válido, sin coordenadas, timestamp futuro, ubicación obsoleta y compartir pausado. Se verifica la misma función productiva que usa el detalle.

**Gobernanza CI:** el commit `3598fbd` tenía 13/15 SUCCESS y 2 en progreso cuando se comenzaron nuevos cambios; la política de concurrencia de GitHub finalmente canceló esos dos, por lo que **no equivale a 15/15**. Las pruebas y el producto P2-F requieren 15/15 sobre el nuevo HEAD estable; no transferir PASS de commits anteriores. Hallazgo VE-014 permanece abierto hasta pruebas instrumentadas y aprobación visual del propietario.

**Sin autorización:** PR #168 DRAFT, ninguna fusión a `desarrollo`, `qa` ni `prod`.
