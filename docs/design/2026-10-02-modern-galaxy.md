# Nuestra Galaxia · renovación contemporánea

El usuario delega criterio completo para renovar la interfaz existente, conservando las funciones y publicando una versión integrada.

## Diseño
- Tema predeterminado claro cálido: fondo porcelana, tinta profunda, violeta y coral. Conservar temas estacionales y universo oscuro como preferencias persistentes.
- Navegación inferior flotante móvil: Inicio, Historia, Mapa y Explorar. Explorar reúne todas las secciones, ajustes y regalo original por grupos. Barra lateral completa en escritorio.
- Acción flotante Crear con hoja de acciones: recuerdo, fotos, canción, fecha, plan, cápsula, deseo y viaje; usa acciones existentes.
- Tipografía de sistema sans contemporánea, título editorial puntual. Controles de 44 px mínimo, campos a 16 px en móvil, separaciones de 8/12/16/24/32 px, radios 14–28 px.
- Tarjetas y estados vacíos, álbum, música, calendario, mapa, universo, ajustes y acceso coherentes. Animación breve con respeto por movimiento reducido. Diálogos con desplazamiento y áreas seguras.
- Android nativo: mismos colores y jerarquía; tarjetas separadas para acceso, ubicación, vinculación y actualización. Conservar identificadores, permisos, servicio y firma. Versión 1.2.0 (código 3).

## Ejecución y comprobación
1. Probar navegación agrupada y acciones existentes antes de implementarlas en ui.js; integrar en app.js.
2. Añadir modern.css, tema claro, estados y espaciado; incluir todos los recursos en Pages y renovar caché.
3. Renovar recursos Android sin modificar la lógica de ubicación. Unificar metadata de versión APK/update.json.
4. Ejecutar suite completa, compilación Pages y QA/build Android en GitHub; comprobar visualmente móvil 390/320 px, tablet y escritorio, menús, formulario y temas. Revisar el diff antes de publicar.

Condiciones de aceptación: ninguna función desaparece, navegación accesible por teclado, contenido sin desbordamiento horizontal, capas flotantes separadas y sesión persistente. No alterar sources/ ni datos de Supabase.


## Revisión realizada
- Revisado por un agente independiente: ninguna regresión crítica/importante. La observación de botones nativos deshabilitados se resolvió con selectores de color.
- Creación móvil integrada al centro de la barra para evitar otra capa sobre el contenido. Selector de fotos compartido por todas las pantallas.
- Bibliotecas Leaflet 1.9.4 y Lucide 0.545.0 locales, con sus licencias y recursos; la política de seguridad del servidor local bloqueaba los scripts externos anteriores.
- Enlace de descarga en Ajustes actualizado al canal android-stable.
- Vista local: móviles 320/390 px, tablet 768 px y escritorio 1280 px; sin desbordamiento horizontal en las nueve secciones. Formularios y hojas con desplazamiento, cierre de rutas activas, selector múltiple de fotos y cambio de tema comprobados.
- No se ejecutaron permisos GPS ni vinculación en un teléfono físico; la vista local no reproduce los servicios cloud de movilidad. La validación nativa corresponde al build y a las pruebas de GitHub Actions.
