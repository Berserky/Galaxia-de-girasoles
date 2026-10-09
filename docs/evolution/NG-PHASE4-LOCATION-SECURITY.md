# NG-AUD-004 — Fase 4: autorización de ubicación compartida
**Estado: propuesta en PR, no desplegada.** Base `desarrollo` en 2026-10-08.

## Hallazgo
Las políticas de `galaxy_locations`, `galaxy_trip_points`, `galaxy_location_history` y `galaxy_trip_history` permiten la rama `sharing=true` sin verificar explícitamente `galaxy_person()`. Un usuario autenticado que no forme parte de la pareja puede cumplir esa rama en consultas SQL (riesgo de exposición). No se afirma explotación en producción.

## Mitigación
Migración nueva `20261008193000_ng_phase4_member_location_rls.sql`: sustituye **solo** cuatro políticas SELECT por una condición obligatoria de membresía y mantiene las reglas de propiedad y consentimiento actuales. No toca filas, firma Android, funciones Edge, grants ni otras políticas. `supabase/schema.sql` replica el esquema canónico para pruebas estáticas. Las migraciones previas permanecen intactas (manifest de producción como prefijo inmutable).

## Verificación y límites
- `tests/phase4-member-location-rls.sql`: transacción aislada con miembros A/B y ajenos autenticados C/D. Los miembros pueden leer lo autorizado, los ajenos no ven ubicación compartida, trayectos, historial, objetos privados ni dispositivos. `ROLLBACK` final.
- `Privacy Firewall DB` debe aplicar Fase 0, Fase 1, Fase 2, luego la nueva migración y probar la política. `Data Integrity DB` mantiene la huella previa de Phase 0 separando la nueva migración de su replay.
- La app actual solo tiene `galaxy_members.person IN ('0','1')`: **no** soporta dos parejas independientes dentro del mismo tenant. C/D prueban rechazo a intrusos, no aislamiento de tenants que no existen.
- El job QA dual-user remoto anterior devolvió `NOT_EXECUTED` por falta de variables/secretos QA; no equivale a PASS real. CameraX conserva 2 casos SKIPPED en AVD sin cámaras.
- Antes de cualquier promoción, revisar privilegios y RLS con base efímera, verificar falsos positivos, documentar resultados de CI exactos, habilitar QA real y aprobar migración por el flujo formal. **No aplicar esta migración en producción desde este PR.**
