# V5-P5 — Living Moments · progreso y handoff

> **Inicio 16 octubre 2026 (Bogotá).** V5-P4 [PR #170](https://github.com/Berserky/Galaxia-de-girasoles/pull/170) **fusionado a `desarrollo`** en `bb03a0bd7e84901d0add76bd1e04e6c127eb6d5f` después de aprobación visual explícita, 15/15 workflows del mismo SHA P4 y 23 capturas Android. `qa` y `prod` **no se modificaron**. **P5 no es release**.

## Alcance

Epic [#160](https://github.com/Berserky/Galaxia-de-girasoles/issues/160), catálogo [VE-101–142](04-momentos.md) y [ROADMAP](ROADMAP.md). Rama temporal `feat/visual-evolution-5-p5-living-moments` desde el merge exacto `bb03a0bd`. Primero P5A, después P5B–P5E. No modificar IA, motor Chat, GPS/FCM nativos, backend, seguridad, permisos ni datos reales. Cambios de producto limitados a presentadores HTML/CSS, sin inventar estado emocional, duración de audio o progreso.

| Subfase | Enfoque | Estado |
|---|---|---|
| **P5A** | Jerarquía inicial, jardín escénico, gestos y actividades por intención (VE-101–105,108,111–112,117,119–120) | **Primera implementación en rama, NO certificada** |
| **P5B** | Jardín: hitos reales desbloqueados/por descubrir, etapa máxima 8, siguiente umbral auténtico; gestos con bloqueo temporal durante envío y feedback visual (VE-106,108–110,114,116) | **Implementación parcial en rama, nuevas pruebas/CI pendientes** |
| **P5C** | Sorpresas y juegos: sobres sin filtración, separación por turno/espera/partidas jugadas, opciones secundarias y pruebas (VE-123–132) | **Implementación inicial, requiere CI del SHA y revisión visual Android** |
| **P5D** | Ritual y notas: tres momentos semánticos, resumen, autor/versión/fecha, borrado protegido (VE-133–138) | Pendiente |
| **P5E** | Mensajes de voz: estados de carga, audio accesible, duración real, reproducción, evaluación visual y regresión integral (VE-139–142) | Pendiente |
| **Transversal** | VE-118 contexto disponible y VE-122 navegación contextual | Pendiente |

## Primera implementación P5A

- `android/app/src/main/assets/mobile/app.js`: misma función `momentsView`, mismas ocho acciones y `data-action` de Bond; portada «Nuestros momentos», separación «Para una cita» / «Para conectar», gestos accesibles, progreso expresado con `role=progressbar` y porcentaje real limitado a 0–100. `bondGardenVisual` usa etapa real validada, adornos `aria-hidden` y sigue generando únicamente elementos decorativos.
- `android/app/src/main/assets/mobile/galaxy-moments-v5.css`: capa nueva acotada a P5, superficies temáticas, profundidad del jardín, pantallas menores de 360px, foco visible, controles táctiles y `prefers-reduced-motion`. Evitar añadir reglas dispersas P5 a `app.css`.
- `android/app/src/main/assets/mobile/index.html`: carga CSS P5 tras hojas existentes, sin reemplazar el shell.
- `tests/visual-evolution-p5.test.mjs`: pruebas de preservación de `data-action`, etapa de jardín, porcentaje/progreso honesto, accesibilidad, CSS responsive y ausencia de llamadas nuevas a APIs.

**Garantías:** No se cambia persistencia de Bond, semántica de rachas, suscripciones, duración de audios, calendarios, confirmación de borrado, contenidos bloqueados, backend ni navegación global. Todos los contenidos actuales del módulo permanecen disponibles; la jerarquía inicial es un primer corte que necesita QA.

## Puertas y deuda

1. Validar `npm test` y contrato P5 contra **SHA del PR P5**; ningún PASS de P4 vale automáticamente para P5.
2. Revisar Android build/lint + instrumentación emulador y capturas reales a 320/360/393/412 CSS px, 7 temas, 135 % texto y reduced-motion, incluyendo jardín con 0/varios días, 0–7 etapas y mensajes largos.
3. Verificar rutas de botón, gestos personalizados, hápticos, permisos, progreso/racha, sorpresa bloqueada, juego, ritual, notas, voz y retorno de navegación; probar cargas, vacío, offline y sin permisos.
4. Contrast/44px, safe-area y no solapamiento de FAB Chat. Auditoría estética con capturas **del APK real**, no solo Chrome; aprobación visual antes del merge a `desarrollo`.
5. P5 progresará en PR draft; jamás promocionar a `qa`/`prod` o generar APK estable por los checks de una fase.

**Excepciones heredadas de P4:** VE-085 (entrega real de avisos sin fuente verificable) y VE-093 (consistencia visual) permanecen documentadas; no inferir que quedaron reparadas con el merge visual P4.

**Revert:** revertir PR de P5 en `desarrollo` si llegara a fusionarse; cambios de P5A no incluyen migraciones ni writes backend. Antes del merge basta abandonar su rama, sin tocar `desarrollo`.

**Estado actual:** primera implementación P5A subida, *checks nuevos y capturas pendientes*, P5B–E no iniciadas, PR P5 debe seguir DRAFT hasta cierre.

## Continuación P5B — 16 octubre 2026

**Comprobación de fuente:** `supabase/functions/android-companion/bond-engine.ts` define etapas **0–8** (no 0–7), un `garden.next` con `days/label`, `garden.milestones` con hitos bloqueados y desbloqueados y `progressPct`. Antes P5A ilustraba máximo 7 flores y truncaba `data-stage` a 7, omitiendo la etapa real 8. P5B conserva máximo 7 flores decorativas **sin ocultar stage 8**; muestra el próximo umbral únicamente si está en los datos y diferencia hitos mediante iconos autorizados del motor y etiquetas de accesibilidad.

- El envío de gestos ahora marca el botón `aria-busy=true` y `disabled` durante la solicitud, bloquea doble toque en ese control y restaura estado al fallar. **No promete entregas FCM**; el éxito representa aceptación de API de Bond y se conserva el toast ya existente.
- CSS añade tarjetas de hitos con etiqueta «Logrado» o «Por descubrir», sin atenuación que impida contraste, y feedback de envío; `prefers-reduced-motion` de P5A continúa vigente.
- `tests/visual-evolution-p5.test.mjs` comprueba stage 8, hitos backend, sanitización HTML, ausencia de umbrales inventados y estado de botón. **No declarar PASS de este HEAD nuevo hasta sus workflows propios y evidencia Android.**
- **No cerrados aún:** VE-107 (puesta en escena emocional fina), VE-113 (identidad expresiva integral), VE-115 (configuración de gestos junto a acción), VE-116 (permisos/hápticos en flujo real), y el resto de P5C–P5E. Evitar marcar los 42 ID aprobados por la implementación preliminar.

## Primera implementación P5C — 17 octubre 2026

- `app.js::surpriseNotesView` pasa de tarjeta plana a sobre semántico con estado `sealed/unlocked`; las sorpresas bloqueadas **no insertan** título, cuerpo ni reproductores de voz en el DOM. No se altera `surpriseUnlocked` ni se atribuye a esta vista la autorización del backend: el servidor y su proyección privada siguen siendo autoridad sobre acceso.
- Se mantienen las acciones existentes `surprise-note-new`, `voice-for-item` y `item-delete`, con las destructivas tras `details/summary` y su confirmación de borrado anterior intacta.
- `app.js::gameMomentsSection` agrupa `Juego de nosotros` en «Te toca responder», «Esperando respuesta» y «Partidas jugadas» sin alterar entradas ni API. `gameCard` conserva la respuesta del otro oculta hasta jugar, las opciones originales `game-guess`, feedback de resultado y eliminación existente dentro del menú secundario.
- `galaxy-moments-v5.css`: tarjetas diferenciadas, touch targets al menos 44px para opciones, 320px en una columna, foco visible y reduced motion.
- `tests/visual-evolution-p5.test.mjs`: pruebas de no filtración del DOM bloqueado, preservación de las rutas de botones, agrupación exhaustiva de tres estados y seguridad de la respuesta antes de jugar.
- **No declarar PASS de P5C hasta probar el nuevo HEAD en Actions**. Pendiente revisar captura de APK real, contenido largo, perfiles de ambos usuarios, comportamiento sin datos y efectos de gestos; la prueba Node por sí sola no certifica interfaz Android.
