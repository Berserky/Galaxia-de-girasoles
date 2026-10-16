# Nuestra Galaxia — V5-P4 Connected Journeys | Handoff y QA vigente

> **Actualizado:** 16 octubre 2026 (Bogotá). Épica [#160](https://github.com/Berserky/Galaxia-de-girasoles/issues/160). Rama `feat/visual-evolution-5-p4-connected-journeys`, [PR #170 DRAFT](https://github.com/Berserky/Galaxia-de-girasoles/pull/170) contra `desarrollo@1d3c997c`. **P4 NO CERRADA, SIN MERGE, SIN QA/PROD.** Verificar siempre SHA HEAD real y TODOS sus workflows, no dar por aprobado un resultado de un commit anterior. P0–P3 ya fusionadas a `desarrollo`.

## Estado verificable por subfase

| Fase | Alcance implementado en rama | Certificación pendiente |
|---|---|---|
| **P4A** | Mapa compacto + inmersivo reversible, Escape/aria-pressed/foco, controles 44px, estado de frescura/ausencia/pausa y Journey Companion que reutiliza distancia/ETA existentes | Repasar VE-062/064/067/068/070; datos offline, mapa visible en los siete temas y éxito de todos los workflows del HEAD |
| **P4B** | Sesión contextual de progreso acotado o indeterminado, avisos desplegables «Configurado» ≠ «Entregado», transporte accesible, botón de consultar mapa y compartición/permiso distinguidos | Estado de última emisión real no disponible: no mostrar falso «entregado». Probar situaciones sin permisos, sin destino y cancelación |
| **P4C** | Lugares compactos con navegación y popup de marcador, recuerdos relacionados; cronología que combina trips/events/encounters con paginación y fechas reales | Revisión de metadatos parciales, accesibilidad y navegación al marcador cuando un dato carece de coordenadas |
| **P4D** | Tests Node en `tests/visual-evolution-p4.test.mjs` y tests reales Android en `GalaxyDeviceClosureTest.java`; verificador `scripts/visual-evolution-p1-avd.sh` | Todas las pruebas 15/15 en SHA actual, 19 screenshots reales, prueba de tortura + integración Android y aprobación visual explícita |

### Catálogo de cuarenta hallazgos

Estado uno por uno en [03-mapa.md](03-mapa.md): **22 implementados en rama**, **13 parciales**, **5 pendientes** (VE-062, 064, 067, 068 y 070). **Ningún checkbox se da por cerrado** hasta QA final y validación visual. La implementación parcial comprende VE-063, 065, 069, 072, 073, 077, 079, 085, 090, 093, 094, 095 y 099. Los demás IDs identificados como «implementados» requieren validación de comportamiento físico y que la app se vea bien.

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
3. Actualizar este documento con evidencia exacta de SHA y estado de cada VE; continuar VE-062/064/067/068/070 y parciales sin cambiar motores.
4. Con 15/15 y las pruebas visuales revisadas, presentar muestras al usuario y solicitar **aprobación visual/merge**; PR permanece DRAFT hasta entonces.
5. Solamente después de merge aprobado a `desarrollo`, abrir P5 según [ROADMAP.md](ROADMAP.md). `qa` y `prod` permanecen intactos.

**Revert:** revertir PR #170 completo (sin migraciones de base ni cambios en datos). Mantener la versión estable 4.1.2 sin alterar.
