# Nuestra galaxia 🌻

Una aplicación privada para dos: fotos, recuerdos, música, calendario, planes y pequeños rituales de pareja. Incluye el regalo original de Sebas para Adri en `/regalo/`.

## Probar

**Publicación gratuita:** la variante GitHub Pages + Supabase Free se configura en [docs/GRATIS.md](docs/GRATIS.md). Incluye invitación de un solo uso para registrar a la pareja. `node scripts/build-pages.mjs` genera el sitio; el flujo de GitHub Actions publica desde `main` cuando se han configurado las variables públicas. Google Fotos se abre por enlace; la sincronización directa de Drive requiere la variante con servidor que se describe abajo.

Requiere **Node.js 24+**. Sin dependencias de ejecución ni compilación.

```sh
npm run dev
```

Abrir **http://localhost:4180**. La vista local permite alternar entre las dos personas y guarda los cambios en `data/demo`. Las conexiones Google requieren configuración propia; no simulan una conexión exitosa.

```sh
npm test
```

## Funciones

- Inicio personalizado, fecha de la relación editable y estado de ánimo.
- Álbum privado con subida JPG/PNG/WebP, selección mediante Google Photos Picker e integración opcional de carpeta Google Drive.
- Recuerdos con búsqueda, creación y edición; conserva los seis textos originales.
- Canciones de Spotify/YouTube con dedicatorias y reproductores bajo demanda.
- Calendario con eventos, aniversarios anuales y exportación ICS.
- Planes compartidos, ideas para elegir y seguimiento de planes vividos.
- Pregunta diaria: las respuestas del otro se ocultan en el servidor hasta que ambos respondan.
- Gestos privados: abrazo, beso y te extraño; girasol que crece con la participación de ambos, sin perder progreso por descansar.
- Juego de conocerse con respuestas protegidas hasta adivinar; ritual semanal de agradecimiento, necesidades y próximo plan.
- Notas colaborativas con control de versiones; mensajes de voz con dedicatoria y referencia a un recuerdo, canción o cápsula.
- Citas sorpresa según tiempo, presupuesto estimado en COP y casa/salir; guardar como plan compartido.
- Widget Android con foto opcional del álbum, próxima fecha especial y envío de abrazo. Notificaciones nativas opcionales mediante sincronización periódica, independientes del GPS.
- Ajustes personales, exportación JSON y regalo original.

## Activar para ambos

Ver **[docs/ACTIVAR.md](docs/ACTIVAR.md)** para configurar Google, las dos cuentas permitidas, HTTPS y un servidor persistente. Incluye Dockerfile.

**GitHub Pages no ejecuta el servidor privado.** Los archivos originales en la raíz conservan el regalo estático; la aplicación completa arranca con `npm start` y requiere la configuración de `.env.example`.

El código de las integraciones Google está preparado, pero la conexión con las cuentas reales requiere credenciales y autorización. El enlace compartido de Google Fotos abre el álbum original; importar mediante el selector es un paso manual. No hay sincronización automática de ese álbum. Las notificaciones de gestos en Android usan sincronización periódica: el sistema puede retrasarlas y no son push instantáneos.

## Arquitectura

La producción web gratuita usa **GitHub Pages + Supabase**: `scripts/build-pages.mjs` genera la interfaz desde `app/public`, `app/cloud/adapter.js` conecta Auth/datos y Supabase/PostgreSQL/Storage conserva el estado compartido. El Edge Function `android-companion` expone el contrato móvil.

Android empaqueta su interfaz local dentro del APK y conserva servicios nativos para bridge, ubicación, multimedia, notificaciones, archivos y actualizaciones. El canal `android-stable` ya no se publica desde un push normal a `main`: `main` produce un candidate y la promoción estable exige gates y aprobación explícita. Ver **[docs/RELEASE_GOVERNANCE.md](docs/RELEASE_GOVERNANCE.md)**.

La implementación Node (`app/server.mjs`, `app/store.mjs`, `app/google.mjs`) sigue disponible como variante privada/autohospedada descrita en **[docs/ACTIVAR.md](docs/ACTIVAR.md)**; no es el runtime de GitHub Pages.

La visión de producto y las fases futuras están en **[docs/PRODUCTO.md](docs/PRODUCTO.md)**.
