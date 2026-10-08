# Nuestra Galaxia — política de ramas (8 octubre 2026)

## Ramas permanentes

- `desarrollo`: único punto de integración de funcionalidades. El trabajo nuevo puede nacer en ramas temporales creadas desde desarrollo; tras la revisión se fusiona a desarrollo y se elimina la rama temporal.
- `qa`: candidato Android y validaciones de integración, emulador, RLS, regresión y seguridad.
- `prod`: fuente exacta del Android estable publicado; solo recibir commits ya aprobados en QA.
- `main` es transitoria: se conserva hasta completar el cambio de rama predeterminada de GitHub y verificar las integraciones externas. No iniciar cambios nuevos aquí.

## Promoción

1. Rama temporal desde `desarrollo` → Pull Request y CI → merge a `desarrollo`.
2. Integrar por **fast-forward** `desarrollo` → `qa`. Esperar resultado PASS del workflow **Android Release Candidate** disparado por push a `qa`.
3. Tras aprobación de QA, avanzar `prod` **al mismo SHA exacto** del candidato aprobado. Sin squash o merge-commit durante la promoción.
4. Cuando se publique un APK con versionCode nuevo, ejecutar manualmente **Android Stable Promotion** desde la rama `prod` y con el Run ID de QA. Conservar las protecciones del entorno `android-stable` y validaciones de firma, integridad y actualización.
5. Después de una publicación estable, `desarrollo`, `qa` y `prod` quedan idénticas hasta que se inicie el siguiente ciclo. Si hay trabajo no aprobado, no forzar identidad ni llevarlo a producción.

## Salvaguardas

- El regalo histórico está en `legacy/regalo-galaxia-original`; sus archivos de origen se preservan para reutilizarlos en Android en una fase futura.
- Hay **80 etiquetas de rescate** en `archive/2026-10-08/<rama>` para todos los historiales divergentes.
- Se verificó el respaldo Git en `C:\Users\juans\Galaxia-pre-limpieza-2026-10-08.bundle`. El respaldo contiene todas las referencias previas a la depuración.
- Restauración ejemplo: `git switch -c rescate/musica archive/2026-10-08/aegiron/music-player-v2`.
- El archivo `docs/branch-audit-2026-10-08.csv` contiene los commits históricos y su clasificación frente a la base de producción 4.1.1.

## Decisiones sobre funciones antiguas

| Grupo | Referencia conservada | Estado |
|---|---|---|
| Regalo Galaxia de Girasoles | `legacy/regalo-galaxia-original` | Conservar permanentemente, pendiente de futura integración |
| Momentos y widgets | `legacy/revisar-momentos-widgets` | BondWidget y GestureLedger presentes en 4.1.1; falta comparación funcional |
| Música privada | `legacy/revisar-reproductor-musica` | Revisar persistencia privada de MP3, no integrar código antiguo directamente |
| Mapas y privacidad | `legacy/revisar-mapas-privacidad` | Revisar insights, eventos de llegada y controles de privacidad |
| Diseño contemporáneo | `legacy/revisar-diseno-contemporaneo` | Comparar experiencia visual actual antes de rescatar componentes |
| Universo 2.1 | `legacy/revisar-universo-2-1` | Auditar diferencias de presencia, widgets y voz frente a Android 4.1.1 |
| Hogar / RPG / tienda de versiones antiguas | etiquetas `archive/2026-10-08/aegiron/*` | Retiradas como ramas activas; contenido recuperable si se decide reabrir la idea |
| PWA web y Android antiguo | etiquetas de archivo | No volver a desplegar automáticamente; no borrar dependencias activas sin análisis |

**Advertencia Android:** la aplicación actual usa `WebViewAssetLoader` y recursos empaquetados en `android/app/src/main/assets/mobile`, aunque el antiguo sitio web/PWA sea prescindible. Borrar el WebView interno rompería la versión actual.

## Pendientes operativos externos al código

1. Cambiar GitHub Default Branch de `main` a `prod`, migrar reglas de protección de ramas y restricciones de pushes; retirar `main` solo cuando estas dependencias estén verificadas.
2. Establecer protecciones en `qa` y `prod`: revisiones, pruebas obligatorias, prohibición de force push y despliegue Android con aprobación manual.
3. Verificar los secretos y variables de los entornos de QA/Producción (Android, Supabase, Firebase y firma) sin copiar secretos al repositorio.
4. La web de GitHub Pages ya no publica automáticamente mediante el workflow; desactivar completamente GitHub Pages desde Settings solo si se confirma que no es necesario conservar el enlace histórico del regalo ni alojar archivos usados por Android.
5. Las ramas Dependabot son transitorias. Sus cambios deben revisarse y pasar por `desarrollo` → `qa` → `prod` antes de liberar dependencias.

