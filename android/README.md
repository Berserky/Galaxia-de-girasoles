# Nuestra Galaxia · Android

Aplicación móvil de Nuestra Galaxia. Desde la versión 1.4.0 deja de ser solo un compañero de ubicación: reúne la experiencia compartida de la web en una interfaz móvil empaquetada dentro del APK, manteniendo servicios nativos para ubicación, widgets, archivos, permisos y actualización.

## Arquitectura

- **UI móvil local:** HTML/CSS/JS dentro de `android_asset/mobile`. No abre una web remota para funcionar.
- **Puente nativo:** `GalaxyBridge` expone únicamente acciones permitidas. El token del dispositivo nunca se entrega al JavaScript.
- **API móvil:** el Edge Function `android-companion` valida el token cifrado antes de acceder a datos compartidos.
- **Mapa:** motor local dentro del APK; OpenStreetMap solo entrega teselas gráficas.
- **Datos:** la web y Android usan el mismo universo en Supabase.
- **Actualizaciones:** el canal `android-stable` mantiene upgrade sobre la misma aplicación y la misma firma.

## Funciones móviles

- Inicio compartido, estado de ánimo y pregunta diaria.
- Recuerdos, calendario, planes, notas, cápsulas, deseos y viajes.
- Álbum privado y música desde archivos del teléfono.
- Momentos: abrazo, beso, “te extraño”, girasol, juego de conocerse, ritual semanal, notas compartidas, citas sorpresa y mensajes de voz.
- Nuestro mapa: posición voluntaria, velocidad, modo de movimiento, lugares, estados rápidos, Acompáñame, recorridos e historial.
- Widget Android con foto, próxima fecha y envío de abrazo.
- Ubicación en segundo plano con notificación permanente.
- Actualización del APK desde la propia aplicación.

## Privacidad y seguridad

- El GPS no se inicia solo; cada persona decide cuándo compartir.
- Android muestra una notificación permanente mientras el servicio de ubicación está activo.
- El vínculo usa un código temporal y un token de dispositivo cifrado con Android Keystore.
- Revocar un dispositivo invalida su token.
- El APK solo contiene la clave **publicable** de Supabase; las credenciales privilegiadas permanecen en el servidor.
- El WebView no recibe el token y bloquea navegación externa.
- Multimedia privada se entrega mediante URLs firmadas temporales.
- Las muestras sin conexión se conservan localmente con límite y se sincronizan al recuperar conectividad.

## Android

- minSdk 26
- targetSdk / compileSdk 36
- Foreground Service tipo `location`
- Google Play Services Location 21.4.0
- AndroidX WorkManager 2.11.2
- Java 17
- AGP 9.2.0 / Gradle 9.4.1

## Compilar

```bash
gradle -p android testDebugUnitTest assembleDebug
```

GitHub Actions genera el APK firmado cuando los cambios llegan a `main` y actualiza la release `android-stable`.
