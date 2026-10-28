# Nuestra Galaxia V5 — P8 / validación local de integración

**Fecha:** 28/oct/2026. **PR:** #204 DRAFT, derivado de #203; candidato de trabajo P5 + P6 + P7.
**Entorno:** Windows 10, Node 24.21.0, repositorio clonado de manera aislada; sin credenciales ni datos personales usados para las pruebas.
**Alcance:** correcciones de test heredados que asumían la interfaz anterior; eliminación del código muerto de desplazamiento de etiquetas reemplazadas por la cuadrícula de Recuerdos P6. No modifica políticas de acceso, backend, GPS ni FCM.

## Resultados reproducibles

| Comando | Resultado |
|---|---|
| `node --check android/app/src/main/assets/mobile/app.js` | PASS |
| `node --check scripts/qa-android-mobile.mjs` | PASS |
| `node --test` focalizado P5/P6/P7/P8 (5 archivos) | 50/50 PASS |
| `npm.cmd test` antes de reconciliar tests | 1.008 tests: 995 PASS, 9 FAIL, 4 SKIP |
| `npm.cmd test` después de reconciliar tests | 1.013 tests: 1.008 PASS, 0 FAIL, 5 SKIP |
| `node scripts/qa-android-mobile.mjs` inicialmente | FAIL: referencia obsoleta al scroll de pestañas eliminadas en P6 |
| `node scripts/qa-android-mobile.mjs` corregido | PASS: «QA móvil Nuestra Galaxia: OK» |

**Causa de los nueve fallos iniciales:** dos mocks de privacidad P2 no tenían `window` tras el nuevo módulo P7; uno falló por CRLF Windows; uno por Python inaccesible (debe ser SKIP, jamás PASS); uno por rechazo correcto de URL con espacios; uno por selector P6 ampliado; uno era un regex inválido en el propio test P7C; dos pedían flujos de confirmación anteriores a las previsualizaciones seguras P7F/G. Se actualizaron pruebas para exigir las rutas y confirmaciones actuales sin retirar comprobaciones de privacidad.

**SKIP:** cinco en el segundo resultado, incluyendo prueba de sintaxis Python no disponible en Windows. Los casos omitidos NO se declaran ejecutados ni certificados.

## Puertas aún abiertas

- **Android compilado / instrumentación:** NO EJECUTADO. Java 17 y SDK Android están instalados, pero Gradle y gradlew.bat no están disponibles en esta copia; `adb devices -l` no detectó emulador/dispositivo. No instalar ni alterar Android Studio o el SDK del propietario como parte de este ajuste.
- **Required checks GitHub:** al consultar el HEAD anterior del PR #204 (`941b3c0`) había cero check runs; comprobar de nuevo con el nuevo commit. Un resultado local no sustituye CI.
- **Matriz P8 (19 escenarios):** siguen sin certificación integral de APK/AVD, accesibilidad, capturas, 7 temas y aceptación humana. Ningún resultado de un SHA anterior habilita producción.
- **Publicación:** mantener PR DRAFT sin fusionar a `desarrollo`, `qa` ni `prod` y sin crear release.

## Acciones posteriores

1. Validar sobre el **SHA HEAD nuevo** la ejecución `npm test` y contrato móvil una vez incorporado este reporte.
2. Preparar Gradle/AVD de forma aislada y ejecutar **una única campaña Android** con evidencias sanitizadas sobre el SHA definitivo, sin duplicar iteraciones de P5/P6/P7.
3. Clasificar resultados reales en la matriz P8, obtener aprobación visual y checks obligatorios; solo entonces proponer la integración conforme a `BRANCH_POLICY.md`.
