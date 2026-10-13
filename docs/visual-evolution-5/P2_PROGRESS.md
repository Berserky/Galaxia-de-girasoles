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
