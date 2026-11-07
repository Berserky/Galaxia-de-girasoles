# Jardín Vivo V3.1 — arquitectura, aceptación y expansión de mundo

> Estado 20/oct/2026. Especificación de diseño y QA; **no equivale a un cambio de aplicación ni a aprobación de release**. Epic #160, PR #171 (rama `feat/visual-evolution-5-p5-living-moments`). Base de app auditada: `c715f86b2a4ef8cf1dc340cc91dd96daec0228ec`. El trabajo de código V3.1 se entregó **como ZIP local en la conversación**, no existe aún en el árbol remoto. Las escrituras previas de `app.js`, CSS y Android que fueron bloqueadas por seguridad **no deben reintentarse o eludirse** sin que cambien expresamente las condiciones.

## Decisión visual aprobada

- **Primer plano:** girasoles orgánicos hechos con HTML/CSS (pétalos, hojas y tallos independientes), protagonistas permanentes. No sustituir con iconos Lucide como cabezas de flores ni imágenes generadas por IA.
- **Segundo plano:** tierra con relieve, senderos/colinas/ríos conforme a la escala, montañas y paisaje profundo.
- **Tercer plano:** cielo, sol/luna, estaciones y decoraciones festivas **detrás de flores y sin ocultarlas**. Evitar árboles/decoraciones que solapen tallos y cabezas.
- Navidad: luces de cielo, Papá Noel y renos en vuelo detrás de la cordillera, nieve ambiental y escarcha ligera en plantas; no árboles festivos sobrepuestos. Halloween: murciélagos/luna y bruma. San Valentín: corazones del cielo, sin corazones invasivos de suelo. Amistad: fuegos artificiales en cielo; reducir destellos con prefers-reduced-motion. Cósmico: cuerpos celestes y estrellas. Pascua: elementos pequeños en cielo. No olvidar tema `daylight` neutro.
- Énfasis de calidad: profundidad, composición legible, degradados y motion orgánico de bajo consumo; sin CDN, rastreadores, tokens, GPS, red, costos o permisos nuevos.

## Estado actual — no confundir el render con el progreso real

**Autoridad del servidor**: `supabase/functions/android-companion/bond-engine.ts::gardenState(totalDays)`. Calcula días compartidos (días con contribución de ambos), racha y 9 estados nominales (`stage=0..8`), umbrales `0,1,7,14,30,60,100,180,365`; `stage=8` significa 365 días. Proporciona `garden.totalDays`, `stage`, `next`, `milestones` y `progressPct`. Tras 365 días queda `stage=8`, `next=null` y `progressPct=100`. No fabrica capítulos posteriores.

**V3.1 inmediata (permitida como presentación, pendiente de integración de código):** usar `garden.stage` realmente recibido para mostrar el jardín cercano de 0 a 8, sin afectar cuentas, rachas ni hitos. El prototipo mostró escenas de pradera/valle/región/planeta con cifras de flores 9,22,23,43,75 y 123: **son únicamente vistas de demostración** y deben permanecer inaccesibles como logros auténticos en producción hasta que exista contrato real del backend. No usar `previewBloomTotal` ni banderas de demo fuera de QA aislado.

**Futuro, decisión arquitectónica aprobada pero NO implementada:** al completar el primer sector de 8 girasoles, alejar cámara, conservar físicamente el sector completo como núcleo reconocible, abrir pradera e iniciar sector siguiente. Después expandir hacia valle con sendero/río, región cartográfica, planeta y órbita. El número de nuevas flores/sector (p.ej. 14 para pradera) es hipótesis de diseño, **no un nuevo umbral de días**. Nunca traducir por cuenta propia `totalDays>365` a capítulo futuro ni reinterpretar `stage=8`.

## Contrato futuro propuesto para revisión, no oficial

El backend, mediante diseño/API/QA separados, podría devolver un objeto adicional versionado sin cambiar el significado histórico de `garden.stage`:

```json
{
  "world": {
    "version": 1,
    "chapterId": "meadow",
    "sectorIndex": 1,
    "sectorTarget": 14,
    "sectorProgress": 0,
    "totalBloomCount": 8,
    "landUnlocked": ["garden", "meadow"],
    "nextMilestone": null
  }
}
```

**Ejemplo puramente ilustrativo**, prohibido generarlo desde UI como si fuera real. Deben definirse por producto/servidor:
1. Qué evento auténtico cuenta como crecimiento adicional sin incentivar compulsivamente la actividad, y su granularidad temporal.
2. Umbrales específicos, máximos por sector y condición de expansión; tratar `0` y ausencia de dato de manera distinta.
3. Contrato de persistencia y reconstrucción determinista para cualquier dispositivo, sin perder los 8 girasoles anteriores.
4. Versionado/migración compatible con clientes Android 4.1.2, política de privacidad/RLS y consumidores actuales de `stage` y `milestones`.
5. Si es posible deshacer o recalcular progreso sin ocultar recuerdos auténticos; independencia de streak y totalDays.

Hasta tener esas decisiones, **representar solamente el mundo realmente desbloqueado** y usar demo sintética para mostrar escalas futuras.

## Integración técnica de V3.1, pendiente de escritura permitida

- Paquete local de conversación: `Nuestra-Galaxia-Jardin-V3.1-APK-Validado-20261020.zip`. Antes de usarlo verificar procedencia, SHA y contenido; no hay enlace de GitHub a ese ZIP.
- Cargar `galaxy-garden-world-v3.css` después del CSS P5 existente y `galaxy-garden-world-v3.js` **antes de** `app.js`; scripts empaquetados y locales (WebViewAssetLoader, CSP `self`).
- `bondGardenVisual(garden)` sigue siendo presentador público; delegar solo su ilustración al renderizador CSS y conservar fallback seguro. No tocar `gardenState`, Supabase, Chat, GPS, FCM, IA, permisos, ni paths de datos personales.
- Inicio/fin de animaciones: evento de entrada y cambio legítimo de etapa; las recargas de `render()` no deben reiniciar florecimiento. Retirar listeners/observers/timers al salir de Momentos y suspender movimiento cuando document esté oculto. Respetar `prefers-reduced-motion:reduce` y bandera nativa.
- En vista cercana, objetivos táctiles >=44 CSS px; en vistas alejadas las flores diminutas son ilustrativas/no botones diminutos. Texto accesible describe etapa **real** y escena, pero no afirma días inventados.
- Conservar `garden.milestones`, `next`, métricas y navegación de Momentos. Preservar privacidad de sorpresas bloqueadas.

## Evidencia que sí existe y sus límites

- GitHub Actions: 15/15 SUCCESS solo para código anterior en HEAD `c715f86b...`, **no acredita V3.1**.
- Validación local previa de V3.1: recursos web extraídos del APK de CI y comparados con blobs del mismo HEAD; 33/33 pruebas de lógica, 9/9 contratos y 12/12 escenarios Chromium (320/360/393/412 x etapas 0,3,8). Capturas reales del navegador con interfaz de app y datos QA sintéticos; **no eran capturas de Android WebView ejecutando V3.1**. No confundir con pruebas de APK firmado, 135% real del WebView o despliegue.
- Regresión conocida: en screenshots del Android anterior un tema Easter heredado contaminó la captura base de 412px; restablecer y afirmar `daylight` antes de cada captura. Barra inferior `Momentos/Recuerdos` truncada en 135%; verificar sin elipsis en cada ancho, no solo con pruebas de overflow.
- Defectos independientes de P5 aún abiertos: `go(next)` y restauración de scroll; datos métricos/umbrales vacíos y adivinanza nula; transcript malformed; flake AVD al parsear `ERR:...`. Los parches de corrección locales de la conversación no se han fusionado.

## Gate de aceptación y secuencia sin omitir pasos

1. Partir de **SHA actual de PR #171**; comprobar de nuevo que no existan modificaciones concurrentes y que esté autorizado escribir código. No sortear los bloqueos anteriores.
2. Aplicar adaptador V3.1 solamente en rama temporal de P5; ejecutar `npm test` (Node 24) y pruebas específicas de jardín/seguridad, registrar nuevo SHA.
3. Ejecutar Chromium/Android WebView con etapas 0,3,8, tema `daylight` y siete temas, estaciones y día/noche, 320/360/393/412, texto nativo al 135%, fondo/no interacción, foco, movimiento reducido, gesture input y duración real. Confirmar animación completa antes de la captura; comprobar superposiciones por rectángulos de **contenido visible** con bottomNav/FAB.
4. Capturar, además de la portada, scroll verdadero hasta sorpresas, juego, rituales, nota extensa y audio, y verificar que sorpresas bloqueadas no expongan datos privados, ni estado de audio inventado, ni controles <44 px.
5. Verificar P5 Android instrumentado, CPU/memoria/jank reales (registrar medidas antes de afirmar FPS), CI 15/15 **del SHA nuevo**. Cualquier fallo = bloquear merge, no omitir pruebas.
6. Comparativa estética en dispositivo y **aprobación visual explícita del propietario**; solo entonces merge a `desarrollo`. Nunca promover V5 a `qa`/`prod` sin autorización independiente.

## Separación de tareas

- **P5 visual inmediato:** V3.1 en el primer jardín y sus decoraciones, sin nuevas reglas de Bond.
- **Evolución del mundo (futuro):** issue/PR aparte para aprobar y desarrollar capítulos, umbrales y compatibilidad de servidor, después de resolver el cierre visual del primer jardín. Evitar mezclar una migración de backend especulativa con P5.
- **P5 funcional y de accesibilidad:** cerrar fallos y pruebas de Momentos antes de la fusión final.

**No marcar V3.1 integrado ni P5 cerrado por este documento.**
