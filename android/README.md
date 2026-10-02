# Nuestra Galaxia · Compañero Android

Aplicación nativa complementaria de la PWA. Su única responsabilidad es mantener la ubicación autorizada mientras Android permite que el servicio en primer plano siga activo.

## Privacidad

- El GPS no se inicia solo: la persona pulsa “Comenzar a compartir”.
- Mientras está activo, Android muestra una notificación permanente.
- Puede detenerse desde la app o desde la propia notificación.
- El teléfono se vincula con un código temporal de 10 minutos generado desde la PWA.
- La credencial del dispositivo se guarda cifrada con Android Keystore.
- Revocar el dispositivo desde la PWA invalida inmediatamente su credencial.
- No hay claves de administrador dentro del APK. La clave Supabase incluida es publicable.
- Las muestras históricas sin conexión se conservan localmente (máximo 5.000) y se sincronizan al recuperar conectividad.

## Android

- minSdk 26
- targetSdk / compileSdk 36
- Foreground Service tipo `location`
- Google Play Services Location 21.4.0
- Java 17
- AGP 9.2.0 / Gradle 9.4.1

## Flujo

1. Instalar el APK.
2. En la PWA: Ajustes → Compañero Android → Generar código.
3. Pegar el código en la app Android.
4. Conceder ubicación precisa.
5. Pulsar “Comenzar a compartir en segundo plano”.
6. Opcionalmente habilitar “Permitir todo el tiempo” en Ajustes de Android para mejorar la resiliencia del servicio.

El servicio nativo actualiza `galaxy_locations`, almacena historial con deduplicación, alimenta Acompáñame, llegadas Casa/Trabajo y encuentros.

## Compilar

```bash
gradle -p android testDebugUnitTest assembleDebug
```

GitHub Actions publica el APK instalable en la release `android-stable`.
