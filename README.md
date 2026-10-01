# Una galaxia de girasoles 🌻

Regalo de Sebas para Adriana. Una web estática con seis recuerdos, una constelación que se completa, música opcional y una carta con un secreto final.

## Abrir

Abre `index.html` en un navegador moderno o sirve esta carpeta con cualquier servidor estático. No hay dependencias, instalación ni compilación. Funciona bajo una subcarpeta, incluido GitHub Pages.

## Personalizar

- `recuerdos.js`: los seis títulos y mensajes originales.
- `index.html`: portada, carta, firma y secreto originales.
- `style.css`: colores, tipografía y distribución adaptable.
- `girasol.js`: ilustración del girasol original en canvas.
- `script.js`: navegación, progreso, constelación, animación final y música.
- `musica.mp3`: audio original. Se puede desactivar antes de entrar o pausar durante el recorrido.

Los textos sobre cuatro meses se mantienen tal como estaban en el regalo original; no son un contador de tiempo. El progreso vive durante la visita y se reinicia al recargar. Al terminar, se pueden volver a abrir los recuerdos y la carta.

## Accesibilidad y comprobación

Los girasoles son botones accesibles con teclado (Tab y Enter). Los mensajes usan diálogos nativos; Escape cierra un recuerdo o el secreto. Se permite ampliar la página y se respeta la preferencia de movimiento reducido. El audio solo comienza tras una interacción y los fallos de reproducción no bloquean el regalo.

Recorrido comprobado en Edge/Chromium, en escritorio y tamaños móviles, incluyendo seis recuerdos, cambio de tamaño con la última flor, carta, secreto y regreso a la constelación. Para futuras modificaciones, repetir este recorrido con y sin movimiento reducido y con música activada y desactivada.
