# P5 · Handoff de integración Android — Jardín Vivo V3.3 (4 recursos)

> Actualizado 21/oct/2026. Contrato ejecutable de integración **pendiente**; no representa APK instalada ni aprobación visual. PR [#171](https://github.com/Berserky/Galaxia-de-girasoles/pull/171) permanece en borrador. No editar recursos Android restringidos por canales alternativos ni desplegar.

## Estado inequívoco

La prueba Android 15/15 del SHA `145302d85ed5f83015f5f237184d4aeafa63518d` corresponde a la **APK anterior**, no a V3.3. El motor V3.3 se extrae de `docs/visual-evolution-5/prototypes/jardin-vivo-v3.3.html`; el puente y el controlador autenticado existen como código de preparación. Los assets no están referenciados desde `android/app/src/main/assets/mobile/index.html` ni instalados en la APK. Las etapas oficiales de Bond siguen siendo 0–8. Los capítulos pradera/valle/región/planeta/constelación son **solo demo de diseño**, sin backend ni progreso real.

## Paquete único de cuatro recursos

`node scripts/p5-garden-candidate-export.mjs --out /tmp/galaxy-v33-NEW` exporta **solo a carpeta nueva externa**. El manifiesto esquema 3 aporta SHA-256 y tamaños exactos de:

1. `galaxy-garden-world-v3.css`: estilos del jardín, se ubicarían **después** de `galaxy-moments-v5.css`.
2. `galaxy-garden-world-v3.js`: motor `window.GalaxyGardenV5`, antes del puente.
3. `p5-garden-bond-bridge.js`: `window.GalaxyGardenBondBridge`, antes del controlador.
4. `p5-moments-garden-lifecycle.js`: `window.GalaxyMomentsGardenLifecycle`, **después** del puente y antes de `app.js`.

La exportación rechaza alias simbólicos hacia el checkout, rutas Android y archivos de salida preexistentes. Un paquete no constituye integración real.

## Handoff de app para ejecución cuando la escritura esté permitida

El presentador existente `bondGardenVisual(garden)` se concatena en `momentsView()` dentro de `<div class="card bond-garden living-garden">`; `render()` reconstruye `app.innerHTML` al cambiar datos y la pestaña. Una sustitución directa que llame `GalaxyGardenBondBridge.create()` durante el armado de la cadena HTML es prematura: **el host aún no existe**.

Secuencia de implementación a validar en código autorizado, **no aplicada**:

1. `bondGardenVisual(garden)` devuelve un host **de escena** seguro, etiquetado de forma inequívoca (p. ej., `data-p5-garden-host`) más fallback original, sin interpolar estado Bond como atributos HTML. La escena original no se retira antes de demostrar que el motor está listo.
2. Después de insertar `momentsView()` en el DOM, una instancia de `GalaxyMomentsGardenLifecycle.create()` recibe `update({host,cloud,sessionKey})` cuando exista un identificador **estable de vinculación autenticada**; **cloud es el snapshot autenticado original**, no `{bond:{garden:{stage:bondGardenStage(garden)}}}`. El `sessionKey` no debe inventarse a partir de hora, nombre de usuario o de un ID de demostración; si todavía no hay identidad de pareja estable, se admite `update({host,cloud})` en modo legado únicamente con `reset()` obligatorio al desparejar/cambiar de vínculo.
3. `authenticGarden(cloud)` considera el progreso ausente cuando falta `cloud.bond.garden`; rechaza el falso día 0 derivado del fallback actual de `momentsView()`. El auténtico `stage:0` sí debe ser válido.
4. El controlador conserva estado de primera entrada entre rerenders: `initialEntrance:'none'` cuando regresa el mismo jardín, de modo que no florezcan ocho veces las mismas flores. Cambiar tema/hora conserva nodos, etapa verdadera activa renderización propia.
5. En navegación fuera de Momentos se llama `leave()` para desconectar observadores. Al desparejar o cambiar de identidad emparejada, se llama **`reset()`**; este ahora también **borra inmediatamente la escena antigua del host**. Con `sessionKey` suministrado, la detección de una clave nueva reinicia sola el jardín; si una actualización omite o invalida el identificador después de vincularse, la operación **falla cerrada** (`SESSION_IDENTITY_REQUIRED`/`INVALID_SESSION_IDENTITY`) y borra las flores anteriores. No registrar ni mostrar la clave en DOM/logs. Nunca conservar escenas de otra pareja.
6. Conservar HTML/flujo de hitos, progreso, gestos, juego, sorpresas privadas, rituales, notas, voz, navegación y Chat. No alterar contratos Bond, datos personales, IA, FCM, permisos ni GPS.

**Gate estático obligatorio antes de cualquier APK nueva**: `node scripts/p5-android-integration-gate.mjs` (falla cerrado y comprueba orden/hashes/wiring). Solo devuelve `STATIC_PREFLIGHT_READY_ANDROID_QA_REQUIRED` cuando el paquete está enlazado de verdad; `androidVerified` es **siempre false** en ese gate, incluso cuando todos los archivos están instalados.

## Pruebas nativas que continúan pendientes

- APK emparejada y sin emparejar, stages reales 0/3/8 y fallback sin Bond. Asegurar 8 flores primeras persistentes y no desbloquear demostraciones.
- Android WebView real 320/360/393/412, siete temas, mañana/atardecer/noche, estaciones climáticas no tropicales y `WebSettings textZoom=135`.
- Seis etiquetas nav completas y legibles, botones >=44 px, foco/aria-current, sin colisiones con controles flotantes. El candidato aislado de [#176](https://github.com/Berserky/Galaxia-de-girasoles/issues/176) pasó Chromium, **no está instalado**.
- Scroll de las cinco áreas inferiores, privacidad y gestos, audio real sin duraciones inventadas, reduced-motion, observadores pausados, métricas CPU/memoria/jank, screenshot físico de framebuffer en emulador. Problemas de fiabilidad [#173](https://github.com/Berserky/Galaxia-de-girasoles/issues/173), [#174](https://github.com/Berserky/Galaxia-de-girasoles/issues/174), [#175](https://github.com/Berserky/Galaxia-de-girasoles/issues/175) continúan abiertos.
- **15/15 workflows del SHA que realmente incluya integración**, después capturas y aprobación visual explícita. Ningún merge a `desarrollo`, QA ni producción sin su autorización independiente.

**Código preparado no es código instalado.** El siguiente hito de cierre depende de autorización efectiva para modificar los archivos Android protegidos y de QA nativo sobre esa modificación.
