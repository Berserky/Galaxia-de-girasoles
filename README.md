# Nuestra galaxia 🌻

Una aplicación privada para dos: fotos, recuerdos, música, calendario, planes y pequeños rituales de pareja. Incluye el regalo original de Sebas para Adri en `/regalo/`.

## Probar

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
- Notas, ajustes personales, exportación JSON y regalo original.

## Activar para ambos

Ver **[docs/ACTIVAR.md](docs/ACTIVAR.md)** para configurar Google, las dos cuentas permitidas, HTTPS y un servidor persistente. Incluye Dockerfile.

**GitHub Pages no ejecuta el servidor privado.** Los archivos originales en la raíz conservan el regalo estático; la aplicación completa arranca con `npm start` y requiere la configuración de `.env.example`.

El código de las integraciones Google está preparado, pero la conexión con las cuentas reales requiere credenciales y autorización. El enlace compartido de Google Fotos abre el álbum original; importar mediante el selector es un paso manual. No hay sincronización automática de ese álbum ni recordatorios push.

## Arquitectura

`app/server.mjs`: servidor HTTP, sesiones, OAuth, API y archivos privados. `app/store.mjs`: SQLite y control de versiones. `app/google.mjs`: tokens cifrados y clientes Google. `app/domain.mjs`: validación, actividades y calendario. `app/public/`: interfaz adaptable sin frameworks. `tests/`: pruebas de datos, persistencia y controles de acceso.

Una pareja por instalación; una instancia Node con volumen persistente. Datos y fotos nunca se guardan en el repositorio. El modo local y el privado usan bases separadas. Se requiere respaldo del directorio de datos y de la clave del servidor.

La visión de producto y las fases futuras están en **[docs/PRODUCTO.md](docs/PRODUCTO.md)**.
