# V5-P0 — Contrato Celestial Design System y decisión de arquitectura

**Issue:** #160 · **Rama:** `feat/visual-evolution-5-p0-baseline` · **Estado:** contrato y maqueta propuestos; aceptación visual del propietario pendiente. Ningún cambio a los assets del APK en P0.

## Decisiones ADR-P0-001 a ADR-P0-008
1. **Android primero:** la versión 4.1.2/code39 usa `android/app/src/main/assets/mobile/`. No sustituir la WebView local, el puente Java, el router ni las APIs; `app/public` es un cliente distinto.
2. **Design tokens propuestos y verificables:** `CELESTIAL_TOKENS.json` contiene tipografía, escala, elevación, espaciamiento, motion, geometría, accesibilidad y siete paletas; `auto` resuelve al tema actual mediante `GalaxyTheme.resolve`. **No conectar los tokens al APK antes de P1 y aceptación.**
3. **Contraste primero:** texto normal / textos secundarios / acciones propuestas >= WCAG AA 4.5:1 sobre sus superficies; controles y foco >=3:1 donde aplique. Test `tests/visual-evolution-p0.test.mjs` calcula ratios, no los supone.
4. **Navegación de seis entradas preservada:** Inicio, Mapa, Momentos, Recuerdos, IA y Más; objetivos y Chat conservan sus accesos. La IA se mantiene SIN rediseñar.
5. **Motion sobrio y reversible:** 150/220/280 ms, easing sin rebote forzado; movimiento solo por `transform`/`opacity` cuando sea viable; `prefers-reduced-motion` elimina ornamento sin quitar acceso o información.
6. **Seguridad y verdad de estados:** no simular GPS, ETA, fotos, actividad del compañero o avisos FCM. Una maqueta de demostración jamás representa un PASS funcional.
7. **Zonas de acción seguras:** 44px CSS mínimo, objetivo 48dp Android; footer/nav con insets; chat FAB y acciones de mapa/memoria sin superposición; el ajuste de `visualViewport` de Chat no se reescribe.
8. **Componentes compartidos solo en P1:** extraer patrones de shell, tarjetas, estados y overlays sin importar código de motor Chat o IA. Evitar nuevas dependencias hasta decisión independiente.

## Matriz de componentes y ownership

| Componente | Fuente existente | Propuesta P1 | QA imprescindible |
|---|---|---|---|
| Shell/header | `header/renderNav/render/go` | header adaptable + safe-area | 320/360/393/412, landscape, textos largos, perfil sin vincular |
| Bottom nav | `#bottomNav`, `.bottom-nav` | 6 rutas, indicador claro | teclado, gestos nativos, foco, 48dp |
| Chat FAB | `renderChatFab`, `#chatFab` | reserva espacial y elevación | notificaciones, nav, player, overlays, **sin tocar motor chat** |
| Modal/sheet | `showModal/showBottomSheet`, `#modal` | backdrop, foco, escape, scroll lock | foco al abrir/cerrar, lector de pantalla, teclado |
| Card/bento | `.card/.grid/.action-card` | superficies, estados y densidad | zero/one/many, loading/error/offline, no textos cortados |
| Tokens y temas | `theme.js/app.css` | roles y contraste AA | auto + 7 paletas, barras Android, sistema claro/oscuro |
| Toast/badge | `#toast`, badges | feedback legible y no obstructivo | contraste, anuncios accesibles, no tapar CTA |
| Search / notifs | `openUniversalSearch/openNotificationCenter` | marco común **sin tocar ranking ni IA** | keyboard/modal, deep-links, unread |
| Mapa / Momentos / Recuerdos / Más | vistas y acciones existentes | consumir nuevos componentes gradualmente | GPS/consentimiento, progreso, 9 tipos, acciones peligrosas |
| UI Chat / IA | `chatView/intelligenceHubView` | **fuera de diseño P0/P1** (solo shell) | no cambios de contrato |

## Boceto revisable, aislado

Abrir `prototypes/celestial-shell.html` en un navegador. `?theme=cosmic` (o las otras seis paletas) permite comparar apariencia; controles de búsqueda/nav abren un diálogo de **maqueta**, NO ejecutan funciones reales. Capturas CI: artefacto `v5-p0-synthetic-design-screenshots`. No se suben capturas de usuarios ni se despliega Pages.

**Aprobación visual requerida** antes de integrar P1: composición principal, tipografía, balance de tarjetas, barra de 6 tabs, FAB, estética de todos los temas y forma de sheets. El contrato propuesto no es una aprobación implícita.

## Lo que deliberadamente NO cambió

`app.js`, `app.css`, `theme.js`, `MainActivity.java`, `GalaxyBridge.java`, `supabase/`, base de datos, secrets, `qa`, `prod` y `versionCode`. Todas las VE-001…260 siguen pendientes, pues son ítems de implementación futura.
