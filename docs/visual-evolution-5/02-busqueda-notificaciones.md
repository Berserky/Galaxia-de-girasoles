# Visual Evolution 5.0 — Buscador y centro de notificaciones

> Fuente: auditoría de capturas de pantalla (12 octubre 2026). **No son defectos funcionales comprobados.** Rama estable de referencia: `prod@fde141d4c8e7622ac1d6f10f1abbfbda8e8e7d0c`. Fase sugerida: V5-P1 — Componentes globales; V5-P3 — Búsqueda y avisos. Cada ID es permanente, aunque cambien prioridad o solución. IA como módulo queda fuera del alcance.

## Hallazgos VE-035–VE-60

- [ ] **VE-035** · **Alta** · Modal de búsqueda y teclado compiten por espacio: viewport adaptable. **Estado:** propuesta visual pendiente.
- [ ] **VE-036** · **Media** · Campo de búsqueda con contornos superpuestos: un solo anillo de foco. **Estado:** propuesta visual pendiente.
- [ ] **VE-037** · **Alta** · Resultados exactos y semánticos mezclados: grupos diferenciados. **Estado:** propuesta visual pendiente.
- [ ] **VE-038** · **Media** · Explicación semántica demasiado técnica: lenguaje natural. **Estado:** propuesta visual pendiente.
- [ ] **VE-039** · **Alta** · Relevancia de sugerencias no evidente: futuro diagnóstico de coincidencias, sin tocar motor IA. **Estado:** propuesta visual pendiente.
- [ ] **VE-040** · **Alta** · Resultados heterogéneos con tarjetas idénticas: identificadores por tipo. **Estado:** propuesta visual pendiente.
- [ ] **VE-041** · **Media** · Estrellas repetidas como icono de sugerencia: categoría primero e IA secundaria. **Estado:** propuesta visual pendiente.
- [ ] **VE-042** · **Alta** · Fragmentos truncados: preview legible y detalle expandible. **Estado:** propuesta visual pendiente.
- [ ] **VE-043** · **Media** · Resultados sin fecha/origen/categoría: metadatos disponibles. **Estado:** propuesta visual pendiente.
- [ ] **VE-044** · **Alta** · Teclado oculta resultados: desplazamiento y safe area independientes. **Estado:** propuesta visual pendiente.
- [ ] **VE-045** · **Alta** · Estados de búsqueda sin resultados/cargando/offline: sistema de estados. **Estado:** propuesta visual pendiente.
- [ ] **VE-046** · **Media** · Modal de búsqueda sin continuidad: transiciones medidas y regreso contextual. **Estado:** propuesta visual pendiente.
- [ ] **VE-047** · **Media** · Modal de notificaciones poco aprovechado: altura y ubicación adaptativas. **Estado:** propuesta visual pendiente.
- [ ] **VE-048** · **Alta** · Lista de avisos cortada al pie: scroll e insets seguros. **Estado:** propuesta visual pendiente.
- [ ] **VE-049** · **Alta** · Notificaciones tituladas solo Adriana: título según evento. **Estado:** propuesta visual pendiente.
- [ ] **VE-050** · **Alta** · Avisos de chat repetitivos: agrupar por conversación y tiempo. **Estado:** propuesta visual pendiente.
- [ ] **VE-051** · **Alta** · No leídos poco claros: indicador y estado inequívocos. **Estado:** propuesta visual pendiente.
- [ ] **VE-052** · **Media** · Marcar todas ambiguo: renombrar a Marcar todas como leídas. **Estado:** propuesta visual pendiente.
- [ ] **VE-053** · **Media** · Fecha y hora demasiado pequeñas: mejorar contraste. **Estado:** propuesta visual pendiente.
- [ ] **VE-054** · **Media** · Iconos de eventos homogéneos: categorías reconocibles. **Estado:** propuesta visual pendiente.
- [ ] **VE-055** · **Alta** · Previews truncados: lectura suficiente y expandir detalle. **Estado:** propuesta visual pendiente.
- [ ] **VE-056** · **Alta** · Están cerca en evento pasado: señalizar acontecimiento histórico. **Estado:** propuesta visual pendiente.
- [ ] **VE-057** · **Media** · Ausencia de filtros: Todas/Sin leer/Chat/Actividades. **Estado:** propuesta visual pendiente.
- [ ] **VE-058** · **Media** · Vacíos/carga/errores/actualización no visibles: estados completos. **Estado:** propuesta visual pendiente.
- [ ] **VE-059** · **Alta** · Accesibilidad en búsqueda y avisos: targets, contraste, fuentes. **Estado:** propuesta visual pendiente.
- [ ] **VE-060** · **Alta** · Sistema global de modales: teclado, scroll, blur, cierre e insets. **Estado:** propuesta visual pendiente.

## Regla de cierre

Cada VE necesita dueño/PR, archivos afectados, evidencia de antes/después, estados normal/carga/error/vacío si corresponden, contraste, pantallas estrechas, pruebas de navegación y regresión. No marcar una casilla por escribir CSS: solo con verificación reproducible.
