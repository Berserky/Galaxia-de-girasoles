# NG-4.1.1 — Comparación legado / Android 4.1.1

**Nuestra Galaxia 4.1.1 — Fase 2/5** · 2026-10-08 · investigación sin cambios de código de producto.

Base: `desarrollo` @ `f5262991f3ab3fc65a6b39da2231915a453a9112`. Auditoría F1: [PR #113](https://github.com/Berserky/Galaxia-de-girasoles/pull/113) @ `60b46e3ad97a628ccbea066f0f3db2fe522d75ea` (draft, NO fusionado). La auditoría autoriza **solo comparación histórica no destructiva**; el gate de implementación/merge funcional/release permanece **NO GO**. 92 verificaciones F1: 31 PASS, 11 PARTIAL, 43 BLOCKED, 7 NOT TESTED; no extrapolar PASS parcial a módulos completos.

> Alcance honesto: inventario de **28 candidatos de recuperación evaluados por referencia y presencia de componentes**, no declaración de que las 80 etiquetas hayan sido auditadas una a una o de que las funciones respondan en E2E. Estado **PRELIMINAR / FASE 2 NO CERRADA**. Ninguna feature se recuperó ni se modificaron prod, qa, main, APK o datos personales.

## Diferencias estructurales
| Capacidad | Histórica | Android actual | Diferencia material / cautela |
|---|---|---|---|
| Regalo | `index.html`, `script.js`, seis girasoles con texto local | `assets/mobile/app.js` onboarding/welcome + recuerdos | Narrativa original preservada en root, NO certificada como experiencia íntegra dentro del onboarding nativo |
| Música | `new Audio()` web + mini-player + MP3 | `welcomeMusic`, `musicQueue`, `globalPlayer`, audio y proveedores | Existe implementación más moderna; background/proveedores sin E2E; no reutilizar autoplay web sin controles |
| Momentos | `bond-ui.js`, `bond-store.mjs`, BondWidget, dedicatorias | BondWidget/Worker/Edge + chat voice | Widgets/gestos presentes; dedicatoria de voz NO necesariamente cubierta por notas de voz de chat |
| Mapas | GPS web, geovallas, ETA, historia y controles | TrackingService + distance/eta/gps-history/encounters + backend | Motores presentes; falta validar RLS, consentimiento vivo, precisión y ETA reales |
| Diseño | PWA light/theme/navigation | Android WebViewAssetLoader + ocho temas + nav con IA | No sustituir navegación actual por copia web histórica |
| Hogar/RPG | App web, assets RPG, shop/catalog | Migraciones home/RPG preservadas | Datos/esquema no equivalen a experiencia jugable actual; requiere decisión de producto |

## Evidencia individual y decisión (NO equivalencia E2E)
| ID | Capacidad | Referencia | Estado propuesto | Diferencia, riesgo o pendiente |
|---|---|---|---|---|
| NG-LEG-001 | Inicio narrativo del regalo | legacy/regalo-galaxia-original @ d517e0a | MODERNIZAR ANTES DE RECUPERAR | Adaptar como experiencia opcional, no sustituir vinculación |
| NG-LEG-002 | Seis girasoles y recuerdos interactivos | legacy/regalo-galaxia-original @ d517e0a | MODERNIZAR ANTES DE RECUPERAR | Mantener escenas livianas; no pegar guiones privados en informes |
| NG-LEG-003 | Narración y carta histórica personalizada | legacy/regalo-galaxia-original @ d517e0a | MODERNIZAR ANTES DE RECUPERAR | Cargar contenido con consentimiento; preservar origen sin duplicar datos |
| NG-LEG-004 | Animación, redimensionado y reduce-motion del regalo | legacy/regalo-galaxia-original @ d517e0a | MODERNIZAR ANTES DE RECUPERAR | Reutilizar patrones, no canvas pesado en pantalla principal |
| NG-LEG-005 | Álbum e historia de recuerdos | legacy/regalo-galaxia-original @ d517e0a | YA EXISTE | Equivalencia de módulos en código, no E2E certificado |
| NG-LEG-006 | Audio de fondo en bienvenida | legacy/regalo-galaxia-original @ d517e0a | YA EXISTE | Respetar interacción requerida por autoplay y foco audio |
| NG-LEG-007 | Gestos abrazo/beso/te extraño | legacy/revisar-momentos-widgets @ 6f7922c | YA EXISTE | Endpoints modernos; faltan gestos E2E autenticados |
| NG-LEG-008 | Widget nativo foto/fecha/abrazo | legacy/revisar-momentos-widgets @ 6f7922c | YA EXISTE | El widget actual extiende al original |
| NG-LEG-009 | Widget dinámico configurable | legacy/revisar-universo-2-1 @ 322bf6b | YA EXISTE | Comprobar refresco y privacidad de pantalla de inicio |
| NG-LEG-010 | Rituales, quiz y notas compartidas | legacy/revisar-momentos-widgets @ 6f7922c | YA EXISTE | Equivalencia arquitectónica, no prueba de experiencia Android |
| NG-LEG-011 | Dedicatorias de voz dentro de momentos | legacy/revisar-momentos-widgets @ 6f7922c | MODERNIZAR ANTES DE RECUPERAR | No asumir que voz del chat cubre dedicatorias del módulo Bond |
| NG-LEG-012 | Sincronización periódica de gestos | legacy/revisar-momentos-widgets @ 6f7922c | YA EXISTE | WorkManager no garantiza entrega instantánea |
| NG-LEG-013 | Reproductor flotante persistente | legacy/revisar-reproductor-musica @ 086b63c | YA EXISTE | Reimplementación moderna, no reutilizar objeto Audio web original |
| NG-LEG-014 | Biblioteca privada de MP3 | legacy/revisar-reproductor-musica @ 086b63c | YA EXISTE | Bucket y UI presentes; aislamiento real no verificado |
| NG-LEG-015 | Reproducción desde URL externas | legacy/revisar-reproductor-musica @ 086b63c | POSPONER | No garantizar reproducción fuera de condiciones de proveedores |
| NG-LEG-016 | Audio musical en segundo plano Android | legacy/revisar-reproductor-musica @ 086b63c | POSPONER | Requiere diseño Android de ciclo de vida/servicios |
| NG-LEG-017 | Distancia y ETA por desplazamiento | legacy/revisar-mapas-privacidad @ b5e386e | YA EXISTE | Motor presente; diferencia funcional no validada con dos GPS |
| NG-LEG-018 | Casa/trabajo y eventos de llegada | legacy/revisar-mapas-privacidad @ b5e386e | MODERNIZAR ANTES DE RECUPERAR | No copiar geovallas web ni ampliar ubicación sin autorización |
| NG-LEG-019 | Historial GPS, viajes, exportación/borrado | legacy/revisar-mapas-privacidad @ b5e386e | YA EXISTE | Revisar alcance de datos y purga autorizada |
| NG-LEG-020 | Encuentros y cercanía entre ambos | legacy/revisar-mapas-privacidad @ b5e386e | YA EXISTE | Módulos presentes, exactitud/calidad pendiente |
| NG-LEG-021 | Compartir ubicación y privacidad por pareja | legacy/revisar-mapas-privacidad @ b5e386e | POSPONER | Bloqueo preventivo hasta pruebas adversariales RLS y revocación |
| NG-LEG-022 | Temas contemporáneos/estacionales | legacy/revisar-diseno-contemporaneo @ c67b9cd | YA EXISTE | Comprobar contraste y cobertura de pantallas |
| NG-LEG-023 | Navegación móvil y menús de exploración | legacy/revisar-diseno-contemporaneo @ c67b9cd | YA EXISTE | La navegación actual es diferente, no reemplazarla |
| NG-LEG-024 | Hogar compartido decorable | archive/2026-10-08/aegiron/nuestro-hogar-v1 @ 6f1d886 | POSPONER | Decisión de producto antes de recrear UI y estado compartido |
| NG-LEG-025 | Interiores RPG y coleccionables | archive/2026-10-08/aegiron/rpg-indoors-v1 @ 3d5ef50 | POSPONER | No reactivar bucles/juego por mera existencia histórica |
| NG-LEG-026 | Catálogo/taller/tienda histórica masiva | archive/2026-10-08/aegiron/curated-shop-v30 @ 3dc3d7e | DESCARTAR | Restauración masiva de catálogo duplicaría deuda sin demanda validada |
| NG-LEG-027 | Mensajes de voz modernos | legacy/revisar-universo-2-1 @ 322bf6b | YA EXISTE | No confundir chat voice con dedicatorias Bond |
| NG-LEG-028 | Cache/service worker de la PWA antigua | legacy/regalo-galaxia-original @ d517e0a | DESCARTAR | No injertar SW/PWA obsoleto en WebView Android |

## Componentes modernos que NO se deben borrar
`android/app/src/main/assets/mobile/`, `GalaxyBridge.java`, `MainActivity.java`, `TrackingService.java`, `DeviceStore.java`, `BondWidget.java`, `app/public`, `supabase/functions/android-companion` y migraciones relacionadas. La existencia de un nombre en ambos mundos prueba continuidad técnica parcial, **no** satisfacción de todos los requisitos de accesibilidad, privacidad o comportamiento.

## Dependencia de la auditoría F1
Correlación por dominio: identidad NG-FNC-001/006, chat NG-FNC-010/011/014/019, medios a partir de NG-FNC-024 y áreas de música/mapas/widgets del mismo archivo `NG-4.1.1-FUNCTIONAL-MATRIX.md` en PR #113. **No se asignan identificadores NG-FNC exactos donde no se ha comprobado correspondencia fila por fila**. Se requiere correlación final con la matriz al integrar la Fase 1.


## Adenda de comparación sobre las 80 etiquetas completas

La revisión de rutas históricas se amplió a **80/80** en [NG-4.1.1-ARCHIVE-80-LEDGER.md](NG-4.1.1-ARCHIVE-80-LEDGER.md), que identifica commits y archivos modificados/ausentes por referencia. Los 35 casos de ruta antigua ausente se concentran principalmente en `app/public/assets/home/` y alias de migraciones SQL, **no demuestran pérdida de funcionalidad Android**. El sitio PWA antiguo y `assets/mobile` nativo son arquitecturas distintas; no restaurar assets, service workers ni SQL sólo por no compartir ruta.

Persisten diferencias que **requieren QA funcional**: dedicatorias de voz vs mensajes chat, narración de regalo vs bienvenida nativa, música en segundo plano y consentimiento GPS real. Los 15 registros `YA EXISTE` reflejan implementación observable en código, no paridad certificada para ambos usuarios.
