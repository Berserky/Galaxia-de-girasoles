# Fase 4 — Revisión de experiencia UX
**Estado: inicial, sin certificación visual integral.**

## Evidencia disponible
- NG-AUD-003: en APK 4.1.1 Android API35 el CTA de vinculación queda inicialmente bajo el pliegue al girar a horizontal, pero el scroll lo hace accesible. Capturas en [PR #113](https://github.com/Berserky/Galaxia-de-girasoles/pull/113) bajo `docs/audits/evidence/`. P3, no bloqueo funcional.
- CI Android previo ejercitó seis secciones de navegación, WebView, scroll con 20k mensajes, teclado, goals y tarjetas interactivas; **no equivale** a la inspección completa de interfaces emparejadas.
- NG-FNC-029 (controles cámara/video) figura BLOCKED en F1; no describirlo como corregido por contratos o tests de galería.

## Checklist de revisión futura
1. Onboarding portrait, landscape, pantallas cortas y accesibilidad con teclados; CTA visible o pista inequívoca de scroll, tamaños táctiles suficientes.
2. Cámara y video: controles nunca superpuestos; captura/retake/cancel y permisos en emulador compatible y hardware real al ser imprescindible.
3. Navegación, modales, composer, acciones flotantes, audio, adjuntos, mapas, objetivos e IA con identidades QA y estados vacíos/error.
4. Contraste, escalado de texto, modo oscuro/estacional, lectores de pantalla y preferencias de movimiento reducido.
5. Captura comparativa antes/después y prueba de regresión por pantalla alterada.

**Aplicación visual realizada en este PR:** ninguna. No modificar CSS sin validación de viewport, pruebas y criterios de aceptación.
