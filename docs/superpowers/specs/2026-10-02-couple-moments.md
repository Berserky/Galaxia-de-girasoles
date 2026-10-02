# Momentos para dos — diseño 1.3.0

Solicitud: desarrollar las ocho propuestas aprobadas. El usuario delega criterio completo; se continúa sin nuevas aprobaciones de diseño.

Inicio: gestos abrazo/beso/te extraño y girasol persistente. Conectar: juego de conocerse con respuestas ocultas hasta adivinar, ritual semanal de tres preguntas, notas colaborativas con control de versiones, grabación o subida de audios cortos con dedicatoria y referencia opcional a recuerdo/canción/cápsula. Planes: citas filtradas por minutos, presupuesto COP y casa/salir, guardar como plan existente. Android: widget con foto opcional elegida del álbum, próxima fecha, enviar abrazo; notificaciones discretas mediante trabajo periódico autorizado por vinculación. No prometer entrega instantánea en segundo plano; Android puede diferir trabajo.

Datos nuevos separados de los items existentes. API común local/cloud:
GET /api/bond -> {entries:[{id,type,author,version,created,data}],garden:{days,stage},widget:{photoPath}}
POST /api/bond body {type,data}. Tipos: gesture data:{gesture:'hug'|'kiss'|'miss'}; game:{questionId,answer:string}; ritual:{week:'YYYY-MM-DD' (lunes),gratitude,need,plan}; sharednote:{title,body}; voice:{title,body,audioPath,mime,referenceId?}.
PUT /api/bond/:id body {version,data} para nota compartida/ritual propio. DELETE /api/bond/:id body {version} (nota ambos, otros autor). POST /api/bond/:id/guess body {guess:string}; solo pareja, un intento; agrega data.guess, data.correct y revela answer. GET no filtra solo en UI: servidor/RPC oculta answer de game ajeno sin guess.
POST /api/bond/audio body Blob + Content-Type + X-File-Name -> {path,url,mime}. GET /api/bond/audio/:path -> {url} local media privado/cloud URL firmada; límites 5 MB, audio webm/ogg/mp4/mpeg comprobado por firma. POST /api/bond/widget body {photoPath:string} ruta foto álbum, vacía para quitar. RPC autenticados galaxy_bond_read(), galaxy_bond_save(entry_type,payload), galaxy_bond_update(entry_id,expected_version,payload), galaxy_bond_guess(entry_id,guess_value), galaxy_bond_delete(entry_id,expected_version), galaxy_bond_widget(photo_path).

Frontend bond-domain.js: catálogo export gameQuestions:[{id,question,options:string[]}], gestures, dateIdeas:[{id,title,body,minutes,budget,where}], weekStart(date), pickDate({minutes,budget,where},random), gardenProgress(days). Module compartido navegador/servidor y SQL preguntas/opciones coincidentes. Backend genera garden contando fechas Bogotá con participación de ambos en items/daily/bond, sin rachas ni pérdidas. Girasol visual accesible, reduce-motion, sin puntuación competitiva.

Android usa edge existente action:'moments' -> {names:string[],nextEvent:{title,date}|null,photoUrl:string|null,gestures:[{id,gesture,created,author}]}, action:'gesture',gesture:'hug'|'kiss'|'miss' -> {ok:true}; device token existente, revocación aplica a ambas. moments solo últimos 7 días/30 gestos destinados al otro; usa tabla gallery bond y config. Widget imágenes firmadas solo descargadas por Android, caché app-private borrado si token inválido/desvincular. Worker periódico 15 min sin GPS, opt-in notificaciones via OS; no secretos en intents ni logs. Gestos enviados son datos de app solo para la pareja.

Privacidad: tablas nuevas RLS, anon sin acceso, RPC definer con search_path fijo y galaxy_person no nulo. Audios bucket privado. Export incluye bond. No alterar auth/ubicación existente ni borrar datos. Version 1.3.0 code4.

Validación: domain filtros límites y semana; API dos perfiles para ocultación/concurrencia/persistencia/audio; SQL anónimo/ajeno/guess; build Pages incluye módulos; QA Android worker/widget + compile; navegador 320/390/desktop interacción real. No presentar GPS/entrega física como probados.
