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
