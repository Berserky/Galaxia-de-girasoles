# Nuestra galaxia

Un espacio privado para Sebas y Adri, que conserva el regalo original y crece alrededor de su vida cotidiana. Sin rachas, comparaciones o puntuaciones de la relación.

## Primera versión implementada

| Espacio | Qué permite |
| --- | --- |
| Inicio | Resumen, días juntos al configurar su fecha, estado de ánimo, próximos eventos, recuerdos y pregunta diaria. |
| Álbum | Subir y borrar copias de fotos, abrir el álbum compartido, importar una selección de Google Fotos y consultar una carpeta Drive con autorización. |
| Historia | Seis recuerdos originales, búsqueda, creación, edición y eliminación de nuevos recuerdos con fecha opcional. |
| Música | Canción original, enlaces Spotify/YouTube, dedicatorias y reproductores bajo demanda. |
| Días especiales | Calendario mensual, cumpleaños, aniversarios y fechas personalizadas, recurrencia anual y exportación ICS. |
| Planes | Ideas de citas, lista compartida, categorías, fechas opcionales, pendientes y planes vividos. |
| Conectar | Emociones, pregunta del día con revelación mutua, propuestas de actividades y notas. |
| Ajustes | Nombres, inicio de relación, álbum, conexiones, exportación y cierre de sesión. |
| Regalo original | La galaxia nocturna, sus seis flores, carta, música y secreto. |

No se han inventado fechas, fotos o canciones elegidas por la pareja. Las ilustraciones son decorativas. Las propuestas de actividades son ideas para elegir; no aparecen como planes confirmados hasta guardarlas.

## Estreno privado

El siguiente paso operativo es configurar las credenciales Google, registrar las dos cuentas autorizadas y alojar el servidor con HTTPS y almacenamiento persistente. Ver `ACTIVAR.md`. La arquitectura implementa una sola pareja por instalación; no es un servicio para registrar muchas parejas.

## Evolución propuesta

1. **Personalizar con uso real:** importar fotos, completar fechas y elegir canciones. Mejorar las pantallas según cómo las usen ambos.
2. **Unir los recuerdos:** asociar fotos, canciones y lugares a cada recuerdo; crear álbumes por viaje y un mapa privado. Requiere ampliar el modelo de datos y acordar qué metadatos de ubicación conservar.
3. **Anticipar los días:** recordatorios configurables, avisos push y suscripción de calendario. Requiere permisos explícitos y tareas programadas en el servidor; no está implementado.
4. **Rituales más personales:** cápsulas del tiempo, cartas programadas, retos elegidos por ambos y archivo de preguntas pasadas.
5. **Respaldo más sencillo:** almacenamiento de objetos privado, miniaturas, cuotas y restauración asistida. La versión actual usa el volumen del servidor y respaldo manual.
6. **Aplicación instalada:** iconos específicos de dispositivos, soporte offline deliberado, pruebas Safari/iOS y Android. Hoy incluye manifiesto básico para acceso desde inicio, sin caché offline de datos privados.

Estas fases son propuestas de producto, no funciones anunciadas como disponibles.
