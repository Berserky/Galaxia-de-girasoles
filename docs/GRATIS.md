# Publicar sin mensualidad

Esta variante usa GitHub Pages y un proyecto Supabase **Free**. El servidor Node original sigue funcionando para la vista local. La carpeta `dist` se genera con `node scripts/build-pages.mjs`; no se suben bases de datos locales, fotos, correos ni contraseñas a GitHub.

## Activación

1. Crear un proyecto **Free** en Supabase. No activar Pro, complementos de pago ni un dominio propio.
2. Ejecutar `supabase/schema.sql` una sola vez en el editor SQL. Registrar el correo del administrador, desde el editor privado, con `insert into public.galaxy_members(person,email) values ('0','CORREO_DEL_ADMINISTRADOR');`. No publicar ese SQL personalizado en el repositorio.
3. Activar Google en Authentication → Providers. Crear las credenciales OAuth web en Google Cloud y usar la URL de callback que muestra Supabase. Guardar el secreto únicamente en Supabase. Configurar la URL del sitio y Redirect URLs con la dirección exacta de GitHub Pages, incluida la carpeta y `/` final. El registro por Google debe estar habilitado: registrarse por sí solo **no concede acceso**; las políticas exigen ser administrador o aceptar una invitación válida.
4. `deploy/public-config.json` contiene la URL y clave pública del proyecto gratuito preparado para esta aplicación. Para usar otro proyecto, cambiar ese archivo o definir las variables `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` en GitHub Actions. Ambas son públicas. Nunca usar `service_role` ni una clave `sb_secret_`.
5. En GitHub → Settings → Pages, elegir **GitHub Actions**. Integrar la rama en `main` y ejecutar el flujo de publicación.
6. Entrar con Google como administrador. En Ajustes, pulsar **Invitar a Adriana**. Compartirle la dirección y el código en privado. Ella pega el código y entra con su Google: su correo queda registrado automáticamente. El código expira en siete días y solo sirve una vez; generar otro invalida el anterior.
7. Guardar desde la aplicación el enlace del álbum y las fechas que deseen. No hay fechas inventadas ni datos personales nuevos incorporados a la web pública.

## Qué comparte esta variante

Fotos subidas desde el dispositivo, canciones de Spotify/YouTube, recuerdos, notas, calendario, planes, estados de ánimo y preguntas con respuestas ocultas hasta que ambos contesten. El álbum de Google Fotos se abre por enlace. La importación directa mediante Picker y la carpeta de Drive siguen en la variante Node, pero **no están activadas en Pages**.

Supabase aplica los permisos en la base de datos y Storage: conocer la URL o la clave pública no permite leer los datos. Solo el administrador genera la invitación y solo puede incorporarse una pareja. Las fotos usan enlaces temporales de diez minutos; quien reciba uno podrá ver esa foto durante ese tiempo. El regalo original ya pertenecía al repositorio público y sigue siendo público en `/regalo/`; su contenido previo no adquiere privacidad por añadir un inicio de sesión a la aplicación.

El plan gratuito incluye 1 GB de archivos y puede pausar proyectos después de una semana sin actividad. Consultar los límites vigentes en https://supabase.com/pricing. Si se pausa, reactivarlo desde Supabase; no contratar un plan para evitar la pausa. Exportar periódicamente los datos desde Ajustes; las fotos se descargan aparte. El acceso con contraseña es opcional para cuentas previamente creadas por el administrador; el flujo recomendado utiliza Google y no depende del correo transaccional de Supabase.

## Verificación antes de compartir

Comprobar inicio de sesión de administrador, rechazo de una tercera cuenta, invitación de la pareja, visibilidad de cambios desde ambos teléfonos, fotos privadas y respuestas ocultas. Las pruebas del servidor local no sustituyen estas pruebas contra el proyecto Supabase real.
