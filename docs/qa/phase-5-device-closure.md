# Fase 5 — QA Automation & Device Closure

## Alcance

NG-QA-006 reemplaza validaciones críticas basadas únicamente en inspección de strings por pruebas que arrancan la aplicación Android, cargan el WebView real, atraviesan el bridge nativo y consumen el contrato HTTP mediante `ApiClient` / `MobileApiClient`.

La rama de trabajo es `qa/phase-5-real-integration`, creada desde `main@96950e88` después de las Fases 2, 3 y 4.

## Regla de entornos

- **Producción:** prohibida para estas pruebas.
- **Android hermético:** `androidTest` usa un servidor HTTP loopback disponible solo en el build `debug`.
- **Staging remoto:** solo se ejecuta si GitHub tiene un endpoint y dos tokens QA explícitos.
- El probe remoto bloquea de forma deliberada el project ref productivo `zqiknzivfahvvadmxrvt`.
- Si no existe staging remoto, el job deja evidencia `NOT_EXECUTED`; nunca lo convierte en `VERIFIED`.

## Matriz automatizada

| Área | Prueba ejecutable | Evidencia esperada |
|---|---|---|
| Inicio | Arranque con vínculo cifrado y carga de `mobile-state` | Android instrumentation |
| Navegación | Inicio/Mapa/Momentos/IA/Recuerdos/Más | Android instrumentation |
| Modales | Ajustes de Galaxy Chat abren/cierran `dialog` real | Android instrumentation |
| Teclado | Foco real de textarea + entrada ADB | Android instrumentation |
| Galaxy Chat | Render, envío, estado local, refresh | Android instrumentation |
| 13 Galaxy Cards | MEMORY, PLAN, GOAL, PLACE, SONG, ETA, CHECK_IN, POLL, CHECKLIST, CAPSULE, DAILY_QUESTION, EVENT, STATUS | 13 cards renderizadas en WebView |
| Poll | Voto llama `chat-poll` | Android instrumentation |
| Checklist | Cambio llama `chat-checklist` | Android instrumentation |
| Cápsulas | Card bloqueada + contenido existente en Recuerdos | Android instrumentation |
| Daily | Pregunta diaria y respuestas de fixture | Android instrumentation |
| Goals | Vista y `goals-engine` | Android instrumentation |
| Plans / Events | Estado inicial y cards correspondientes | Android instrumentation |
| Context / ETA | Map state + cards ETA/CHECK_IN | Android instrumentation |
| Map / GPS | Vista real + `map-state` con dos ubicaciones | Android instrumentation |
| Push / deep link | Cold launch con extras de notificación abre Chat | Android instrumentation |
| Offline / retry | 503 controlado produce fallo y reintento exitoso | Android instrumentation |
| Slow network | shaping de ~900 ms | Android instrumentation |
| Timeout/no-response | conexión sin respuesta provoca error real de red | Android instrumentation |
| Backup | export + import sobre contrato móvil | Android instrumentation |
| Update | presencia/alcance del control de actualización sin publicar APK | Android instrumentation |
| Permisos | grant/revoke Android de cámara, micrófono y ubicación | Android instrumentation |
| Foreground/background | lifecycle instrumentation + HOME/foreground por ADB | androidTest + workflow |
| Killed/cold start | `am force-stop` + arranque explícito | workflow |
| Rotación | landscape/portrait con continuidad del Chat | Android instrumentation |
| Font scaling | `font_scale=1.30` + recreate | Android instrumentation |
| Dark theme | `cmd uimode night yes` + recreate | Android instrumentation |
| Cámara | intent real cuando el emulador tiene handler | condicional; skip explícito si no existe |
| Micrófono | inicio/parada del recorder cuando el emulador expone input | condicional |
| File picker | `ACTION_OPEN_DOCUMENT` real cuando existe DocumentsUI | condicional |
| Dual user hermético | dos tokens/perfiles con envíos concurrentes y visibilidad mutua | Android instrumentation |
| Dual user staging | dos tokens independientes, concurrencia y propagación remota | `scripts/qa-phase5-staging.mjs`; requiere staging |

## Estados de verificación

No se marca una fila como **VERIFIED** solo porque exista el test.

- `AUTOMATED_PENDING`: existe automatización pero aún no hay ejecución verde asociada al commit.
- `VERIFIED`: la ejecución correspondiente terminó correctamente.
- `NOT_EXECUTED`: el entorno requerido no existe o no ofrece el hardware/proveedor.
- `FAILED`: se reprodujo un fallo. Si corresponde al producto recibe `NG-QA-006-XXX`, se corrige en esta rama y se agrega regresión.

## Staging remoto requerido

Variables/secrets esperados por GitHub Actions:

- `QA_STAGING_EDGE_URL`
- `QA_STAGING_PUBLISHABLE_KEY`
- `QA_STAGING_TOKEN_0`
- `QA_STAGING_TOKEN_1`

Los tokens deben representar perfiles `0` y `1` del **entorno QA**, no producción. El probe crea dos mensajes con prefijo `[QA5 ...]`, verifica visibilidad para ambos perfiles y los elimina al finalizar.

## Producción y release

Esta fase no incrementa `versionCode` / `versionName`, no publica `android-stable`, no despliega Edge Functions y no modifica el esquema productivo.
