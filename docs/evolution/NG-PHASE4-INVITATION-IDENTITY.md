# Fase 4 — Invitaciones e identidad, NG-FNC-007/008/009

**Alcance:** pruebas negativas SQL de funciones `galaxy_invite()`, `galaxy_claim()`, `galaxy_person()` en Supabase **efímero**, con `BEGIN / ROLLBACK`. No son pruebas E2E de UI ni del token dentro de Android.

## Casos automatizados
1. El perfil administrador `0` puede emitir una invitación cuando `1` no existe y no puede usarla para cambiar su propio perfil.
2. El token correcto pero vencido es rechazado, sin dar identidad al candidato.
3. Una invitación posterior invalida el token anterior; otro token de 72 caracteres con digest incorrecto también se rechaza.
4. Un correo no verificado no puede reclamar la invitación correcta.
5. La invitación válida convierte al candidato en perfil `1`, preservando al propietario como `0`.
6. No se puede volver a invitar cuando `1` ya está registrado.
7. Un tercero no puede reutilizar una invitación consumida, crear una invitación ni adquirir un perfil.

**Control:** `tests/phase4-invitation-identity.sql`, ejecutado en `Privacy Firewall DB` sobre una base aislada. Los valores de tokens se mantienen como `current_setting()` de transacción y los comandos SQL solamente imprimen booleanos; no se escriben credenciales en artefactos.

## Lo que NO demuestra
- No existen dos parejas aisladas dentro del mismo tenant; el modelo actual solo contiene `person IN ('0','1')`.
- No cubre la UI de enlace de Android, deep-links, cierre de sesión, revocación de device tokens ni sesiones remotas reales.
- No autoriza una promoción a `qa` o `prod`, ni cierra por sí solo Fase 4.
