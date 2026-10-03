# Galaxy Insights Engine — diseño Mega Update 3.0

Fecha: 2026-10-03  
Rama objetivo: `aegiron/mega-update-3.0`  
Base: `main@6a3b6ce` (Android 2.2.2)

## 1. Objetivo

Construir una única capa reutilizable de estadísticas e historia de pareja que produzca insights para semana, mes, año, aniversario y rangos personalizados. Los datos existentes siguen siendo la fuente de verdad; Insights no debe crear registros derivados permanentes salvo que una necesidad de rendimiento posterior lo justifique.

El motor debe servir también como contrato estable para Galaxy Date, Bond, Context e Intelligence sin duplicar consultas ni lógica temporal.

## 2. Estado actual auditado

La producción 2.2.2 ya dispone de:

- `monthlySummary` en `supabase/functions/android-companion/index.ts`, que consulta items, viajes, encuentros, daily y bond.
- `monthly.js` con navegación y helpers de mes.
- `today-history.js` para “Un día como hoy”.
- `encounters.js` y el endpoint de estadísticas de encuentros.
- `galaxy_trip_history`, `galaxy_location_history`, `galaxy_place_events`, `galaxy_places` y `galaxy_encounters`.
- `galaxy_daily` con mood y respuesta por persona.
- `galaxy_bond` y `galaxy_bond_participation`.
- `galaxy_items` para memory, song, event, plan, note, capsule, wish y journey.
- `galaxy_settings.data.startDate` como fecha de inicio configurable.
- UI Android local con tema semántico, Lucide, reduced-motion y modal de resumen mensual.
- QA de contratos que hoy exige `monthly-summary`, `today-history` y estadísticas de encuentros.

El resumen mensual actual hace parte del trabajo requerido, pero la lógica está embebida en un endpoint específico de mes y no puede reutilizarse limpiamente para semana, año o aniversario.

## 3. Alternativas consideradas

### A. Clonar el resumen mensual por periodo
Crear `weekly-summary`, `annual-summary` y `anniversary-summary` independientes.

**Rechazada:** duplicaría consultas, filtros y métricas; produciría diferencias sutiles entre periodos y aumentaría el costo de mantenimiento.

### B. Motor de rango común + adaptadores por experiencia
Crear helpers puros de rango/fecha y un agregador backend común. Semana, mes, año y aniversario solo calculan sus límites y presentan el mismo contrato enriquecido.

**Elegida:** coincide con el requerimiento explícito del Mega Update 3.0, conserva las fuentes actuales y permite reutilización por futuros Galaxy.

### C. Materializaciones/cache en PostgreSQL
Precalcular estadísticas por día/semana/mes.

**Diferida:** el universo actual es pequeño (dos usuarios) y el costo de complejidad no está justificado todavía. Se mantendrá una frontera que permita introducir cache/materializaciones después sin cambiar los consumidores.

## 4. Arquitectura elegida

### 4.1. Capa temporal pura

Nuevo módulo JS compartible conceptualmente como `insights-period.js` con funciones puras:

- validar día/mes/año;
- obtener día Bogotá;
- rango semanal ISO lunes-domingo;
- rango mensual;
- rango anual;
- rango de aniversario;
- rango personalizado;
- desplazar periodo anterior/siguiente;
- etiquetas humanas;
- recortar intervalos abiertos al rango;
- comparar periodos;
- calcular reloj de relación.

Todas las decisiones de calendario usan `America/Bogota`.

### 4.2. Agregador backend común

Extraer de `monthlySummary` un agregador central:

`aggregateInsights({start,end,startDay,endDay,kind,now})`

Este agregador consultará/recibirá:

- items;
- viajes;
- encuentros;
- daily;
- bond;
- participación;
- lugares/eventos de lugar;
- metadatos multimedia disponibles de forma segura.

El resultado común deberá incluir, como mínimo:

```text
period
counts
trips
encounters
places
connection
moods
questions
bond
highlights
photos
achievements
comparison
```

No expondrá coordenadas exactas en respuestas de Insights si no son necesarias.

### 4.3. Endpoint reusable

Introducir una acción general, por ejemplo `insights-summary`, con tipos soportados:

- `week`
- `month`
- `year`
- `anniversary`
- `range`

Los endpoints/acciones existentes `monthly-summary` y consumidores antiguos se mantendrán compatibles durante 3.0 y se implementarán como adaptadores hacia el motor común cuando sea viable.

## 5. Métricas y semántica

### 5.1. Contenido

Para cada rango:

- recuerdos;
- planes completados;
- eventos;
- canciones;
- notas;
- viajes guardados;
- deseos completados;
- total de items relevantes;
- highlights ordenados de forma determinística.

Un item con `data.date` usa esa fecha. Si no existe, usa `created` convertido a Bogotá. `unlockDate` solo se usa cuando semánticamente representa la fecha visible del item, respetando privacidad de sorpresas.

### 5.2. Viajes

- cantidad;
- distancia total;
- distancia por persona;
- duración acumulada cuando esté disponible;
- recorridos destacados.

No sumar dos veces un mismo trayecto por reutilización de fuentes.

### 5.3. Encuentros

- cantidad;
- segundos juntos;
- encuentro activo recortado a `now` y al rango;
- promedio/longest solo cuando el dato sea suficientemente fiable.

Los encuentros abiertos no pueden extenderse fuera del rango solicitado.

### 5.4. Lugares

Derivar visitas de `galaxy_place_events` y relacionarlas con `galaxy_places`.

Mostrar nombres y conteos, no coordenadas exactas dentro de Insights.

### 5.5. Moods y preguntas

Por día y persona:

- días con mood;
- días en que ambos registraron mood;
- distribución por mood;
- coincidencia exacta;
- coincidencia por categorías compatibles configurables;
- días con respuesta de ambos;
- preguntas respondidas en el periodo.

Las tendencias son descriptivas. Quedan prohibidas inferencias clínicas, diagnósticos o lenguaje psicológico concluyente.

### 5.6. Bond

- gestos;
- mensajes de voz;
- participación conjunta;
- días de participación de ambos.

## 6. Nuestra Semana

Vista navegable por semanas ISO (lunes-domingo), sin permitir semanas futuras.

Debe mostrar:

- encuentros y tiempo juntos;
- km/recorridos;
- lugares;
- recuerdos;
- fotos candidatas relacionadas;
- moods y coincidencias;
- preguntas;
- canciones;
- gestos;
- eventos importantes.

Navegación anterior/siguiente reutiliza helpers puros y cache en memoria de UI por periodo, no persistencia nueva.

## 7. Nuestro Mes

La experiencia existente se conserva visualmente, pero consume el motor común.

Agregar comparación con el mes anterior cuando ambos periodos tengan datos suficientes, usando frases neutrales como:

- “Guardaron más recuerdos que el mes anterior.”
- “Tuvieron más días con mood registrado.”
- “Recorrieron menos kilómetros.”

No presentar cambios como positivos/negativos en términos emocionales.

## 8. Nuestro Año / Galaxia Wrapped

Resumen anual calculado sobre el mismo motor.

Debe incluir:

- totales anuales;
- agrupación mensual;
- mes(es) con mayor actividad por métricas explícitas;
- recuerdos destacados;
- km;
- tiempo juntos;
- lugares;
- viajes;
- canciones;
- moods;
- gestos;
- preguntas;
- hitos si existe esa información en futuras fases.

La UI será una secuencia de tarjetas animadas con reduced-motion. El DOM y layout deben quedar preparados para futura captura/exportación como imagen, sin implementar exportación en este Galaxy.

## 9. Aniversario

Usar `settings.data.startDate` como fuente.

El aniversario mensual se detecta por el día del mes de `startDate`. Si el día no existe en el mes actual, se usa el último día válido de ese mes.

La experiencia resume el periodo mensual inmediatamente anterior hasta el aniversario actual, sin crear registros derivados permanentes.

Si `startDate` está vacío, la experiencia no aparece.

## 10. Reloj de nosotros

Cálculo puro desde `startDate` hasta el momento actual de Bogotá:

- años completos;
- meses restantes;
- días restantes;
- total de días;
- horas totales opcionales.

Debe evitar aproximaciones de “mes = 30 días”. El desglose usa calendario real.

## 11. Calendario emocional

Vista mensual con:

- fila/persona o selector por persona;
- vista conjunta;
- color/estado basado en tokens semánticos existentes;
- leyenda accesible no dependiente exclusivamente del color;
- días sin registro claramente diferenciados.

No se agregará ninguna puntuación de “salud de la relación”.

## 12. Tendencias y coincidencia emocional

Coincidencia exacta: mismo mood registrado por ambos el mismo día.

Compatibilidad: mapa explícito y determinístico entre moods actuales; nunca inferido por IA.

Tendencias comparan conteos/proporciones entre periodos equivalentes y solo se muestran si hay un mínimo de datos que evite frases engañosas.

## 13. Logros e insignias

Motor derivado y extensible. Un catálogo declarativo define:

- id estable;
- título;
- descripción;
- icono Lucide;
- métrica;
- umbral;
- nivel;
- estado desbloqueado;
- fecha de desbloqueo si puede inferirse de los eventos fuente.

Primera colección:

- 10/25/50/100 recuerdos;
- 10/50/100 encuentros;
- 100/500/1000 km;
- primer viaje;
- aniversarios;
- participación conjunta.

Las rachas quedan como proveedor futuro del mismo catálogo cuando Galaxy Bond Engine 2.0 las implemente.

No crear una tabla de logros en esta fase: se derivan desde fuentes existentes. Persistencia futura solo si se necesita preservar fecha exacta de desbloqueo no reconstruible.

## 14. Fotos relacionadas

Insights no debe inventar asociación geográfica que todavía no existe.

En esta fase:

- usar fecha/importación/contexto disponible;
- si una foto no tiene fecha/contexto suficiente, no atribuirla a una semana/cita/lugar;
- devolver candidatos de forma segura cuando exista relación temporal explícita.

Galaxy Context/Drive 2.0 podrán enriquecer esta relación más adelante sin cambiar el contrato base.

## 15. Comparaciones

El motor puede recibir un rango anterior equivalente.

Las comparaciones devuelven deltas numéricos y una capa UI los traduce en frases.

No comparar periodos parciales contra periodos completos sin marcarlo; para el periodo actual, el rango anterior se recorta a una duración equivalente cuando la comparación pueda inducir a error.

## 16. UI

Mantener:

- navegación actual;
- tokens semánticos;
- Lucide;
- tamaños táctiles existentes;
- responsive;
- accesibilidad;
- `prefers-reduced-motion`;
- ausencia de emojis como iconos de interfaz.

Nuevas superficies:

- teaser “Nuestra Semana”;
- “Nuestro Mes” evolucionado;
- entrada “Nuestro Año”;
- banner/experiencia de aniversario solo cuando aplique;
- reloj;
- heatmap emocional;
- sección de logros.

Se reutilizarán patrones de modal/tarjetas existentes antes de introducir navegación nueva.

## 17. Rendimiento

Primera implementación sin materializaciones.

Medidas:

- consultas limitadas al rango cuando la tabla lo permite;
- evitar traer miles de filas globales y filtrar en cliente;
- `Promise.all` para fuentes independientes;
- índices existentes aprovechados;
- añadir índices únicamente si una consulta nueva demostrablemente los necesita;
- cache efímero por periodo en UI.

Si el Wrapped anual requiere consultas mayores, el backend agrega en una sola llamada; la UI nunca debe realizar doce llamadas mensuales para construir el año.

## 18. Privacidad y seguridad

- Toda acción de Insights exige dispositivo válido.
- Mantener reglas actuales de contenido bloqueado/sorpresa.
- No filtrar respuestas privadas antes de que sean visibles según las reglas existentes.
- No devolver coordenadas GPS crudas para tarjetas de estadísticas.
- No introducir IA.
- No crear analytics externos de moods o relación.

## 19. Compatibilidad

Durante Mega Update 3.0:

- `monthly-summary` sigue funcionando.
- `today-history` sigue funcionando.
- `encounter-stats` sigue funcionando.
- UI anterior no debe romperse si una sección de Insights falla.
- Ninguna migración destructiva.
- No cambiar package id, firma, updater ni versión estable de producción.

## 20. QA requerido

Pruebas puras:

- semana que cruza mes;
- semana que cruza año;
- diciembre → enero;
- febrero/bisiesto;
- periodos vacíos;
- fechas Bogotá alrededor de UTC midnight;
- reloj con calendarios reales;
- aniversario día 29/30/31;
- encuentros cerrados;
- encuentro abierto;
- viajes;
- moods incompletos;
- coincidencias;
- comparación de periodos;
- logros por umbral.

Contratos Android/API:

- acción `insights-summary`;
- compatibilidad `monthly-summary`;
- UI de semana/mes/año;
- reduced-motion;
- Lucide;
- tema;
- privacidad.

Suite completa existente:

- Node tests;
- QA móvil;
- JUnit;
- Android Lint/build cuando el entorno CI lo ejecute.

## 21. Criterios de aceptación

Galaxy Insights Engine queda terminado cuando:

1. semana, mes, año y aniversario usan el mismo motor de rango;
2. no existe lógica estadística duplicada relevante entre esas experiencias;
3. el resumen mensual existente conserva compatibilidad;
4. Wrapped anual se resuelve con una llamada agregada, no 12 llamadas mensuales;
5. moods/tendencias son estrictamente descriptivos;
6. logros se derivan desde fuentes actuales;
7. reloj y rangos respetan Bogotá;
8. QA cubre fronteras temporales y privacidad;
9. no se despliega ni se mezcla a `main`;
10. el contrato queda disponible para los Galaxy siguientes.
