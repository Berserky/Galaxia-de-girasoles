# ACTA DE CIERRE ADMINISTRATIVO 4.1.2 Y PREPARACIÓN VISUAL EVOLUTION 5.0
Fecha: **2026-10-12**. Naturaleza: cierre documental y trazabilidad de GitHub, no nueva certificación física o funcional. Este acta registra decisiones realizadas después de `docs/qa/ng-f4-engineering-exit-20261012.md`, que conserva valor como evidencia **histórica anterior al release**.

## 1. Línea estable y confirmaciones

- `prod@fde141d4c8e7622ac1d6f10f1abbfbda8e8e7d0c` y `qa` idénticas al verificar, Android app `4.1.2` / `versionCode=39`.
- Android Release Candidate [run 38307619766](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38307619766): **completed SUCCESS**.
- Android Stable Promotion [run 38310720521](https://github.com/Berserky/Galaxia-de-girasoles/actions/runs/38310720521): **completed SUCCESS**.
- Release pública `android-stable`: APK `NuestraGalaxia.apk` (16 348 538 bytes), asset digest `sha256:072577086f2896ed78e0925cda2b5416bae6262abaa71ade89aca9772dada2b4`; `update.json` actualizado 2026-10-12. El workflow de stable exige `candidate.sourceSha == GITHUB_SHA`, firma, aumento de code, gates y token de aprobación, y sube assets con `--clobber`. El ref `refs/tags/android-stable` conserva commit antiguo `33e39259` del 2/oct: **no usar tag SHA como SHA fuente del APK nuevo**; preferir `update.json.sourceSha` más candidate run ID y hash. El manifiesto no se descargó en este barrido; comprobarlo cuando corresponda.
- No se alteraron APK, SHA de QA/prod, migraciones ni Firebase durante el saneamiento.

## 2. Tickets del ciclo anterior y decisión explícita

| ID | Estado | Criterio |
|---|---|---|
| [#125 GPS RLS](https://github.com/Berserky/Galaxia-de-girasoles/issues/125) | CLOSED / completed | migración y guardia de membresía verificada QA + producción, con regresión negativa controlada |
| [#131 cápsulas](https://github.com/Berserky/Galaxia-de-girasoles/issues/131) | CLOSED / completed | guardia NULL aplicada y verificada en producción |
| [#129 WebView/CameraX](https://github.com/Berserky/Galaxia-de-girasoles/issues/129) | CLOSED / completed por aceptación | 4.1.2 RC final verde + mitigaciones, persiste antecedente flakey primer intento; no falsa afirmación de estabilidad universal |
| [#133 FCM](https://github.com/Berserky/Galaxia-de-girasoles/issues/133) | CLOSED / completed por aceptación | evidencia de transporte real, exact deep-link y ensayos QA Moto/AVD; casos avanzados no todos ejecutados |
| [#147 F4 Physical](https://github.com/Berserky/Galaxia-de-girasoles/issues/147) | CLOSED / completed por aceptación | salida release 4.1.2 probada vía workflows; verificaciones físicas parciales conservadas |
| [#162 seguimiento residual](https://github.com/Berserky/Galaxia-de-girasoles/issues/162) | OPEN, **NO BLOQUEA V5-P0** | timeouts si reaparecen, FCM replay/retry/cambio de identidad, GPS real y autonomía, QA aislado; no reiterar sin causa |

La aprobación del propietario del producto permite cerrar la gestión del release viejo; no significa convertir en PASS los escenarios físicos no ejecutados. No ejecutar una batería completa previa otra vez por cambios meramente visuales.

## 3. Reconciliación Git efectuada

- [PR #159](https://github.com/Berserky/Galaxia-de-girasoles/pull/159) integró el diseño y 260 VE documentados, resultado `desarrollo@c9d36707`.
- [PR #161](https://github.com/Berserky/Galaxia-de-girasoles/pull/161) fusionó el **historial estable 4.1.2** a `desarrollo` con merge no forzado, SHA `d4eba8a1356c2a5e98ed5d2e40251f7903f668bd`.
- Comparación verificada `prod...desarrollo`: **ahead=2, behind=0**, diferencias de archivos **exclusivamente 11 Markdown** (catálogo visual y AGENTS). Código Android/Edge/CI idéntico al estable; documentación permanece. No sincronizar `prod` hacia adelante con documentos de V5.
- Este cierre se desarrolla en otra rama de docs desde `desarrollo`, mediante PR separado; tras fusionarla verificar de nuevo ahead/behind y diff. No modificar QA/prod.

## 4. Dependabot y gobernanza

- **7 PR antiguos cerrados sin merge**: #75, #77, #78, #79, #80, #81, #82, con nota individual de incompatibilidad o postergación. #76 ya reemplazado por #115 previamente. No se actualizaron dependencias.
- Revisión aplazada dentro de [#163](https://github.com/Berserky/Galaxia-de-girasoles/issues/163). `androidx.core` 1.19.1 exige compileSdk37 y AGP 9.4.1 exige Gradle>=9.6; no introducir toolchain nuevo mientras diseñamos UI.
- Higiene de ~50 ramas y refuerzo de reglas en [#164](https://github.com/Berserky/Galaxia-de-girasoles/issues/164), no bloqueante para P0. GitHub tiene reglas activas de no borrar/no forzar en ramas permanentes y PR en desarrollo; faltan protecciones de checks/aprobaciones formalmente exigidas para QA/prod. No se modificaron reglas ni se borraron ramas en esta sesión: el conector usado no ofrece una acción aprobada de eliminación/configuración de rulesets. Auditar contenido e historial antes de borrar cualquier rama de squash.
- Default branch `prod`, `main` histórica conservada por instrucciones de gobernanza.

## 5. Listo para comenzar V5-P0, no para publicar V5

**GO a ingeniería Visual Evolution 5.0 desde `desarrollo` sincronizado**, con estas reglas:
1. Abrir rama nueva desde último `desarrollo` y documentar SHA.
2. Ejecutar `npm test`, Gradle lint/unit/build y QA visual de referencia cuando el entorno esté disponible. Esas pruebas **no se ejecutaron durante este cierre de GitHub**.
3. Diseñar sistema Celestial y shell global (colores/temas, safe-area, densidad, tipografía, gestos, modales, motion/reduced-motion), luego cerrar fases visuales VE-001…260 de forma progresiva.
4. No modificar motor IA, lógica interna Galaxy Chat, backend, GPS/FCM, permisos ni producción sin justificación y aprobación independiente. Preservar verificaciones ya aprobadas.
5. Mantener #162/#163/#164 en backlog de mantenimiento. Gates de V5-P8/P9 y nueva promoción productiva serán **independientes**, no cubiertos por la publicación 4.1.2.

## 6. Reanudación

Consultar `docs/visual-evolution-5/README.md`, `HANDOFF.md`, `ROADMAP.md`, los seis catálogos y [Issue #160](https://github.com/Berserky/Galaxia-de-girasoles/issues/160). **Siguiente tarea: ejecutar V5-P0**. Ninguna feature de V5 está implementada todavía.
