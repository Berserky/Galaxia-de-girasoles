# NG-AUD-003 — Onboarding horizontal

**Hallazgo F1:** en AVD API35 el formulario de vinculación quedaba bajo el primer pliegue en paisaje, pero podía alcanzarse desplazándose; no es bloqueo funcional.

## Ajuste Fase 4
Regla CSS **exclusivamente** para `(orientation:landscape) and (max-height:560px)`: tarjeta menos alta, logotipo y texto compactos, campo y CTA en dos columnas sin scroll interno. En vertical se conservan las reglas originales. Se agregó asociación accesible `label for="pairCode"` / `input id="pairCode"` sin tocar validación ni backend.

## Gates y limitaciones
- `tests/ng-onboarding-landscape.test.mjs`: contrato DOM/CSS para que el formulario no desaparezca y se mantenga obligatorio.
- CI Node/Android debe pasar en este PR; capturas reales portrait/landscape y tap del CTA en emulador siguen pendientes de evidencia visual y **no** se declaran VERIFICADAS por un test de strings.
- Si una pantalla horizontal muy pequeña requiere scroll vertical, está permitido; no se debe ocultar el contenido ni la barra del sistema. No se toca la vinculación de cuentas ni secretos.
