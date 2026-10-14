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

## P2-K · Accesos rápidos con contexto verificado (VE-027 / VE-029) — 14-oct-2026

**Baseline antes de implementar:** PR #168, `d6809fd`, **15/15 workflows GitHub SUCCESS** sobre la misma revisión, incluyendo Android Phase5/Phase11, CameraX, las siete apariencias y capturas del **scroll real** en cuatro anchuras. La aprobación estética del propietario y el cierre integral de P2 siguen pendientes.

**Hallazgo:** las cinco acciones bento de Inicio conservaban su funcionalidad, pero eran difíciles de distinguir visualmente por propósito y carecían de microcontexto útil. No se justifica un endpoint adicional ni insertar en el DOM respuestas íntimas, ubicaciones, canciones o nombres de registros solo para decorar accesos.

**Implementación en rama aislada:**
- Cada botón conserva su `data-action` original y sus textos/íconos; añade categoría semántica breve: **EXPLORAR, CONECTAR, CREAR, PLANEAR, AVANZAR**. CSS local, texto adaptable, foco visible, 320px y sin dependencias/migraciones.
- Únicamente se añaden microresúmenes **si el estado ya cargado los demuestra**: cantidad no nula de planes sin marcar `done`, recuerdos existentes, días de jardín válidos y objetivos en marcha (solo desde `goalsState` si fue cargado hace menos de tres minutos). No se dispara `loadGoals` desde Inicio ni una llamada de red.
- Si no existen datos, no están cargados o están obsoletos, el contador se **omite**, no se muestra un «0» inventado. No se insertan títulos, localizaciones, respuestas, nombres ni objetos privados como metadatos o atributos.
- Nuevas regresiones herméticas `tests/visual-evolution-p2.test.mjs`: cinco rutas, categorías, datos ausentes/presentes, pluralización, ahorro de llamadas, cache caducada y protección de títulos privados. Mantiene tests históricos Android de scroll inferior / imagen física.

**QA posterior obligatorio:** 15/15 workflows en el HEAD que reúna código/CSS/tests y este ledger. Comprobar capturas Android V5 a 320/360/393/412, seven themes, navegación, contacto con FAB y barra inferior, texto largo/fuente grande, teclado/estados vacíos y aprobación visual humana. Los IDs VE-027/029 están **EN CURSO**, no cerrados. No tocar IA, Galaxy Chat central, GPS/FCM, backend ni QA/prod; PR #168 permanece DRAFT sin permiso para fusionar.


## P2-L · Acceso directo y accesible a controles de privacidad (VE-017) — 14-oct-2026

**Baseline verificado:** el corte P2-K `71401bc` pasó **15/15 workflows SUCCESS** en GitHub. La primera ejecución obtuvo 12/15 (fallos instrumentación Phase5, captura blanca onboarding y resolución transitoria de dependencias CameraX); se reejecutaron **solo los jobs fallidos**, y los tres quedaron finalmente `success` **sobre el mismo SHA**. Evidencia y enlaces a runs en comentarios del [PR #168](https://github.com/Berserky/Galaxia-de-girasoles/pull/168). Capturas reales P2-K en Android: scroll inferior correcto en 320/360/393/412 y siete temas; no extrapolar aprobación estética del propietario.

**Hallazgo VE-017:** el control `Privacidad` de la tarjeta «Cómo estamos» usaba `go('more')` seguido de `setTimeout(...,80)` para hacer scroll a `.privacy-grid`. Ese retraso arbitrario no aporta garantía de foco, ni permite distinguir el destino al lector de pantalla; un render lento puede perder el salto aunque los permisos permanezcan intactos.

**Solución limitada a interfaz Android:**
- `openPresencePrivacySettings()` navega a Más con la función existente `go('more')` y accede inmediatamente al panel real por `#presencePrivacySettings` después del render síncrono. `scrollIntoView({behavior:'auto',block:'center'})` evita animaciones forzosas y `focus({preventScroll:true})` fija el foco en el bloque correcto sin scroll adicional.
- El bloque de privacidad real conserva sus **tres acciones anteriores** (`presence-battery`, `presence-listening`, `map`), textos y reglas de permisos; incorpora `role="region"`, `aria-labelledby` y `tabindex="-1"` solo como destino de foco. El panel usa `scroll-margin-block` para barra fija y outline perceptible en los temas de V5.
- Si el bloque no existe, no lanza excepciones, no intenta tocar interruptores y conserva navegación a «Más». **Ninguna llamada API, migración, permiso, estado GPS/FCM, ni modificación de privacy backend**.
- `tests/visual-evolution-p2.test.mjs` ejecuta mediante VM la función real y comprueba orden navegar → localizar → desplazar → enfocar, caso panel ausente, ningún timeout/red, nombres y existencia de los tres handlers.
- Android JUnit `GalaxyDeviceClosureTest.visualEvolutionP2_privacyShortcut_opensFocusedControlsWithoutChangingSharing`: abre Inicio con estado QA real, activa el botón existente en la WebView empaquetada, exige que navegue a Más, que el panel esté realmente dentro del viewport y enfocado con `role/aria-labelledby`, que conserve exactamente tres controles con sus acciones originales y que los flags batería/música/GPS sean **idénticos antes y después de navegar**. No se deshabilita por permisos ni excepciones.

**Salida obligatoria P2-L:** validar nuevamente los **15/15 workflows sobre el nuevo SHA**; verificar Android onboarding, CameraX, Phase 5 real Integration, screenshots / scroll, rutas/teclado/lectores y aceptación estética. No cerrar formalmente VE-017 ni PR #168 hasta evidencia y aprobación del propietario. No fusionar ni desplegar.

## P2-M · Pregunta diaria: progreso individual + favorito accesible (VE-022/024) — 14-oct-2026

**Punto de partida confirmado:** `7604412d3cd046e7adc05b4ceb185a73a02704ea` completó **15/15 workflows SUCCESS** sobre ese mismo SHA, incluida instrumentación Android real de navegación Inicio → controles de privacidad en Más (P2-L). PR #168 permanece DRAFT; V5-P0/P1 ya integrados a `desarrollo`. No extrapolar el PASS de P2-L a los cambios de P2-M.

**Hallazgo:** la tarjeta de pregunta del día indicaba `0/1/2` respuestas pero no si la propia persona o su pareja faltaba por responder. El botón favorito tenía clase `active` visual, pero carecía de `aria-pressed` para reflejar su selección. No es necesario obtener más datos ni cambiar el motor de preguntas.

**Implementación de alcance solo visual (WebView Android):**
- `dailyQuestionCard(own,partner)` calcula únicamente los booleanos `ownAnswered`/`partnerAnswered` del estado existente y añade dos cápsulas de estado (`Tú` y `Tu persona`, `Lista`/`Pendiente`) con etiquetas accesibles. **No incluye las respuestas privadas ni sus contenidos dentro de las cápsulas**; se conserva `dailyAnswerMarkup`, su conducta de privacidad y las reglas actuales de visibilidad.
- Favorito conserva `data-action="date-question-favorite"`, etiqueta contextual y comportamiento real; añade `type=button` y `aria-pressed=true/false`. Se conservan sin cambios las acciones `galaxy-share`, `date-question-decks`, `date-question-memory` y bloqueo de creación de recuerdo hasta tener ambas respuestas.
- CSS modular: dos columnas responsivas a 320 px, estados contrastados, objetivos de alto mínimo 44 px, sin animaciones o temporizadores y sin tocar Galaxy Chat/IA/DB/GPS/FCM.
- Dos pruebas dinámicas en `tests/visual-evolution-p2.test.mjs`: combinaciones `0/1/2` incluyendo quién respondió, protección del texto confidencial en el indicador, favorito activo/inactivo, touch target, rutas intactas y cero llamadas nuevas.

**Gates de salida para este SHA:** 15/15 workflows, pruebas Node 24, captura real de WebView Android con 320/360/393/412 px CSS y siete temas, inspección visual de progreso y favorito, legibilidad con fuente ampliada y aprobación visual humana de P2. Hasta entonces VE-022/024 se mantienen **EN CURSO** y P2-M no está certificado. Prohibido fusionar #168 o promover QA/prod sin autorización expresa.

## P2-N · Android Phase 5: espera del selector realmente dibujado — 14-oct-2026

**Diagnóstico reproducible, sin declarar P2-M aprobado:** el HEAD P2-M `acd22c` terminó **14/15 workflows SUCCESS y un FAIL**, [QA Phase5 #38570490326](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38570490326) en emulador Android. 35 casos iniciados; en el primer intento los tests `cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem` y `visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe` fallaron. La segunda ejecución de solo el job afectado también falló, pero **antes de iniciar Android**, al descargar `system-images;android-35;google_apis;x86_64`: `Error on ZipFile unknown archive`. No extrapolar fallo de producto del segundo intento.

**Causa de carrera visible en logcat del primer intento:** el helper marcó `GALAXY_FILE_PICKER_STABLE=pickerResumed;polls:3` aproximadamente a **13:56:34.291Z**, pero Android no informó `Displayed com.google.android.documentsui/...PickActivity` hasta **13:56:35.301Z**. Aún más tarde, a **13:56:36.186Z**, MainActivity pasó a `STOPPED` mientras el picker continuaba en pantalla. La prueba había pulsado Back después de tres lecturas de `RESUMED`, **antes de que DocumentsUI terminara de mostrar la ventana**; el retorno aparente de MainActivity no equivalía al frame visible de la WebView, y el fallo posterior de screenshot quedó registrado (NO fue ignorado). El XML y logcat están en [artefacto de primer intento #11900023281](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38570490326/artifacts/11900023281).

**Corrección P2-N**, **solo instrumentación Android**, sin alterar el producto:
- Antes de cualquier Back, `cancelPickerAndVerifyForeground` ahora exige **tres lecturas consecutivas de estado `isPickerFocusedAndAccessible`**: Android ActivityTaskManager realmente tiene la app del picker en `RESUMED`, el WindowManager tiene `mCurrentFocus` de ese paquete, y la raíz de accesibilidad de UiAutomator coincide con DocumentsUI. Ya no basta con `RESUMED` mientras la UI pinta. Se permite un máximo acotado de 20 s para el arranque frío, con 300 ms entre lecturas.
- Si no hay ventana enfocada y accesible se conserva **FAIL estricto**, sin fingir que se cerró ni pulsar Back de forma prematura. Se mantienen las aserciones posteriores: MainActivity `RESUMED`, WebView `document.visibilityState==='visible'` y frame pintado del Inicio. No se suprime ni se aumenta tolerancia a una pantalla blanca.
- Se reforzó `tests/ng-phase4-android-harness.test.mjs` para que la CI Node exija los tres testigos (resumed / mCurrentFocus / raíz accesible), el orden de controles y la prohibición de doble Back. Ningún cambio en permisos, CameraX, GPS/FCM, Chat, IA o backend.

**Gate siguiente:** ejecutar **15/15 sobre el HEAD que contenga P2-N**, especialmente real Android Phase5 y nueva prueba P2-L; observar primer intento y artefacto, sin llamar `PASS` a una simple compilación. Si el Android runner falla descargando SDK, clasificarlo separadamente como fallo ambiental y reintentar selectivamente, sin saltar casos. PR #168 sigue DRAFT, sin permiso para fusionar ni publicar.

## P2-O · QA selector interactivo + Android de pregunta diaria — 14-oct-2026

**Nuevo hallazgo verificable:** el HEAD `0040132` obtuvo **13/15 workflows SUCCESS, 2 FAIL**: [Phase 5 Integration #38583161175](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38583161175) y [Phase 11 Torture #38583161295](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38583161295). **Ambos fallaron únicamente en** `cameraMicrophoneAndFilePicker_launchWhenEnvironmentSupportsThem`: `pickerResumed=true, pickerWindowFocused=false, a11yRootMatches=true`. El contenido del picker **sí se dibujó** (`ActivityTaskManager: Displayed PickActivity`); `dumpsys window mCurrentFocus` no mostró el paquete en estos runners API 35 headless pese a que la ventana era accesible. Capturas y logcat disponibles en [artifact Phase5 #11903914654](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38583161175/artifacts/11903914654) y [Phase11 #11904668008](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38583161295/artifacts/11904668008). No son errores de IU P2-M ni de Chat, y no se declara P2 aprobado.

**Corrección acotada a instrumentación Android:**
- Sustituir el tercer testigo de `mCurrentFocus` (falso negativo documentado) por **un control real, interactivo y accesible de DocumentsUI**: `UiDevice.hasObject(By.pkg(pickerPkg).clickable(true))`, además de `isResumedPackage(pickerPkg)` y `UiDevice.getCurrentPackageName()==pickerPkg`. Las tres condiciones tienen que coincidir de manera estable durante **al menos 1.800 ms** y cuatro polls antes de emitir Back. No se acepta un simple cambio de ActivityTaskManager como prueba de IU lista.
- Seguir exigiendo estrictamente, después de Back, `MainActivity` verdaderamente `RESUMED`, `document.visibilityState==='visible'`, no doble Back hacia nuestra app y **píxeles reales** de la captura V5. Si no hay nodos clicables se reporta FAIL de preparación, no se simula ni se omite el test.
- El contrato Node `tests/ng-phase4-android-harness.test.mjs` queda actualizado para exigir las condiciones interactivas y para descartar el testigo obsoleto de WindowManager.
- Adicionalmente `GalaxyDeviceClosureTest.visualEvolutionP2_dailyQuestionStatus_isAccessibleAndPrivateOnRealAndroid` verifica en la WebView **real** que existen exactamente dos indicadores personales con etiqueta, objetivos de 44 dp de alto, grupo accesible, estado favorito `aria-pressed`, bloqueo de botón Recuerdo mientras faltan respuestas, ausencia de fugas del texto de respuesta hacia las etiquetas y no desbordamiento horizontal. Solo datos sintéticos del backend local; no escribe ni envía respuestas de verdad.

**Definición de éxito:** Node 24 y **15/15 workflows nuevos** sobre el HEAD definitivo; revisar JUnit/logcat del picker real y evidencias de renders 320/360/393/412 px, siete temas. Si faltan dependencias SDK o hay errores de red en runners, separarlos de fallos productivos; reintentar selectivamente sin maquillar. Nunca certificar Android por un PASS de versiones previas. P2, VE-022/024, VE-017 y VE-027/029 siguen sujetos a aceptación visual del propietario y a autorización explícita antes de fusión y despliegues.

## P2-P · Capturas de la pregunta diaria a mitad de Inicio — 14-oct-2026

**Baseline técnicamente aprobado:** `4868ee0648be1f9d6879bc413a059207c1a69210` (P2-O) tiene **15/15 GitHub Actions SUCCESS** comprobados en el mismo SHA: [Android Phase 5](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38586876548), [Phase 11 Torture](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38586876665), [AVD V5 P0/P1/P2](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38586876461). Los 36 casos Android de Phase 5 terminaron sin fallos, con 3 skips de hardware/entorno. Nuevas pruebas P2 de controles de privacidad y estado personal de pregunta diaria ambas PASS en el XML JUnit. Evidencia AVD: [artefacto #11906168341](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38586876461/artifacts/11906168341), con cuatro capturas de Inicio superior/inferior en 320/360/393/412 CSS px y siete temas; no confundir con captura sintética de Chrome ni teléfono físico. El corte P2-O mantiene **revisión estética y aprobación del propietario pendientes**; 15/15 indica QA automatizado del SHA, no cierre integral de V5-P2.

**Brecha detectada en auditoría de artefactos:** las capturas Android superiores muestran hero/historia y las inferiores el bento y el final, pero ninguna muestra *la sección intermedia de la pregunta diaria* que cambió en P2-M (chips `Tú`/`Tu persona`, `Lista`/`Pendiente`, favorito `aria-pressed`), pese a existir un test de estructura y privacidad. No se debe solicitar aceptación visual completa sin esa evidencia.

**P2-P implementado solo en QA e instrumentación** (sin cambios de funcionalidad o datos):
- El JUnit `GalaxyDeviceClosureTest.visualEvolutionP1_realWebViewThemesFloatingRailAndModalFocus_areSafe` avanza en cada ancho físico Android de 320/360/393/412 CSS px hasta `.date-question-person-status`. Verifica `scrollY > 100`, que los **2 chips** estén realmente visibles por encima del navbar fijo, favorito con `aria-pressed`, cero overflow horizontal. Exige **2 frames consecutivos** con al menos **15% píxeles de contenido diferentes de la cabecera real** (`awaitV5QuestionFramePainted`) antes de archivar `V5-P2-question-{css}.png`.
- Los controles superiores, el scroll inferior y su comprobación de píxeles reales siguen intactos. No se acepta imagen blanca/estancada ni solo geometría del DOM como prueba visual.
- `scripts/visual-evolution-p1-avd.sh` importa las cuatro imágenes en `build/p0-avd/p2-question-viewports/{320,360,393,412}.png`, comprueba su presencia, firma PNG, tamaño físico idéntico al viewport correspondiente y no-identidad byte a byte con cabecera. Solo certifica el recibo con `p2_middle_question_screenshots:4` si también pasa JUnit real.
- `tests/visual-evolution-p2.test.mjs` añade regresión de contrato Node para impedir eliminar la espera de fotogramas, las cuatro imágenes, las aserciones o el reporte. Todo ejecutado en cuenta QA hermética, sin datos privados.

**QA P2-P exigido y aún por verificar**: 15/15 workflows del HEAD con P2-P (no heredar PASS desde `4868ee0`); inspección visual real de las cuatro capturas nuevas con todas las anchuras, especialmente texto largo, 320 px, navegación/FAB y 7 temas donde aplique; actualización del ledger a PASS únicamente con pruebas completas. Revisión estética del propietario, fusión y cualquier despliegue **NO autorizados**. IA, Galaxy Chat central, backend, GPS/FCM, permisos y perfiles intactos.

## P2-Q · Zona de exclusión Galaxy Chat FAB frente a pregunta diaria — 14-oct-2026

**Baseline certificado antes de P2-Q:** commit `32dd4be18908d4585f494e059ba1bbfef8e0da28` (P2-P) terminó **15/15 GitHub Actions SUCCESS** tras repetir solo el job AVD fallido por `Pixel Launcher isn't responding` (ANR de sistema Android, no ANR de la app). [Workflow V5 #38593241098](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38593241098) / [artefacto Android nuevo #11914235415](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38593241098/artifacts/11914235415). Receipt Android indica **7 temas distintos, 4 screenshots top, 4 middle y 4 bottom**, 1 prueba JUnit AVD/0 errores/0 fallos; Phase5, Phase11 y demás gates CI terminaron PASS. **No confundir este PASS del SHA previo con QA de P2-Q.**

**Auditoría visual del artefacto real Android P2-P:**
- Las cuatro capturas `build/p0-avd/p2-question-viewports/{320,360,393,412}.png` existen y muestran la tarjeta «Pregunta de hoy» con dos chips de respuesta, botón estrella, Galaxy Chat, Barajas y Guardar recuerdo en la WebView real. Las anchuras físicas observadas son **839 / 944 / 1030 / 1080 px**, proporcionales a 320/360/393/412 CSS px, altura 2400. Sin barra inferior tapando el texto central; en 320 px los estados `Lista` se envuelven a segunda línea, pero siguen legibles.
- **Nuevo hallazgo VE-030 (real):** en las cuatro capturas de la zona media, el FAB morado fijo de Chat invade el **borde derecho del botón «Guardar como recuerdo» y parcialmente la zona de acción «Barajas»**. Aunque sus textos principales permanecen legibles, una superficie táctil no debe quedar parcialmente tapada. Las pruebas anteriores únicamente comprobaron FAB contra barra de navegación/reproductor, no contra botones locales durante el scroll.
- 7 capturas de temas (Navidad, Universo, Luz, Pascua, Halloween, San Valentín, Amistad) inspeccionadas: encabezado visible, variantes de color y barra inferior/Chat presentes. Son capturas QA sintéticas de emulador, no material de teléfono físico o aprobación estética.

**P2-Q implementado solamente en CSS Android y pruebas, sin cambios a Chat Engine:**
- `galaxy-welcome.css`: se reserva `padding-inline-end:clamp(52px,13vw,68px)` en `.galaxy-welcome .date-question-actions`, de forma que los tres botones existentes se mantienen funcionales y la columna derecha deja una zona libre para el FAB flotante en pantallas estrechas.
- `GalaxyDeviceClosureTest`: en los cuatro viewports físicos Android, el mismo tramo de captura de la pregunta comprueba **geométricamente** que los tres botones `.date-question-actions > .btn` **no intersectan** el rectángulo real de `#chatFab` y que ninguno queda con anchura menor de 44 CSS px. El test falla ante superposiciones; no se apoya solo en el padding declarado.
- `tests/visual-evolution-p2.test.mjs`: contrato Node de exclusión, aserciones Android y preservación de los tres handlers. No se cambia Chat FAB, datos, permisos, rutas, estado compartido, APIs ni visuales fuera de Inicio.

**Salidas pendientes P2-Q:** repetir **15/15 CI sobre el nuevo HEAD**, descargar las nuevas capturas intermedias 320/360/393/412 y confirmar que Chat FAB ya no invade acciones ni provoca texto comprimido; auditar siete temas y estados al menos con evidencia disponible. Si algún gate no aprueba, investigar y corregir causa. Revisión estética humana del propietario y autorización de merge #168 siguen **PENDIENTES**; no publicar en desarrollo, QA ni producción.
