# Nuestra Galaxia 4.1.1 — Matriz funcional

Fecha: 2026-10-08. Rama base: `desarrollo` @ `f5262991f3ab3fc65a6b39da2231915a453a9112`. Solo diagnóstico.

## Resumen y alcance
- Funcionalidades/unidades de verificación inventariadas: **92**.
- PASS **19**, BLOCKED **65**, NOT TESTED **8**, PARTIAL **0**, FAIL **0**, NOT IMPLEMENTED **0**.
- **PASS** se aplica solo a la comprobación descrita en la columna de evidencia: algunos PASS son **contratos automatizados**, no pruebas E2E de experiencia. Nunca extrapolar una prueba de motor a todo el módulo.
- **BLOCKED** identifica funcionalidades que dependen de vinculación y dos identidades efímeras de QA que no se aprovisionaron durante esta auditoría; **NO** equivale a defecto.
- **NOT TESTED** denota ejecución no realizada (hardware, estrés, pantallas). La presencia del código no equivale a PASS.
- Abreviaturas: `android/app/src/main/assets/mobile/app.js` = UI empaquetada; `supabase/functions/android-companion/index.ts` = Edge de backend; `tests/` = contratos automatizados Node.

## Inventario
| ID | Módulo | Función / alcance | Código / componente | Acceso | Dependencia | Evidencia o límite | Estado |
|---|---|---|---|---|---|---|---|
| NG-FNC-001 | Identidad | Pantalla de vinculación sin sesión | android/app/src/main/assets/mobile/app.js | Abrir APK limpio | Sin cuenta | Captura portrait API35 offline; instalación limpia | PASS |
| NG-FNC-002 | Identidad | Instalación del paquete 4.1.1 | android/app/build.gradle.kts | ADB install en AVD temporal | APK stable firmado | ADB Success, dumpsys 38/4.1.1 | PASS |
| NG-FNC-003 | Identidad | Inicio de sesión en web | app/google.mjs; app/server.mjs | Sitio web público | OAuth activo | No login de QA ejecutado | BLOCKED |
| NG-FNC-004 | Identidad | Google OAuth y persistencia | app/google.mjs; android/app/src/main/java/com/nuestragalaxia/companion/DeviceStore.java | Google / dispositivo vinculado | Identidad efímera QA | No sesión QA autorizada | BLOCKED |
| NG-FNC-005 | Identidad | Código de invitación de un solo uso | supabase/functions/android-companion/index.ts; android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java | Vincular dispositivo | Edge QA y código efímero | No emitir invitación real | BLOCKED |
| NG-FNC-006 | Identidad | Separación de perfiles | supabase/functions/android-companion/index.ts; android/app/src/main/java/com/nuestragalaxia/companion/DeviceStore.java | Dos usuarios QA | Dos identidades separadas | Solo contratos automáticos generales | BLOCKED |
| NG-FNC-007 | Identidad | Revocación de dispositivo | android/app/src/main/java/com/nuestragalaxia/companion/DeviceStore.java; supabase/functions/android-companion/index.ts | Ajustes | Dispositivo QA vinculado | No probado E2E | BLOCKED |
| NG-FNC-008 | Identidad | Manejo de token incorrecto/reutilizado | supabase/functions/android-companion/index.ts | Vinculación | Token de QA | No probado con dos perfiles | BLOCKED |
| NG-FNC-009 | Identidad | Cierre de sesión y cambio de usuario | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java; android/app/src/main/assets/mobile/app.js | Ajustes | Cuenta QA | Sin sesión QA | BLOCKED |
| NG-FNC-010 | Chat | Contratos del motor de mensajes | android/app/src/main/assets/mobile/chat-message-engine.js | Chat | Datos de prueba locales | Node: chat 4.0/4.1 tests PASS | PASS |
| NG-FNC-011 | Chat | Envío y recepción entre dos usuarios | android/app/src/main/assets/mobile/app.js; supabase/functions/android-companion/index.ts | Chat | Dos usuarios QA | No doble sesión E2E | BLOCKED |
| NG-FNC-012 | Chat | Estado de entrega y reconexión | android/app/src/main/assets/mobile/chat-delivery-engine.js | Chat | Realtime de QA | Contratos Node PASS; E2E bloqueado | BLOCKED |
| NG-FNC-013 | Chat | Scroll engine: contratos | android/app/src/main/assets/mobile/chat-scroll-engine.js | Chat | Fixtures Node | Pruebas chat-4-phase2/10/11 PASS | PASS |
| NG-FNC-014 | Chat | Scroll en conversación prolongada | android/app/src/main/assets/mobile/app.js | Chat > hilo largo | Conversación QA | No medido en UI vinculada | BLOCKED |
| NG-FNC-015 | Chat | Composer y borradores: contratos | android/app/src/main/assets/mobile/chat-composer.js | Chat > redacción | Fixtures Node | chat-4-phase4-composer PASS | PASS |
| NG-FNC-016 | Chat | Respuestas y referencias | android/app/src/main/assets/mobile/app.js | Chat > responder | Dos usuarios | No probado E2E | BLOCKED |
| NG-FNC-017 | Chat | Mensajes programados/silenciosos | android/app/src/main/assets/mobile/app.js | Chat > envío | Backend QA | No probado entrega real | BLOCKED |
| NG-FNC-018 | Chat | Búsqueda e historial | android/app/src/main/assets/mobile/app.js | Chat > buscar | Historial QA | No probado UI/E2E | BLOCKED |
| NG-FNC-019 | Chat | Encuestas/checklists | android/app/src/main/assets/mobile/app.js | Chat > crear contenido | Dos usuarios | Contratos Node PASS; no UX E2E | BLOCKED |
| NG-FNC-020 | Chat | Edición, eliminación, reacción, fijados | android/app/src/main/assets/mobile/app.js | Chat > menú contextual | Dos usuarios | No probado UI/E2E | BLOCKED |
| NG-FNC-021 | Chat | Chat offline/reanudación | android/app/src/main/assets/mobile/app.js | Chat > pérdida de red | Cuentas QA | No probado como usuario vinculado | BLOCKED |
| NG-FNC-022 | Chat | Teclado, scroll al abrir, foco | android/app/src/main/assets/mobile/app.js | Chat > escribir | Cuenta QA | Sin captura de Chat | BLOCKED |
| NG-FNC-023 | Chat | Lectura/recibos y notificaciones | android/app/src/main/assets/mobile/app.js | Chat y notificaciones | Realtime y FCM QA | No probado E2E | BLOCKED |
| NG-FNC-024 | Multimedia | Contrato de media/validación MIME | android/app/src/main/assets/mobile/chat-media-engine.js; android/app/src/main/java/com/nuestragalaxia/companion/MediaSniffer.java | Chat > adjuntar | Archivos sintéticos | Pruebas Node chat-4.1 block2 y multimedia PASS | PASS |
| NG-FNC-025 | Multimedia | Fotografía integrada | android/app/src/main/java/com/nuestragalaxia/companion/GalaxyCameraActivity.java | Chat > Cámara | Permisos y cámara virtual | No accesible sin vincular | BLOCKED |
| NG-FNC-026 | Multimedia | Video integrado | android/app/src/main/java/com/nuestragalaxia/companion/GalaxyCameraActivity.java | Chat > Video | Cámara virtual, micrófono | No accesible sin vincular | BLOCKED |
| NG-FNC-027 | Multimedia | Cambio frontal/posterior | android/app/src/main/java/com/nuestragalaxia/companion/GalaxyCameraActivity.java | Cámara integrada | Hardware virtual | No probado | NOT TESTED |
| NG-FNC-028 | Multimedia | Vista previa, repetir, cancelar | android/app/src/main/java/com/nuestragalaxia/companion/GalaxyMediaReviewActivity.java | Cámara > previsualización | Captura QA | No probado UI | BLOCKED |
| NG-FNC-029 | Multimedia | Controles superpuestos cámara/video | android/app/src/main/java/com/nuestragalaxia/companion/GalaxyCameraActivity.java | Foto/Video | Cámara en cuenta QA | Sin captura de pantalla | BLOCKED |
| NG-FNC-030 | Multimedia | Grabación/reproducción de voz | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java; chat-voice-engine.js | Chat > voz | Permisos y cuenta QA | Contratos de voz Node PASS; UI bloqueada | BLOCKED |
| NG-FNC-031 | Multimedia | Picker de fotos y documentos | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java | Chat > adjuntos | Media QA | Sin adjuntos E2E | BLOCKED |
| NG-FNC-032 | Multimedia | Formatos HEIC/HEIF | android/app/src/main/java/com/nuestragalaxia/companion/MediaSniffer.java; android/app/src/main/java/com/nuestragalaxia/companion/MediaInspector.java | Chat > adjuntar | Archivos HEIC de prueba | Solo contratos Node | NOT TESTED |
| NG-FNC-033 | Multimedia | GIFs/GIPHY/stickers | android/app/src/main/assets/mobile/app.js; supabase/functions/android-companion/index.ts | Chat > GIF/sticker | Proveedor y token QA | Test branding PASS; consumo externo bloqueado | BLOCKED |
| NG-FNC-034 | Multimedia | Atribución de GIPHY: contrato | tests/giphy-attribution-brand.test.mjs | Picker GIF | Proveedor oficial | Node PASS | PASS |
| NG-FNC-035 | Multimedia | Permisos cámara/micrófono | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java; AndroidManifest.xml | Android permisos | Dispositivo vinculado | No denegación/concesión en flujo real | BLOCKED |
| NG-FNC-036 | Música | MP3 local/privado | android/app/src/main/assets/mobile/app.js | Música | Archivo autorizado | Sin cuenta vinculada | BLOCKED |
| NG-FNC-037 | Música | Reproductor integrado | android/app/src/main/assets/mobile/app.js | Menú Música | Contenido QA | No probado UI | BLOCKED |
| NG-FNC-038 | Música | Bienvenida con música | android/app/src/main/assets/mobile/app.js | Bienvenida | Pareja vinculada | No probado | BLOCKED |
| NG-FNC-039 | Música | Reproducción automática | android/app/src/main/assets/mobile/app.js | Inicio tras bienvenida | Política WebView y audio | No probado | BLOCKED |
| NG-FNC-040 | Música | Controles flotantes | android/app/src/main/assets/mobile/app.js | Reproductor | Pista disponible | No probado | BLOCKED |
| NG-FNC-041 | Música | URLs Spotify/YouTube | android/app/src/main/assets/mobile/app.js | Añadir música por URL | Proveedores externos | No streaming real | BLOCKED |
| NG-FNC-042 | Música | Pausa/reanudación y segundo plano | android/app/src/main/assets/mobile/app.js; android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java | Reproductor | Audio activo | No probado | BLOCKED |
| NG-FNC-043 | Mapas | Cálculo unitario de distancias | android/app/src/main/assets/mobile/distance.js | Mapa > distancia | Coordenadas fixture | android-distance.test PASS | PASS |
| NG-FNC-044 | Mapas | Cálculo unitario ETA | android/app/src/main/assets/mobile/eta.js | Mapa > ETA | Coordenadas fixture | android-eta.test PASS | PASS |
| NG-FNC-045 | Mapas | Visualización mapa/teselas | android/app/src/main/assets/mobile/map.js | Menú Mapa | Usuario vinculado y red | No probado visual real | BLOCKED |
| NG-FNC-046 | Mapas | GPS voluntario/consentimiento | android/app/src/main/java/com/nuestragalaxia/companion/TrackingService.java; android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java | Mapa > compartir ubicación | Permisos | No activado en QA | BLOCKED |
| NG-FNC-047 | Mapas | Velocidad y modo movimiento | android/app/src/main/java/com/nuestragalaxia/companion/MotionClassifier.java | Mapa / Tracking | GPS simulado | Contratos y CI Android; sin medición dinámica | NOT TESTED |
| NG-FNC-048 | Mapas | Distancia y ETA en mapa en vivo | android/app/src/main/assets/mobile/app.js; eta.js | Mapa > pareja | Dos perfiles QA con GPS | Cálculo unitario PASS; UI bloqueada | BLOCKED |
| NG-FNC-049 | Mapas | Cercanía/encuentros | android/app/src/main/assets/mobile/encounters.js | Mapa > cercanía | Dos posiciones QA | No probado real | BLOCKED |
| NG-FNC-050 | Mapas | Historial GPS/privacidad | android/app/src/main/assets/mobile/gps-history.js; supabase/functions/android-companion/index.ts | Mapa > historial | Datos QA | Solo test de contratos | BLOCKED |
| NG-FNC-051 | Mapas | Sin señal GPS o red | android/app/src/main/java/com/nuestragalaxia/companion/TrackingService.java | Mapa en modo offline | Permisos y ubicación simulada | No activado | NOT TESTED |
| NG-FNC-052 | Mapas | Consumo batería/CPU | android/app/src/main/java/com/nuestragalaxia/companion/TrackingService.java | Seguimiento en background | Soak QA | Sin medición real | NOT TESTED |
| NG-FNC-053 | Mapas | Exportar/borrar historial | android/app/src/main/assets/mobile/gps-history.js | Mapa > historial | Datos efímeros | No probado | BLOCKED |
| NG-FNC-054 | Momentos | Lógica objetivos: contratos | tests/android-goals-engine.test.mjs | Nuestros objetivos | Fixtures de metas | Node PASS | PASS |
| NG-FNC-055 | Momentos | Abrir pantalla Nuestros objetivos | android/app/src/main/assets/mobile/app.js | Más/Explorar > Objetivos | Dispositivo vinculado | goalsView existe; sin navegación E2E | BLOCKED |
| NG-FNC-056 | Momentos | Crear/editar/completar objetivo | android/app/src/main/assets/mobile/app.js | Objetivos > acciones | Dos usuarios QA | No probado | BLOCKED |
| NG-FNC-057 | Momentos | Metas de ahorro manual | android/app/src/main/assets/mobile/app.js | Objetivos > Ahorro | Dos usuarios QA | No probado | BLOCKED |
| NG-FNC-058 | Momentos | Planes y lugares | android/app/src/main/assets/mobile/app.js | Crear/Explorar | Vínculo y backend | No probado | BLOCKED |
| NG-FNC-059 | Momentos | Recuerdos/galería | android/app/src/main/assets/mobile/app.js | Recuerdos | Datos QA | No probado | BLOCKED |
| NG-FNC-060 | Momentos | Experiencias y widgets | android/app/src/main/java/com/nuestragalaxia/companion/BondWidget.java; android/app/src/main/assets/mobile/app.js | Momentos / widget Android | Vínculo y widget activo | Node contratos widget; sin UI emparejada | BLOCKED |
| NG-FNC-061 | Momentos | Rituales/notas/cápsulas | android/app/src/main/assets/mobile/app.js | Momentos/Explorar | Datos QA | No probado | BLOCKED |
| NG-FNC-062 | Momentos | Compartir contenido interactivo | android/app/src/main/assets/mobile/app.js | Crear > compartir | Dos usuarios | No probado E2E | BLOCKED |
| NG-FNC-063 | Momentos | Animaciones de experiencias | android/app/src/main/assets/mobile/app.js | Abrir momentos | Vínculo | Sin captura emparejada | BLOCKED |
| NG-FNC-064 | IA | Contratos de IA local/motor | tests/android-intelligence-engine.test.mjs | IA | Fixtures | Node PASS | PASS |
| NG-FNC-065 | IA | Acceso a IA en barra principal | android/app/src/main/assets/mobile/app.js | Nav > IA | Dispositivo vinculado | Nav declara IA; no probado UI emparejada | BLOCKED |
| NG-FNC-066 | IA | Búsqueda semántica pgvector | supabase/functions/android-companion/index.ts | IA > buscar | RLS QA y vectorización | No consulta real | BLOCKED |
| NG-FNC-067 | IA | Calidad de respuestas/conexiones | android/app/src/main/assets/mobile/app.js | IA > pregunta | Dataset real anonimizado/QA | No probado | BLOCKED |
| NG-FNC-068 | IA | Narrador y transcripción | android/app/src/main/assets/mobile/app.js | IA > herramientas | Servicios externos | No probado | BLOCKED |
| NG-FNC-069 | IA | Privacidad del índice/filtrado | supabase/functions/android-companion/index.ts; tests/privacy-firewall.test.mjs | IA | Datos QA adversariales | Contratos estáticos; no prueba RLS viva | BLOCKED |
| NG-FNC-070 | Notificaciones | Contrato chat/notification Node | tests/android-chat-notifications.test.mjs | Mensajería | Fixtures | Node PASS | PASS |
| NG-FNC-071 | Notificaciones | Inicialización FCM/servicio | android/app/src/main/java/com/nuestragalaxia/companion/GalaxyFirebaseService.java | Inicio Android | Config de Firebase | Manifest declara servicio; sin token validado | BLOCKED |
| NG-FNC-072 | Notificaciones | Registro/desregistro de tokens | android/app/src/main/java/com/nuestragalaxia/companion/PushManager.java; supabase/functions/android-companion/index.ts | Sesión | Cuenta QA + FCM | No prueba de token FCM | BLOCKED |
| NG-FNC-073 | Notificaciones | Permiso POST_NOTIFICATIONS | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java | Android 13+ | Cuenta emparejada | No flujo de permiso observado | NOT TESTED |
| NG-FNC-074 | Notificaciones | Foreground/background delivery | android/app/src/main/java/com/nuestragalaxia/companion/GalaxyFirebaseService.java | Notificación push | FCM QA 2 dispositivos | No probado | BLOCKED |
| NG-FNC-075 | Notificaciones | Deep link y eliminación duplicados | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java; android/app/src/main/java/com/nuestragalaxia/companion/GalaxyNotifications.java | Abrir push | Mensaje QA | No probado E2E | BLOCKED |
| NG-FNC-076 | Notificaciones | Cambio de cuenta/invalidación token | android/app/src/main/java/com/nuestragalaxia/companion/PushSyncWorker.java | Cambiar sesión | Usuarios QA | No probado | BLOCKED |
| NG-FNC-077 | UX | Arranque APK limpio offline | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java; android/app/src/main/assets/mobile/app.js | Abrir versión 4.1.1 | AVD API35 aislado | ADB launch, captura portrait | PASS |
| NG-FNC-078 | UX | Orientación horizontal y scroll del onboarding | android/app/src/main/assets/mobile/app.js; app.css | Girar en vinculación | AVD API35 aislado | Captura initial + swipe muestra botón | PASS |
| NG-FNC-079 | UX | Pausa/reanudar y regreso desde Home | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java | Android Home > app | AVD API35 | ADB start tras Home, interfaz visible | PASS |
| NG-FNC-080 | UX | Cierre y reapertura offline | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java | Force-stop > launch | AVD API35 | Captura tras 5 s, sin FATAL en extracto | PASS |
| NG-FNC-081 | UX | Tema visual: contratos | tests/android-theme.test.mjs | Tema | Fixtures | Node PASS | PASS |
| NG-FNC-082 | UX | Bienvenida animada vinculada | android/app/src/main/assets/mobile/app.js | Inicio | Perfil emparejado | No probado | BLOCKED |
| NG-FNC-083 | UX | Navegación principal 6 secciones | android/app/src/main/assets/mobile/app.js | Bottom nav | Pareja vinculada | Declaración estática; no uso real | BLOCKED |
| NG-FNC-084 | UX | Modales, hojas y teclado | android/app/src/main/assets/mobile/app.js; app.css | Varias secciones | Perfil vinculado | No probado visual | BLOCKED |
| NG-FNC-085 | UX | Modo claro/oscuro/temas estacionales | android/app/src/main/assets/mobile/app.js; theme.js | Ajustes | Perfil vinculado | Contratos Node PASS; UI no | BLOCKED |
| NG-FNC-086 | UX | Pantallas pequeñas, accesibilidad | android/app/src/main/assets/mobile/app.js; app.css | Varios tamaños | Emuladores QA | Solo onboarding API35 inspeccionado | NOT TESTED |
| NG-FNC-087 | UX | Estados vacíos y cargas | android/app/src/main/assets/mobile/app.js | Pantallas internas | Perfil QA | No probado | BLOCKED |
| NG-FNC-088 | UX | Actualización desde Android stable | android/app/src/main/java/com/nuestragalaxia/companion/UpdateManager.java | Ajustes > actualizar | APK/firmas correctas | CI upgrade PASS; no repetir manual | PASS |
| NG-FNC-089 | Seguridad | Privacidad UI local sin vinculación | android/app/src/main/java/com/nuestragalaxia/companion/DeviceStore.java; android/app/src/main/assets/mobile/app.js | Abrir sin código | AVD limpio | No se muestra contenido privado en onboarding | PASS |
| NG-FNC-090 | Seguridad | RLS y aislamiento backend real | supabase/functions/android-companion/index.ts; tests/supabase-rls.sql | APIs | Supabase QA | Contratos unitarios PASS; test QA vivo pendiente | BLOCKED |
| NG-FNC-091 | Seguridad | Archivos privados y URLs firmadas | android/app/src/main/java/com/nuestragalaxia/companion/CloudMediaStore.java; supabase/functions/android-companion/index.ts | Chat / álbum | QA media con dos usuarios | No E2E adversarial | BLOCKED |
| NG-FNC-092 | Seguridad | Consumo memoria, ANR y batería | android/app/src/main/java/com/nuestragalaxia/companion/MainActivity.java | Sesiones largas | Soak QA | Sin perfil instrumentado en este turno | NOT TESTED |

## Reglas para interpretar los estados
Cada PASS de lógica automatizada significa que la suite Node ejecutó el contrato, pero los datos de red, FCM, GPS y sesión doble no se comprobaron aquí. Los siete jobs de CI del candidato aprobaron previamente, incluida la instrumentación y el upgrade; se enlazan en el informe principal. Un estado BLOCKED no prueba que la función esté ausente ni que falle.
