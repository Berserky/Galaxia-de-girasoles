# V5-P5 — Living Moments · progreso y handoff

> **Inicio 16 octubre 2026 (Bogotá).** V5-P4 [PR #170](https://github.com/Berserky/Galaxia-de-girasoles/pull/170) **fusionado a `desarrollo`** en `bb03a0bd7e84901d0add76bd1e04e6c127eb6d5f` después de aprobación visual explícita, 15/15 workflows del mismo SHA P4 y 23 capturas Android. `qa` y `prod` **no se modificaron**. **P5 no es release**.

## Alcance

Epic [#160](https://github.com/Berserky/Galaxia-de-girasoles/issues/160), catálogo [VE-101–142](04-momentos.md) y [ROADMAP](ROADMAP.md). Rama temporal `feat/visual-evolution-5-p5-living-moments` desde el merge exacto `bb03a0bd`. Primero P5A, después P5B–P5E. No modificar IA, motor Chat, GPS/FCM nativos, backend, seguridad, permisos ni datos reales. Cambios de producto limitados a presentadores HTML/CSS, sin inventar estado emocional, duración de audio o progreso.

| Subfase | Enfoque | Estado |
|---|---|---|
| **P5A** | Jerarquía inicial, jardín escénico, gestos y actividades por intención (VE-101–105,108,111–112,117,119–120) | **Primera implementación en rama, NO certificada** |
| **P5B** | Jardín: hitos reales desbloqueados/por descubrir, etapa máxima 8, siguiente umbral auténtico; gestos con bloqueo temporal durante envío y feedback visual (VE-106,108–110,114,116) | **Implementación parcial en rama, nuevas pruebas/CI pendientes** |
| **P5C** | Sorpresas y juegos: sobres sin filtración, separación por turno/espera/partidas jugadas, opciones secundarias y pruebas (VE-123–132) | **Implementación inicial, requiere CI del SHA y revisión visual Android** |
| **P5D** | Ritual y notas: tres momentos semánticos, resumen, autor/versión/fecha, borrado protegido (VE-133–138) | **Primera implementación en rama; CI del nuevo SHA y Android P5 pendientes** |
| **P5E** | Mensajes de voz: transporte HTMLAudioElement delegado, duración/seek reales, estados de carga/error, identidad visual, teclado (VE-139–142) | **Primera implementación en rama; gate CI y evidencia Android P5 pendientes** |
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

**Nota histórica P5A:** este estado corresponde al primer corte del 16 de octubre; para el estado verificado del HEAD vigente consultar la sección de certificación Android P5 al final. El PR permanece DRAFT hasta aceptación visual.

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

## Primera implementación P5D — 17 octubre 2026

- `app.js::ritualCard`: ritual semanal distribuido en tres bloques semánticos «Gracias», «Necesito» y «Próximo plan», conservando datos y edición **solo para el autor**. La semana se muestra únicamente cuando existe.
- `app.js::sharedNoteCard`: las notas largas (>220 caracteres) tienen resumen derivado del propio texto y expansión accesible `details/summary` que preserva **el contenido íntegro**, sin truncar la fuente. Ambos participantes mantienen el acceso a editar.
- `livingEntryMeta` utiliza únicamente `author`, `created` y `version` disponibles y válidos; si faltan o son inválidos no se muestra una versión inventada ni una fecha falsa. `created` se presenta con `time[datetime]` y formato local.
- Los botones de editar/eliminar pasan a «Opciones» secundarias, sin alterar rutas `data-action`. `bondDelete` sigue solicitando confirmación y enviando `{id,version}`; no se modifican backend, permisos ni persistencia.
- CSS exclusivamente en `galaxy-moments-v5.css` con 44px para disclosures, foco visible, contenido largo sin desbordamiento y reduced motion. Pruebas VM de datos faltantes, HTML escapado, nota larga, autor y contratos destructivos en `tests/visual-evolution-p5.test.mjs`.
- **No declarar P5D cerrada** hasta que apruebe CI del SHA nuevo y se obtengan capturas/JUnit del APK real de P5 en cuatro anchos, siete temas y escala de texto 135 %. P5E y mejoras transversales siguen pendientes.

## Primera implementación P5E — 17 octubre 2026

- `app.js::voiceCard` conserva tarjeta con autor, fecha/version del registro si existen, transcripción opcional y acciones `voice-transcribe` / `voice-transcript-delete` / `bond-delete` detrás de un menú secundario. El reproductor usa el `audioUrl` privado temporal existente (sin cambios de firma, consulta, backend, permisos ni storage).
- `galaxy-voice-v5.js` es un controlador delegado único sobre `HTMLAudioElement`, sin API, almacenamiento ni temporizadores propios. Pause/play, detener otros mensajes simultáneos, `loadedmetadata`, `durationchange`, `timeupdate`, `error` y `waiting` actualizan el texto y los controles. El tiempo total se presenta `--:--` **hasta conocer la duración real finita**; si el audio no existe se muestra indisponibilidad y no un player falso; `preload=none` evita cargas anticipadas.
- `galaxy-moments-v5.css` aplica controles con foco visible, superficie temática, 48px para play/pause, seek accesible en WebView Android, barras visuales puramente decorativas **no presentadas como forma de onda real**, ancho 320 y reduced motion.
- `index.html` carga el controlador antes de `app.js` y `tests/visual-evolution-p5.test.mjs` suma contratos VM de duración finita/desconocida, media events y preservación de acciones, privacidad y accesibilidad.
- **No declarar P5E PASS ni fase completa** antes de obtener 15/15 controles del HEAD final, pruebas Android WebView reales en Momentos, autorización visual explícita, rutas de audio sin conexión/reenlace temporal y regresión de los demás módulos que también usan `voiceCard`.

## Certificación Android P5 — evidencia y deuda del 17 octubre 2026

**Checkpoint verificado:** rama `feat/visual-evolution-5-p5-living-moments`, SHA `2289b498b37e97198147ce4007146a173ba94fc8`. **15/15 workflows GitHub Actions completados SUCCESS para ese SHA**; el workflow Camera Media [39064903726](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/39064903726) tuvo un fallo inicial de infraestructura al descargar el emulador (archivo ZIP inválido), y su **único job fallido** aprobó tras repetición específica. No extrapolar este resultado a SHA posteriores.

- [V5 P0 run 39064903705](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/39064903705): Node **738/738 PASS**, AVD Android PASS y Chrome sintético PASS. Artefacto Android real **12112853219**, `v5-p0-android-unpaired-avd-evidence`.
- JUnit Android del artefacto: **2 tests, 0 failures, 0 errors, 0 skipped**, incluidos `visualEvolutionP5_realMomentsAndroidScreens_andPrivacy` (26.293 s) y el gate P1 (139.835 s). `p1-device-summary.json` declara `p5_android_verified_by_real_instrumentation=true` y `status=VERIFIED_SYNTHETIC_QA`. Son **fixtures sintéticos**, no cuentas ni datos de pareja reales.
- **15 PNG P5 del APK real**: cuatro `build/p0-avd/p5-moments/{320,360,393,412}.png`, cuatro `p5-text-zoom/{320,360,393,412}.png` (WebView text zoom 135 %) y siete `p5-themed-moments/{christmas,cosmic,daylight,easter,friendship,halloween,valentine}.png`. No confundirlos con capturas Chrome sintéticas.
- **Cobertura confirmada:** portada y jardín con fixture `garden.stage=3`; el test comprueba presencia DOM de módulos inferiores, privacidad de sorpresa cerrada, objetivos táctiles y ausencia de desbordamiento horizontal. **No** certifica visualmente `stage=8` ni tarjetas de sorpresa, juego, ritual, nota larga expandida y audio: las 15 capturas fueron tomadas con scroll inicial en el encabezado.
- **Hallazgo visual reproducible (pendiente de corrección y nuevo gate):** en `p5-text-zoom/320.png` el FAB de Chat **tapa parte del párrafo del jardín** a 135 % y la navegación inferior abrevia las etiquetas «Mome…» y «Recue…»; en `p5-moments/393.png` el FAB se superpone al extremo derecho de la tarjeta «Próximo hito». Las comprobaciones automáticas de ancho/tamaño táctil **no detectan estas colisiones visuales**. No marcar VE-107/113 ni accesibilidad como aprobadas solo por el JUnit verde. La barra cian superior visible en QA es un marcador de pintura del test, no un componente final de producto.
- **Siguiente gate necesario:** fixture QA **opt-in** estable frente a `mobile-state`/refresh (45 s), con etapa 8, hitos y datos ficticios; capturas Android con scroll real hasta sorpresa/juego/ritual/nota/audio, foco y reduced motion, detección explícita de superposición del FAB y truncamiento de navegación a 320 px/135 %. Conservar los asserts existentes, 15 PNG anteriores y todos los gates P0–P4. Verificar capturas/JUnit del nuevo SHA antes de solicitar aprobación humana.

**Bloqueo de escritura anterior:** se preparó un árbol Git para extender el gate P5 (fixture, instrumentación, script y esta documentación), pero el intento de crear ese commit fue bloqueado por controles de seguridad; **no se integró esa ampliación**. No repetir ni eludir esa operación bloqueada sin nuevas condiciones. El presente registro de evidencia no equivale a implementar el gate faltante.

**Criterio de cierre:** PR #171 sigue DRAFT; no fusionar a `desarrollo` sin nueva evidencia Android de secciones inferiores/etapa 8, revisión de los 42 hallazgos VE-101–142 y aprobación visual humana explícita. Nunca promocionar a QA/producción por este checkpoint.


## Auditoría de cierre P5 — 18 octubre 2026 (05:13 Bogotá)

**Base auditada:** `1143b0cd9d8d3384276849fa6312fc49f5adc18b` (PR #171 abierto, DRAFT). En **ese SHA** se verificaron **15/15 workflows SUCCESS** tras reejecutar el job AVD fallido del run [39099393043](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/39099393043); Node 742/742 PASS, Chrome PASS y JUnit Android 2/2 PASS en el **segundo intento**. El primer intento AVD `117592362421` falló en `GalaxyDeviceClosureTest.java:945` por `JSONException: Value ERR ...`; el segundo `117625383769` aprobó **sin modificar código**. Por tanto, el posible flake del test P1/P4 **no está corregido**. No transferir este PASS a commits posteriores, incluido cualquier commit de documentación.

**Evidencia Android del mismo SHA:** artifact `12130373124` (segundo intento), capturas de P5 en 320/360/393/412, siete temas y 135 % de texto. Portada y jardín **stage 3** presentes. No existen aún capturas visuales de **stage 8** ni de las **cinco tarjetas inferiores** (sorpresa, juego, ritual, nota, audio). En `p5-text-zoom/360.png` las etiquetas de la navegación inferior se abrevian a «Mome…» y «Recue…»; comprobar legibilidad, nombre accesible y superposición FAB a 320 px/135 %. Las capturas son fixtures de QA, no datos reales.

### Defectos reproducibles por inspección de código (pendientes; no declarar reparados)

1. **VE-122 / scroll:** `app.js:405` `go(next)` ejecuta `render();window.scrollTo(0,0)` aun cuando `next===view`. Reproducir: abrir Momentos, desplazar hasta ritual/notas/audio y activar una acción que regrese a `moments`; comprobar si el usuario pierde el contexto. Aceptación: conservar o restaurar la posición al volver desde acciones internas, pero seguir llevando arriba en navegación explícita a otra sección, sin romper restauración de Chat.
2. **Umbrales falsos / tipado:** `app.js:1266` valida `Number(row.days)` con `Number.isInteger(days)&&days>=0`; `app.js:1289` hace lo mismo para `garden.next.days`. En JavaScript `Number(null)===Number('')===Number(false)===0`; así, valores ausentes/vacíos/booleanos pueden mostrarse como «0 días» aunque no exista umbral real. Reproducción: fixtures `{days:null}`, `{days:''}`, `{days:false}` tanto en `milestones[]` como en `next`. Aceptación: omitir umbral cuando el dato original no sea número entero no negativo explícito (o cadena numérica válida según contrato real), conservar `0` numérico legítimo si el contrato lo permite; sin inventar hitos.
3. **Datos métricos inválidos:** `app.js:1287` convierte `totalDays/currentStreak/recordStreak` con `Number(...)` sin acotar valores negativos o `NaN`. Aceptación: mostrar solo métricas finitas y no negativas provenientes de datos válidos; distinguir «sin dato» de cero real según contrato Bond.
4. **AVD P1/P4 intermitente:** `jsWithDeadline()` devuelve una cadena `ERR:...` al capturar JS; `new JSONObject(placeProof)` intenta parsearla en `GalaxyDeviceClosureTest.java:945`. El snapshot JS usa `getBoundingClientRect()` de selectores de mapa sin comprobar `null`, posiblemente durante reconstrucción asíncrona de marcadores. Hipótesis, no causa confirmada. Aceptación: captura atómica con diagnóstico íntegro del error, espera determinista si hay redibujado, **sin relajar** foco, 44 px ni límites de viewport.

### Puerta visual que continúa abierta

Crear evidencia Android instrumentada y reproducible de jardín **stage 0, 3 y 8**, hitos bloqueados/desbloqueados y las cinco tarjetas inferiores, con scroll real, 320/360/393/412, siete temas, texto 135 %, foco y reduced-motion. Comprobar que el FAB no cubre contenido y que la navegación conserva etiquetas/nombres accesibles. No cerrar VE-107/113 ni fusionar el PR #171 sin evidencia integral y aprobación visual humana. **No se han integrado aquí parches de aplicación, CSS ni instrumentación**: las operaciones previas sobre esos archivos fueron bloqueadas y no deben repetirse ni eludirse.
