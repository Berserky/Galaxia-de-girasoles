# V5-P1 — Checklist ejecutable: Shell & Celestial Design System

**Estado:** PREPARADO, NO COMENZADO. **Entrada:** cierre verificado de V5-P0 y aprobación visual del contrato. Crear rama **nueva** desde `desarrollo` ya integrado; no continuar en rama P0 tras merge.

## Entrega P1 / IDs
VE-001, VE-030, VE-031, VE-032, VE-033, VE-034, VE-059, VE-060, VE-144 y equivalentes de accesibilidad transversal; marcar IDs solo al pasar su DoD, sin cerrar fuera de su módulo.

## Secuencia segura
1. **Tokens:** introducir capa CSS modular semántica a partir de `CELESTIAL_TOKENS.json` sin duplicar reglas de cada skin. Verificar seven explicit skins + `auto` de `GalaxyTheme`. No reemplazar `theme.js` ni sobrescribir tema seleccionado.
2. **Shell:** refinar `header/renderNav/render/go` conservando las ocho rutas (`home/map/moments/memories/goals/ai/chat/more`); no ocultar objetivos, IA o Chat. Asegurar `data-action` y listener existente.
3. **Insets + teclado:** garantizar `bottomNav/chatFab/globalPlayer`, floating add y botones de mapa sin solapes a 320/360/393/412 px, con teclado abierto y landscape. Preservar `syncChatViewportHeight` y el motor de scroll/composer de Chat 4.1.
4. **Overlay:** accesibilidad de `#modal`, `showModal`, `showBottomSheet`: foco inicial, atrapamiento/restauración de foco, cerrar con escape y botón, scroll controlado; NO alterar overlays específicos de Chat.
5. **Estados y animación:** carga/vacío/error/offline, pressed/focus/disabled, motion 150-280ms y modo reducido; evitar `backdrop-filter` o repaints continuos donde haya jank.
6. **Compatibilidad Android:** validar UI empaquetada en WebView, barras system nav/status legibles, dark/light, 16px inputs y contraste AA. Capturas reales solo en QA con datos sintéticos, nunca por captura privada.
7. **Pruebas y documentación:** completar cobertura de rutas, overlay y estilos en `tests/`; agregar screenshots comparativos sanitizados y benchmarks antes/después con misma AVD. Ejecutar `npm test`, QA script, Gradle unit/lint/build y si cambia bridge instrumentation.
8. **PR aislado:** anexar IDs, estados y evidencias; PR → `desarrollo` con CI verde. No avanzar `qa`, `prod`, Edge, Firebase, migraciones o APK estable.

## Matriz de aceptación P1
| Tema | Verificación | Fallo bloqueante |
|---|---|---|
| 8 apariencias | tabulación, texto e iconos contrastados | white-on-light, dark-on-dark |
| Bottom nav/FAB | controls visibles sin colisión en 4 anchos, teclado, player | acción obstruida |
| Modal/sheets | foco, teclado, accesibilidad, cierre e historial | modal sin cierre o focus trap |
| Todas las rutas | navegación 8 rutas + 9 tipos recuerdos | acceso anterior eliminado |
| Galaxy Chat | fullscreen, composer y media SIN modificación de motor | saltos de scroll, envío roto |
| Privacidad | bloqueo de cápsulas, consent GPS, dispositivos | filtración o acción destructiva sin confirmación |
| UX | pantalla fluida, reduced motion, scroll estable | jank significativo vs baseline documentado |

## Fuera de alcance P1
Módulos de IA, Chat Engine 4.1, FCM/GPS backend, migration/DB, refactors innecesarios, nuevo framework, rediseños completos de Inicio/Mapa/Momentos/Recuerdos/Más (P2–P7).

## Handback mínimo
Guardar issue/PR, base SHA, HEAD SHA, CI run URLs, evidencias before/after, riesgos y el siguiente bloque en `docs/visual-evolution-5/`. No afirmar cierre de P1 hasta cumplir todos sus gates.
