# Nuestra Galaxia — V5-P4 Connected Journeys | Handoff y QA vigente

> **Actualizado:** 16 octubre 2026 (Bogotá). Épica [#160](https://github.com/Berserky/Galaxia-de-girasoles/issues/160). Rama `feat/visual-evolution-5-p4-connected-journeys`, [PR #170 DRAFT](https://github.com/Berserky/Galaxia-de-girasoles/pull/170) contra `desarrollo@1d3c997c`. **P4 NO CERRADA, SIN MERGE, SIN QA/PROD.** Verificar siempre SHA HEAD real y TODOS sus workflows, no dar por aprobado un resultado de un commit anterior. P0–P3 ya fusionadas a `desarrollo`.

## Estado verificable por subfase

| Fase | Alcance implementado en rama | Certificación pendiente |
|---|---|---|
| **P4A** | Mapa compacto + inmersivo reversible, Escape/aria-pressed/foco, controles 44px, estado de frescura/ausencia/pausa y Journey Companion que reutiliza distancia/ETA existentes | Repasar la cartografía temática y la leyenda de rutas registradas, perfiles desplegables y velocidad subordinada; datos offline, mapa visible en los siete temas y éxito de todos los workflows del HEAD |
| **P4B** | Sesión contextual de progreso acotado o indeterminado, avisos desplegables «Configurado» ≠ «Entregado», transporte accesible, botón de consultar mapa y compartición/permiso distinguidos | Estado de última emisión real no disponible: no mostrar falso «entregado». Probar situaciones sin permisos, sin destino y cancelación |
| **P4C** | Lugares compactos con navegación y popup de marcador, recuerdos relacionados; cronología que combina trips/events/encounters con paginación y fechas reales | Revisión de metadatos parciales, accesibilidad y navegación al marcador cuando un dato carece de coordenadas |
| **P4D** | Node, Android instrumentación y script de evidencia real (`scripts/visual-evolution-p1-avd.sh`) | 15/15 verificados en `d3172763` y 19 capturas Android; nueva UX incremental requiere renovar los 15 gates en su propio SHA y aceptación visual explícita |

### Catálogo de cuarenta hallazgos

Estado uno por uno en [03-mapa.md](03-mapa.md): **32 implementados en rama**, **8 parciales**, **0 sin trabajo iniciado** (los cinco hallazgos inicialmente pendientes ya cuentan con al menos un primer tratamiento en rama). **Ningún checkbox se da por cerrado** hasta QA final y validación visual. La implementación parcial comprende VE-064, 065, 069, 072, 079, 085, 093 y 095. Los demás IDs identificados como «implementados» requieren validación de comportamiento físico y que la app se vea bien.

**Ampliaciones incorporadas:** VE-062 incorpora filtros suaves de capas raster por tema preservando la atribución OSM; VE-064 añade una leyenda honesta de recorridos registrados (no existe ruta planificada en estos datos: **parcial**); VE-067/068/070 convierten las tarjetas de persona en paneles `details/summary` con estado GPS arriba y velocidad aproximada dentro del detalle, sin ocultar funciones del chat. Las 40 entradas siguen con checkbox sin cerrar por falta de aceptación final.

**P4A/P4B/P4C — segunda revisión UX (16/oct, post-gate):** se añadieron controles de viaje y lugar compactos (VE-090); menú de acciones secundarias accesible para guardar recuerdos o compartir (VE-094); metadatos históricos reales de `galaxy_place_events.place_id`, `galaxy_encounters.ended_at/distance_m` y `galaxy_trip_history.dominant_motion` (VE-099), sin inferir valores ausentes; marcador de destino único (persona/lugar) derivado solo del perfil emparejado, sin revelar GPS pausado (VE-063); mensaje de llegada ETA en español natural (VE-073); permisos Android en disclosure secundario sin esconder control de detener GPS (VE-077). Se reforzó `mapLocationValid` para rechazar strings de coordenadas vacíos. Esos seis IDs ahora están **implementados en rama, no aceptados visualmente**. Aún parciales: VE-064, 065, 069, 072, 079, 085, 093 y 095.

### Archivos y contratos

- `android/app/src/main/assets/mobile/app.js`: sólo composición visual Android WebView, rutas de botones y control de visualización; `refreshMap` devuelve señal local de éxito y `refreshMapNow` NO afirma que GPS de pareja se actualizó desde este teléfono.
- `galaxy-journeys-v5.js`: presentador sin red de estados `fresh/stale/paused/missing`, progreso de sesión y cronología. Coordenadas nulas, no numéricas, fuera de rango y tiempo futuro se excluyen de etiquetas recientes.
- `galaxy-journeys-v5.css`: estilos del mapa, sesiones, timeline y compartición, todos aislados. **No reañadir reglas P4 al final de `app.css`: rompe contratos legacy de reduced-motion.**
- `map.js`, `distance.js`, `eta.js`, `gps-history.js`: motores existentes **intactos**; `drawMap()` filtra coordenadas inválidas en ubicaciones, lugares, sugerencias y trazos de recorridos antes de invocar `GalaxyMap`. Al pulsar lugar válido se centra y abre el popup; los inválidos siguen como fichas sin botón de centrado.
- `tests/visual-evolution-p4.test.mjs`, `tests/android-context-engine-contract.test.mjs`, `scripts/qa-android-mobile.mjs`: pruebas y contratos textuales actualizados para conservar operaciones y retirar versión «Acompáñame 2.0» de la vista.
- `android/app/src/androidTest/java/com/nuestragalaxia/companion/GalaxyDeviceClosureTest.java`: pruebas físicas de mapa compacto/inmersivo a CSS 320/360/393/412, 7 temas con contraste WCAG AA y 135% `WebSettings.setTextZoom`. El marcador P4 de pruebas por tema ahora se adjunta temporalmente a `document.body` con geometría sobre el mapa visible para soportar redibujos asíncronos; exige diferencia real del framebuffer y se limpia.
- `scripts/visual-evolution-p1-avd.sh`: exige **19 PNG** Android P4: 8 (modos × 4 anchos) + 7 (mapa temas) + 4 (fuente 135%) y hashes diferentes; un PNG falso/duplicado falla.
- `.github/workflows/{chat-4-phase11-torture,qa-phase5-real-integration,visual-evolution-p0}.yml`: motores de emulador `swiftshader` y cuentas QA efímeras. Se preservan suite de resistencia y pruebas de consentimiento.

### Evidencia: no trasladar PASS entre commits

- **SHA anterior `5831defe`**: workflow V5 AVD [38845525866](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38845525866), artifact [12023560855](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38845525866/artifacts/12023560855): **19/19 capturas P4 reales + JUnit visual 1/1 PASS**. No certifica SHA futuro.
- **SHA `9a0115f7`**: Phase11 Torture [38848184408](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38848184408) aprobó ambos trabajos, pero otras suites fallaron al ejecutar en paralelo; no equivale a 15/15.
- **SHA `2f96e193`**: 13/15 SUCCESS y Phase5 [38850006881](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38850006881) FAIL. JUnit reportó que el marcador de QA P4 por tema daylight no pintó aunque la imagen cambió considerablemente (`changedPixelRatio=0.7905`). La corrección posterior adjunta el marcador a `document.body` para no perderlo al redibujar el mapa; **sin PASS del nuevo HEAD todavía**. Phase11 del commit previo debe consultarse en GitHub: pudo ser cancelado por los commits siguientes.
- Cambios UX finales y prueba P4 se implementaron en commits posteriores; ejecutar suites de nuevo y revisar artefactos exactos antes de declarar cierre.

### Gate íntegro aprobado en `d3172763` (no transferible a futuros HEAD)

- **15/15 workflows SUCCESS** para `d3172763e9cd88482591ccf4ceeb2fdd3268687a`. V5 Android AVD [run 38852552143](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38852552143), Phase5 [run 38852552108](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38852552108), Phase11 [run 38852552082](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38852552082): todos SUCCESS. Comentario de evidencia del PR #170: [#6219585662](https://github.com/Berserky/Galaxia-de-girasoles/pull/170#issuecomment-6219585662).
- **Artefactos descargados y revisados:** V5 AVD `12026157454`, Phase5 `12026461007`, Torture `12026262032`. Reporte AVD: 19/19 PNG P4 sintéticos capturados desde framebuffer Android, JUnit 1/1 sin fallos/errores, `VERIFIED_SYNTHETIC_QA`; Phase5 JUnit **36 tests, 0 fallos, 0 errores, 3 omitidas**; Phase11 JUnit **4 tests, 0 fallos, 0 errores, 2 omitidas**. Las omisiones no cuentan como PASS.
- **Nuevo HEAD posterior**: contiene cambios de segunda revisión UX y necesita los 15 workflows y los 19 PNG **de ese HEAD**, además de captura de menús/historial si hace falta. El 15/15 de `d3172763` NO certifica esos nuevos commits.

### Checklists obligatorios P4D

- Contratos Node: `npm test`, `node --test tests/visual-evolution-p4.test.mjs` y QA Android estricta `scripts/qa-android-mobile.mjs`.
- 15/15 GitHub workflows del HEAD real; incluir **Phase 11 Torture**, **QA Phase 5 Real Integration**, y V5 AVD. Revisar JUnit XML, archivos PNG, tamaño real, hash no duplicado y pintura de Android.
- Temas: daylight, cosmic, halloween, christmas, valentine, friendship, easter; Android WebView nativa, colores AA, temas con fuente 135%, 320/360/393/412 CSS px, modo de movimiento reducido.
- Casos funcionales: perfil 0/1, compartir activado/pausado, sin permisos, GPS nulo/futuro/histórico, offline y slow network, sesión acompañada activa/terminada, destino sin datos, recorridos y lugares inválidos. No inventar lecturas, ETA o notificaciones.
- Visual: densidad de información, colores y botones de la UI real, accesos sin duplicidad, scroll, fuentes, marcador centrado con popup, rutas, safe-area y menú contextual. Aceptación visual por el propietario **antes** de considerar merge.
- **No modificar** GPS/FCM nativos, permisos/consentimiento, backend Supabase, RLS, IA, Chat Engine, datos personales ni paquetes de producción. No publicar APK. Todos los fixtures usan nombres y coordenadas sintéticos.

### Siguiente operador (continuidad entre chats)

1. Consultar HEAD **de PR #170**, sus 15 workflows y artefactos de ese SHA, no repetir P0–P3.
2. Resolver FAIL en su causa raíz, jamás saltar asserts; evitar hacer nuevos pushes durante los Android gates salvo si hay un fallo confirmado que obliga a corregir.
3. Actualizar este documento con evidencia exacta del HEAD y continuar los ocho VE todavía parciales (064/065/069/072/079/085/093/095), sin modificar motores ni inventar confirmación de notificaciones.
4. Con 15/15 y las pruebas visuales revisadas, presentar muestras al usuario y solicitar **aprobación visual/merge**; PR permanece DRAFT hasta entonces.
5. Solamente después de merge aprobado a `desarrollo`, abrir P5 según [ROADMAP.md](ROADMAP.md). `qa` y `prod` permanecen intactos.

**Revert:** revertir PR #170 completo (sin migraciones de base ni cambios en datos). Mantener la versión estable 4.1.2 sin alterar.
