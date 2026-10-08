# NG-4.1.1 — Decisiones de recuperación

**Nuestra Galaxia 4.1.1 — Fase 2/5** · 2026-10-08 · investigación sin cambios de código de producto.

Base: `desarrollo` @ `f5262991f3ab3fc65a6b39da2231915a453a9112`. Auditoría F1: [PR #113](https://github.com/Berserky/Galaxia-de-girasoles/pull/113) @ `60b46e3ad97a628ccbea066f0f3db2fe522d75ea` (draft, NO fusionado). La auditoría autoriza **solo comparación histórica no destructiva**; el gate de implementación/merge funcional/release permanece **NO GO**. 92 verificaciones F1: 31 PASS, 11 PARTIAL, 43 BLOCKED, 7 NOT TESTED; no extrapolar PASS parcial a módulos completos.

> Alcance honesto: inventario de **28 candidatos de recuperación evaluados por referencia y presencia de componentes**, no declaración de que las 80 etiquetas hayan sido auditadas una a una o de que las funciones respondan en E2E. Estado **PRELIMINAR / FASE 2 NO CERRADA**. Ninguna feature se recuperó ni se modificaron prod, qa, main, APK o datos personales.

## Gate principal
**CERO recuperaciones autorizadas ahora.** Aunque existen 28 candidatos, el diagnóstico F1 declara explícitamente **NO GO para implementaciones/merges funcionales** hasta QA crítica con dos identidades, RLS adversarial, token/revocación, cámara, FCM y proveedores. No declarar equivalencia real basándose solo en árbol/código. Este documento de decisiones no incorpora cambios funcionales ni validaciones que no hayan ocurrido.

## Distribución preliminar
- **MODERNIZAR ANTES DE RECUPERAR: 6** candidatos.
- **YA EXISTE: 15** candidatos.
- **POSPONER: 5** candidatos.
- **DESCARTAR: 2** candidatos.
- **RECUPERAR AHORA: 0**, por gate de seguridad y pruebas críticas pendiente.

## Matriz de decisión NG-LEG
| ID | Decisión | Valor / justificación | Riesgo principal | Prueba imprescindible |
|---|---|---|---|---|
| NG-LEG-001 | MODERNIZAR ANTES DE RECUPERAR | Adaptar como experiencia opcional, no sustituir vinculación | Media | UI intro vertical/horizontal, back y reduce-motion |
| NG-LEG-002 | MODERNIZAR ANTES DE RECUPERAR | Mantener escenas livianas; no pegar guiones privados en informes | Baja-media | Seis gestos, progresión, reentrada y accesibilidad |
| NG-LEG-003 | MODERNIZAR ANTES DE RECUPERAR | Cargar contenido con consentimiento; preservar origen sin duplicar datos | Privacidad | Lectura sólo tras vincular, no filtrar datos por logs |
| NG-LEG-004 | MODERNIZAR ANTES DE RECUPERAR | Reutilizar patrones, no canvas pesado en pantalla principal | Rendimiento | Rotate, bajo FPS, accesibilidad reduce-motion |
| NG-LEG-005 | YA EXISTE | Equivalencia de módulos en código, no E2E certificado | Media | Galería con dos identidades sintéticas, permisos |
| NG-LEG-006 | YA EXISTE | Respetar interacción requerida por autoplay y foco audio | Media | Play/pause, interrupción, reentrada sin red |
| NG-LEG-007 | YA EXISTE | Endpoints modernos; faltan gestos E2E autenticados | Media | Dos perfiles QA, duplicados, revocación |
| NG-LEG-008 | YA EXISTE | El widget actual extiende al original | Media | Instalación en launcher, imagen segura, widget múltiple |
| NG-LEG-009 | YA EXISTE | Comprobar refresco y privacidad de pantalla de inicio | Media | Distancia/ETA vacíos, fotos, diferentes tamaños |
| NG-LEG-010 | YA EXISTE | Equivalencia arquitectónica, no prueba de experiencia Android | Alta | Versiones concurrentes, respuestas ocultas, límites |
| NG-LEG-011 | MODERNIZAR ANTES DE RECUPERAR | No asumir que voz del chat cubre dedicatorias del módulo Bond | Alta | MIME, archivo privado, revocación, cancelación |
| NG-LEG-012 | YA EXISTE | WorkManager no garantiza entrega instantánea | Media | Background, ahorro batería, revocación |
| NG-LEG-013 | YA EXISTE | Reimplementación moderna, no reutilizar objeto Audio web original | Media | UI floating, cola, pause/reanudación |
| NG-LEG-014 | YA EXISTE | Bucket y UI presentes; aislamiento real no verificado | Alta | RLS A/B, links firmados, offline/error |
| NG-LEG-015 | POSPONER | No garantizar reproducción fuera de condiciones de proveedores | Media | SDK/proveedores reales y fallback legítimo |
| NG-LEG-016 | POSPONER | Requiere diseño Android de ciclo de vida/servicios | Media | Background, controles SO, Bluetooth, política permisos |
| NG-LEG-017 | YA EXISTE | Motor presente; diferencia funcional no validada con dos GPS | Alta | Dos posiciones sintéticas, mode/precision, caducidad |
| NG-LEG-018 | MODERNIZAR ANTES DE RECUPERAR | No copiar geovallas web ni ampliar ubicación sin autorización | Alta | Geocercas falsas, exclusión, consentimiento |
| NG-LEG-019 | YA EXISTE | Revisar alcance de datos y purga autorizada | Alta | Fixtures propios, paginación y borrado irreversible |
| NG-LEG-020 | YA EXISTE | Módulos presentes, exactitud/calidad pendiente | Alta | Simulación de proximidad, caducidad, opt-out |
| NG-LEG-021 | POSPONER | Bloqueo preventivo hasta pruebas adversariales RLS y revocación | Crítica | Dos parejas separadas, A/B, opt-out, background |
| NG-LEG-022 | YA EXISTE | Comprobar contraste y cobertura de pantallas | Baja | Claro/oscuro/estacionales/reduce-motion |
| NG-LEG-023 | YA EXISTE | La navegación actual es diferente, no reemplazarla | Media | Entrada real de funciones, back stack, teclado |
| NG-LEG-024 | POSPONER | Decisión de producto antes de recrear UI y estado compartido | Alta | Diseño funcional, permisos, sync, FPS |
| NG-LEG-025 | POSPONER | No reactivar bucles/juego por mera existencia histórica | Alta | Aprobación alcance y benchmark Android |
| NG-LEG-026 | DESCARTAR | Restauración masiva de catálogo duplicaría deuda sin demanda validada | Media | No se ejecuta restauración |
| NG-LEG-027 | YA EXISTE | No confundir chat voice con dedicatorias Bond | Media | Grabación y entrega Android real donde sea posible |
| NG-LEG-028 | DESCARTAR | No injertar SW/PWA obsoleto en WebView Android | Alta | Proteger inicio/offline WebView existente |

## Condiciones para cambiar una decisión a RECUPERAR AHORA
1. Evidencia de no equivalencia funcional frente a Android 4.1.1, no sólo UX diferente.
2. F1 aprobada/integrada para trazabilidad o referencia inmutable de la auditoría, con P0/P1 críticos resueltos o explícitamente no aplicables al módulo.
3. Datos sintéticos A/B y **otra pareja** para negativas RLS, revocación y consentimiento cuando el módulo comparte datos.
4. Diseño mínimo y reversible, requisitos de accesibilidad, permisos y medición de batería/render donde aplique.
5. PR por módulo desde el último `desarrollo`, CI aplicable verde, smoke en emulador y prueba física sólo cuando emulador no cubra hardware.
6. Aprobación de producto para hogar/RPG/tienda y para integraciones de proveedores antes de comprometer el alcance.

No se restaurarán ramas enteras, no se emplearán secretos viejos y no se alterarán etiquetas/respaldos. Nada se promociona a `qa` ni `prod` durante F2.
