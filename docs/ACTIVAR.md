# Activar Nuestra galaxia para dos

## Vista local

Requiere Node.js 24 o superior. Ejecutar `npm run dev` y abrir `http://localhost:4180`. No requiere instalar dependencias. El selector «Vista local» permite probar ambas personas. Los datos de esta vista se guardan en `data/demo`, separados del espacio privado.

Esta vista escucha exclusivamente en el computador local. No se debe publicar ni usar un túnel para compartirla. El servidor rechaza el modo de demostración si `NODE_ENV=production`.

## Google y acceso privado

1. Crear un proyecto de Google Cloud y habilitar **Google Photos Picker API** y, si van a usar carpetas, **Google Drive API**.
2. Configurar la pantalla de consentimiento. Para una prueba privada, añadir sus dos cuentas como usuarios de prueba. Google puede exigir verificación según el tipo de aplicación y los permisos; los tokens de aplicaciones externas en modo Testing pueden vencer a los siete días.
3. Crear un cliente OAuth de tipo **Aplicación web**. Registrar la URL exacta de retorno: `https://SU-DOMINIO/auth/callback`. Para probar el acceso real localmente, registrar también `http://localhost:4180/auth/callback`.
4. Copiar `.env.example` a `.env`. Completar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAILS` (exactamente dos cuentas, separadas por coma) y `BASE_URL`.
5. Generar `TOKEN_KEY` con `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Guardar esta clave junto con los respaldos privados. No cambiarla arbitrariamente: cifra los tokens de Google.
6. Ejecutar `npm start`. Cada persona entra con su propia cuenta. El orden de las cuentas en `ALLOWED_EMAILS` corresponde al orden de los nombres en Ajustes; mantener ese orden después de empezar.
7. En **Nuestro espacio**, completar nombres, inicio de la relación y enlace del álbum. Las fechas del calendario se agregan y editan allí mismo, sin modificar código.

El enlace del álbum compartido es un dato privado que se guarda en la base de datos. No debe incluirse en el repositorio público ni en variables del cliente.

## Fotos

- **Subir del celular:** fotos JPG, PNG o WebP, hasta 12 MB por foto y 30 por selección. HEIC y videos no se admiten en esta versión. Los originales permanecen en el dispositivo.
- **Google Fotos:** conectar la cuenta, abrir el selector, elegir hasta 30 fotos y regresar para importar. Se guardan copias de hasta 2048 × 2048 para mostrar en la aplicación; no es un respaldo de los originales. La selección de Google caduca: volver a elegir si ya venció. Reintentar una importación parcial no duplica las fotos importadas.
- **Álbum compartido de Google Fotos:** el enlace abre el álbum en Google. La API no permite sincronizar automáticamente álbumes compartidos preexistentes. El selector es la integración oficial para traer fotos a la aplicación.
- **Google Drive:** cada cuenta conecta Drive y debe tener permiso sobre la carpeta compartida elegida. Se muestran los JPG, PNG y WebP directamente contenidos en ella, con paginación. No se recorren subcarpetas ni se modifican originales. El permiso `drive.readonly` es amplio; la aplicación restringe las consultas y el acceso a imágenes a la carpeta configurada.
- Eliminar una foto del álbum local elimina la copia del servidor, nunca el original de Google. Los respaldos previamente hechos se gestionan aparte.

## Música y calendario

Pegar enlaces de Spotify (canción, álbum o playlist) o de videos de YouTube. Los reproductores se cargan al pulsar Escuchar, sin claves de esas plataformas. La disponibilidad y la reproducción completa dependen del proveedor y de la cuenta; no se sincroniza la reproducción entre los dos dispositivos.

Las fechas se manejan como días completos. La fecha diaria usa `America/Bogota`. Los eventos anuales del 29 de febrero se repiten en años bisiestos. El botón Exportar calendario produce un archivo ICS; es una exportación manual, no una sincronización bidireccional ni una suscripción. Los avisos push no están implementados.

## Alojamiento

Se necesita un servidor Node persistente o un contenedor con disco persistente. **GitHub Pages solo puede mostrar el regalo original; no ejecuta esta aplicación privada.** No usar funciones sin disco persistente con esta configuración SQLite.

El Dockerfile incluido ejecuta Node como usuario sin privilegios. Configurar las variables del servidor, publicar detrás de HTTPS y montar un volumen persistente en `/app/data`. Usar una única instancia de la aplicación. `BASE_URL` debe coincidir exactamente con el dominio público. El proxy debe conservar el encabezado Host. Ruta de salud: `/health`.

La base SQLite comparte todos los contenidos entre las dos cuentas. Las ediciones incluyen una versión para evitar sobrescribir cambios simultáneos. La aplicación actualiza las vistas de consulta cada 30 segundos; no interrumpe formularios, álbumes ni música en reproducción. Volver a cargar muestra los cambios inmediatamente.

Respaldar todo `DATA_DIR` con el servidor detenido para obtener una copia coherente de SQLite y las fotos. Para restaurar, detener la aplicación, recuperar el directorio completo y la misma clave `TOKEN_KEY`, y reiniciar. El archivo JSON de Ajustes es una exportación de contenido, no sustituye ese respaldo ni tiene importador automático.

## Privacidad de las respuestas

El servidor solo devuelve la respuesta de la otra persona cuando ambos contestaron ese día. Ni el JSON de exportación ni el estado de la aplicación exponen respuestas pendientes del otro. El administrador del servidor puede acceder a la base de datos: no es cifrado de extremo a extremo.

Las sesiones usan cookies HttpOnly; los tokens de Google se cifran en el servidor. Los archivos `.env`, bases de datos y fotos quedan excluidos del repositorio y de la imagen Docker. Las fotos locales requieren una sesión de una de las dos cuentas autorizadas.

## Verificar antes del estreno

`npm test` ejecuta las pruebas del servidor y las reglas de datos. Probar además con las dos cuentas reales: acceso permitido y denegado, conexión/desconexión de Google, selección e importación de Fotos, carpeta Drive, música, cambio simultáneo de un plan y descarga del calendario.

Las conexiones Google están implementadas, pero no se han validado contra las cuentas reales sin las credenciales del proyecto. La revisión local se hizo con Edge/Chromium; comprobar también los celulares que vayan a utilizar.

Documentación oficial consultada:

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/photos/overview/authorization
- https://developers.google.com/photos/picker/guides/media-items
- https://developers.google.com/photos/picker/reference/rest/v1/sessions
- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developer.spotify.com/documentation/embeds
