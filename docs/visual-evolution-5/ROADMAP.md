> **Reconciliación de estado 13-oct-2026:** V5-P0 y V5-P1 ejecutados, aprobados y fusionados con autorización; V5-P2 en implementación y QA visual bajo [PR #168 DRAFT](https://github.com/Berserky/Galaxia-de-girasoles/pull/168) y [P2_PROGRESS.md](P2_PROGRESS.md). P3–P9 aún no iniciados. La tabla de fases y Definition of Done se mantienen vigentes; la etiqueta histórica «no iniciado» más abajo no corresponde al estado actual. No hay promoción QA/prod.

> **Estado actualizado:** V5-P0 en ejecución con artefactos verificables en rama aislada; P1 únicamente preparado, **no implementado**. Seguir el ledger [P0_QA_LEDGER.md](P0_QA_LEDGER.md) antes de marcar DoD. La frase “no iniciado” más abajo pertenece al roadmap previo a este arranque y no equivale al estado Git actual.

# Nuestra Galaxia — Visual Evolution 5.0 / Plan maestro de implementación

**Estado:** PLANEADO / NO INICIADO. **Fuente:** auditoría de capturas VE-001…VE-260, lectura de `prod@fde141d4c8e7622ac1d6f10f1abbfbda8e8e7d0c`. **Objetivo:** diseño moderno, hermoso, coherente, accesible y fluido en el APK Android estable, conservando sus funciones. **Fuera de alcance:** rediseño/motor de IA (upgrade separado), refactor Chat 4.1, sustitución de backend, despliegue y promoción automática. Las mejoras de notificaciones nativas/FCM solo se documentan como *follow-up funcional*, no se tocan hasta autorización.

## Orden de trabajo y correspondencia exhaustiva

| Bloque | Entrega | IDs responsables | Dependencia | Resultado esperado |
|---|---|---|---|---|
| V5-P0 | Baseline y contrato de diseño | transversales VE-001, 030, 031, 034, 059, 060 | ninguna | estado comprobado, capturas sanitizadas de QA, pruebas iniciales y arquitectura UX aprobada |
| V5-P1 | Celestial Design System + shell compartido | VE-001, 030–034, 059–060, 144 y regresiones equivalentes | P0 | tokens semánticos, diseño de superficies y navegación, modales/sheets/toasts, insets Android, teclado, tipografía, focus, movimiento y todos los temas |
| V5-P2 | Inicio / Galaxy Welcome | VE-002–029, VE-032–034 | P1 | hero personal, conexión resumida, pregunta, estado emocional, accesos bento, historia compacta |
| V5-P3 | Buscador y avisos in-app | VE-035–058, 059–060 | P1 | resultados contextuales agrupados, categorías de notificaciones, estados vacíos/offline/teclado, lectura accesible |
| V5-P4 | Mapa / Connected Journeys | VE-061–100 | P1 | mapa inmersivo, perfiles con frescura, panel Journey Companion, lugares, alertas, timeline, preferencia movilidad |
| V5-P5 | Momentos / Living Moments | VE-101–142 | P1 | jardín ilustrado, gestos expresivos, juegos/citas, cartas/notas/sorpresas, rituales y reproductor de voz |
| V5-P6 | Recuerdos / Living History | VE-143–202 | P1 (y contratos de P4/P5 si vinculados) | hub Descubrir/Colecciones/Historia, álbum, música, fechas, planes, notas, cápsulas, deseos, viajes y constelación |
| V5-P7 | Más / Galaxy Control Center | VE-203–260 | P1 y consistencia P4/P5/P6 | configuraciones agrupadas, privacidad, temas, widgets, respaldos, dispositivos, permisos, actualizaciones |
| V5-P8 | Integración y QA final | cobertura VE-001–260 | P1–P7 | regresión por todos los módulos y skins, rendimiento, hermetic/privacy, informe de evidencias, cero P0/P1 verificado |
| V5-P9 | Candidato / liberación | control de release, no hallazgo visual | P8 + aprobación humana | PRs CI → desarrollo → qa RC → evidencia → aprobación → prod/estable, nunca automáticamente |

**Subfases recomendadas para Recuerdos (complejidad alta):** P6A arquitectura de colecciones/registro; P6B álbum + Drive; P6C música; P6D calendario + planes/notas/deseos; P6E cápsulas/viajes; P6F cronología/constelación; P6G regresión de privacidad/medios. **Cada subfase un PR revisable con IDs cerrados explícitos**, no una gran reescritura.

## Decisiones de producto para la UI

1. **Filosofía**: Celestial Design System, superficies oscuras/violeta actuales evolucionadas, profundidad y gradientes discretos; evitar paneles interminables; permitir temas estacionales existentes. La funcionalidad tiene más prioridad que la ornamentación.
2. **Estructura**: navegación inferior preservada y accesible; subnavegación en hubs, no duplicar tabs globales. Inicio resume; Mapa explora; Momentos invita a actuar; Recuerdos conserva y conecta; Más administra. El módulo IA permanece intacto.
3. **Principios visuales**: densidad informativa adaptativa, jerarquía semántica, tipografía accesible, iconografía Lucide actual, espacio entre controles, estados focus/pressed/disabled/loading/success/error/empty/offline, light/dark/event themes.
4. **Motion**: duraciones sugeridas 150–300 ms para elementos comunes, easing coherente, transiciones compartidas card→detalle, sheets, reveals del jardín y cápsulas. Efectos ambientales sutiles y opcionales; `prefers-reduced-motion` con equivalencia funcional, ahorro de batería, evitar animaciones permanentes pesadas.
5. **Fidelidad de datos**: sin GPS ficticio o ETA falsa, sin inventar canciones, portadas, fechas ni fotografías. Distinción de ubicación activa vs reciente; notas/cápsulas bloqueadas jamás reveladas por preview o cache. La constelación debe representar nodos reales.
6. **Operaciones peligrosas**: borrar fotos/historial, revocar dispositivos, cambiar perfil, restaurar JSON y desvincular requieren claridad, autorización y confirmación, no animaciones que engañen.
7. **Disponibilidad**: entradas a funcionalidades existentes siempre permanecen; no borrar APIs ni esquemas, ni migrar entidades solo para facilitar UI. Cambios del contrato requieren design review e issue separado.
8. **Web y Android**: Android es fuente visible auditada. Compartir conceptos visuales con PWA si se aprueba, sin asumir que ambas interfaces usan el mismo código.

## Inventario inicial de componentes reutilizables / nuevos

| Priorizar reutilización | Evolucionar o crear |
|---|---|
| tokens CSS + GalaxyTheme + paletas estacionales | V5ThemeTokens, tipografía y elevación con contraste comprobado |
| `header`, `renderNav`, `go`, `render` | shell adaptable, header compacto, acceso contextual y safe-area |
| dialog `#modal`, `showModal`, `showBottomSheet` | paneles globales accesibles sin afectar chat sheets |
| `chat-motion.js` (solo referencia) | tokens motion compartidos y transiciones compatibles, sin importar motor chat a la fuerza |
| `itemCard`, `storyTimeline`, `constellationView` | tarjetas especializadas, Details, calendario y constelación explorables |
| `albumView`, `driveAlbumCard`, `musicView`, `renderGlobalPlayer` | visor álbum y selección, biblioteca musical, player compartido |
| `mapView`, `distance.js`, `eta.js` | mapa expandible, sheet Journey y etiquetas históricas |
| `momentsView`, `bondGardenVisual`, `voiceCard` | jardín en capas, deck/ruleta/cita, player de voz |
| `moreView`, `themeSettingsCard`, `deviceProfilesCard` | hub de settings y flujos protegidos |
| `openUniversalSearch`, `openNotificationCenter` | modal adaptable y centro de notificaciones categorizado |

## Contrato mínimo de PR por bloque

En cada PR incluir: (a) lista exacta de IDs VE completados o diferidos y motivo, (b) paths modificados y diagrama de flujo de acción, (c) evidencia visual antes/después con datos ficticios sin nombres/ubicación privada, (d) pruebas automáticas añadidas/actualizadas, (e) estados normal/vacío/carga/error/desconectado, (f) validación de privacidad/accesibilidad/performance, (g) plan de revert sin pérdida de datos, (h) compatibilidad con todas las apariencias y Pantallas Android estrechas, (i) matriz QA con PASS/PARTIAL/BLOCKED/FAIL y evidencia, (j) checklist de no regresión en Chat, GPS/ETA, FCM, cápsulas, álbum y pairing.

**Definition of Done:** un VE se cierra solo tras código integrado, prueba funcional de la ruta implicada, screenshot comparativo y criterio visual aceptado. Si no existe evidencia, el estado no puede ser PASS. Ninguna fase es elegible para `prod` por el simple hecho de tener UI atractiva.

## Matriz de verificación progresiva

- **En CI por cada PR:** `npm test` (Node 24+), contratos de búsqueda, navegación, theme, Bond, multimedia, mapa y privacidad relacionados; Android lint/tests/build cuando afecte assets móviles, además de screenshot/viewport tests nuevos.
- **Viewport:** 320, 360, 393/412 px CSS y anchuras mayores; portrait/landscape; teclado abierto/cerrado; escalado de fuentes; safe areas; entrada/salida repetida de modales; barra de Android legible.
- **Temas:** Automático, Luz suave, Universo oscuro, Halloween, Navidad, San Valentín, Amor y amistad, Pascua. No asumir visibilidad por haber probado solo oscuro.
- **Estados:** cero/uno/muchos ítems, textos muy largos, fechas pasadas/futuras, datos GPS stale/ausente/live, audio metadata pendiente, sincronización Drive interrumpida, offline y sin permisos, perfiles y tamaños variables.
- **Accesibilidad:** contraste WCAG AA como objetivo, foco visible, etiquetas correctas, orden de lectura, touch targets aprox. >=44dp/48dp donde corresponda, navegación sin gestos obligatorios, reduced motion.
- **Rendimiento:** fijar baseline medible en P0 y evitar regresión en inicio, scroll, animación, memoria, frames, batería (sobre todo mapas/jardín/fotos). No declarar FPS u objetivos medidos antes de correr pruebas.
- **Seguridad:** datos sintéticos, prohibido subir tokens, secretos, capturas privadas, audio personal, fotos reales, coordenadas o keyfiles. No usar perfiles reales para pruebas peligrosas.
- **Hardware:** priorizar QA hermético/AVD; pruebas físicas solo si un cambio requiere señales nativas reales y con autorización/acotación específica, sin repetir GPS/FCM cerrados por mero rediseño.

## Ramas, conflictos y publicación

Seguir `docs/BRANCH_POLICY.md`. Crear rama de funcionalidad desde `desarrollo`, PR+CI, QA, candidate y promoción autorizada. **Precondición del próximo chat**: comprobar que la documentación de este PR esté integrada en desarrollo y que desarrollo refleje el baseline estable de prod; en esta sesión `desarrollo` está 8 commits detrás. No mover ramas protegidas ni usar `main`. No hacer release en fase de descubrimiento. La evidencia histórica de QA en `docs/qa/ng-f4-engineering-exit-20261012.md` contiene bloqueos de producción de ese momento; reconciliar su estado actual, sin transferir “PASS” a una nueva versión sin pruebas.

## Dependencias excluidas

- **IA**: motor, embeddings, prompts, UX del hub, narrador, relaciones y libro: programa independiente, no V5. Se permite mejorar *marco visual* del buscador universal si la semántica/orden de resultados no cambia.
- **Galaxy Chat**: su renovación 4.1 se mantiene. V5 solo preserva coherencia del shell/FAB y deep links.
- **Android push no entregado**: registrar como deuda separada; no rehacer Firebase porque un indicador visual diga configurado.
