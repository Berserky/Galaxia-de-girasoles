# Nuestra Galaxia V5 — P8: QA consolidada única del conjunto P1–P7

**Decisión del propietario: 28 de octubre de 2026.** La intención es dejar de bloquear el desarrollo por repetición de emuladores y revisar el **producto conjunto** al final, antes de liberar V5. Este documento describe un **cambio de cadencia de trabajo**, no la desactivación de salvaguardas de GitHub ni la certificación ficticia de código.

## Fases y estados

| Etapa | Qué se hace | Resultado |
| --- | --- | --- |
| **P5 — Momentos** | Mantener el código V3.3 integrado en rama; registrar hallazgos nativos históricos | `IMPLEMENTADO_PENDIENTE_QA_INTEGRAL_P8`; PR #171 DRAFT, sin release |
| **P6 — Recuerdos** | Avanzar módulos VE-143–202 en incrementos revisables con datos reales y sin tocar fuentes ni permisos sin necesidad | `EN_DESARROLLO` hasta integrar y revisar cada incremento; pendiente QA final |
| **P7 — Más** | Desarrollar centro de configuración VE-203–260 con confirmaciones y controles intactos | `EN_DESARROLLO` y QA final pendiente |
| **P8 — Integración** | Consolidar P1–P7 sobre **un solo SHA candidato**, corregir fallos e inspeccionar evidencia única de la APK completa | `PASS` únicamente con gates completos |
| **P9 — Release** | Promoción por desarrollo → qa → prod, candidate, firma, revisión y autorización explícita | Publicación sólo tras P8 y gates de release vigentes |

## Durante P5/P6/P7: desarrollo sin bloqueos repetitivos

- Prioridad: **implementar y corregir funcionalidades**, no lanzar 15 emuladores manuales para cada microcambio ni generar documentación o diagnósticos redundantes.
- Por incremento: comprobar sintaxis/tipado, pruebas Node/contrato de los componentes modificados, ausencia de importaciones inseguras, privacidad y coherencia de assets; compilar cuando el cambio afecte empaquetado. Mantener regresiones unitarias necesarias **sin exigir aceptación visual integral en cada paso**.
- Bugs que puedan perder datos, revelar contenido privado, degradar autenticación/permisos, corromper persistencia o romper el arranque **sí se corrigen antes de continuar**. No se aplaza un problema de seguridad para la entrega final.
- Fallas costosas de AVD/compositor/estrés se registran una vez con SHA, logs y alcance; **no se reintentan en bucle** mientras la siguiente fase puede implementarse de forma aislada.
- Los CI automáticos continuarán donde sus disparadores actuales los requieran. No se debilitan asserts, protecciones de ramas, required checks, firma, RLS, ni se etiqueta un workflow fallido como aprobado. Si una protección de GitHub impide merge, **se continúa trabajando en rama sin fusionar**, con integración posterior sujeta a la política oficial.
- No tocar ni publicar `qa`, `prod` ni `android-stable`; sin gastos. Priorizar código gratuito/local.

## P8: una única campaña integral sobre un candidato concreto

1. **Congelar contenido** de todas las P en un SHA candidato y resolver conflictos con el baseline estable; identificar VE-001…VE-260 completados, diferidos y riesgos conocidos, con retorno seguro.
2. **Automatización**: suite Node total, seguridad/privacy, contratos, lint, compilación Android, regresiones que requiera `android-release-candidate`, integridad de assets, supabase/RLS si cambios los afectan; resultados asociados **al mismo SHA**. No heredar el 12/15 de P5 como éxito de P8.
3. **Dispositivo Android real/emulado**: uso completo y consecutivo Inicio, Mapa, Momentos, Recuerdos y Más; teclado, rotación, fondo/foreground, enlazar/desvincular, offline y contenido privado, sin tocar producción. Evidencia en framebuffer real; los prototipos Chromium solo son preflight.
4. **Cobertura visual transversal única**: 320, 360, 393 y 412 CSS px; `WebSettings.textZoom=135`, siete temas (daylight, cosmic, halloween, christmas, valentine, friendship, easter), modo reducido de movimiento, safe areas, focus y blancos táctiles. Las seis etiquetas de navegación deben verse completas, sin colisiones FAB.
5. **Escenarios específicos**: Bond 0/3/8 con datos reales del servidor o fixtures claramente sintéticos, sin capítulos posteriores falsos; cinco áreas inferiores de Momentos con scroll; P6 álbum/Drive/música/fechas/notas/cápsulas bloqueadas/constelación sin fugas; P7 controles de cuentas, dispositivos, respaldos y permisos conservando confirmaciones; regresiones de Chat, GPS y FCM **solo donde una modificación los afecte**, sin repetir pruebas físicas cerradas sin causa.
6. **Bloqueos antiguos**: #173 marcador físico, #174 mapa ERR/JSON, #175 WebView callback, #176 labels 135 %, #177 caché multimedia; distinguir defectos funcionales de infraestructura. En P8 solucionar y ejecutar una confirmación final documentada; no disminuir rigor del gate para obtener verde.
7. **Revisión humana una sola vez**: entregar capturas representativas de la APK *integrada*, pedir aprobación visual/funcional del producto completo. Solo después considerar PRs listos, merge, QA RC y P9. El candidato no se publicará automáticamente.

## Criterios de salida de P8

**Requiere conjuntamente** CI obligado verde en SHA final, pruebas funcionales nativas relevantes, privacidad, RLS/contratos si aplican, screenshots reales y aprobación visual expresa. No convertir `NOT_EXECUTED`, `BLOCKED` o `INFRA_FAILURE` en `PASS`. Si el entorno de emulador falla, mantener prueba pendiente y reintentar controladamente en entorno fiable; no liberar a ciegas.

## Continuidad inmediata

**Dejar de reintentar P5 en cada mensaje** y avanzar con P6 (VE-143–202, inicio P6A: arquitectura de colecciones) en su rama; P7 después; P8 concentra la certificación. PR #171 permanece DRAFT hasta que se pueda satisfacer política de integración. Un P5 sin QA final no se describe como «100% cerrado», sino como **implementación terminada en espera de aceptación P8**.
