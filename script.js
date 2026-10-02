// Una sola escena activa: redimensionar nunca reinicia el regalo.
const $ = id => document.getElementById(id);
const canvas = $('universo');
let ctx = canvas.getContext('2d');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const descubiertas = new Set();
const posiciones = [[.19,.20],[.77,.13],[.49,.43],[.21,.68],[.79,.66],[.50,.88]];
let escena = 'inicio', finalVisto = false, flores = [], estrellas = [];
let ancho = 0, alto = 0, frame = 0, inicioFinal = 0, origenFlor = null;
const audio = $('musicaFondo');
audio.volume = .38;
const ctxUniverso = ctx;
ctx = $('florPortada').getContext('2d');
dibujarGirasol(170,170,102,-.12);
ctx = ctxUniverso;

function ajustar() {
    ancho = window.innerWidth;
    alto = Math.max(window.innerHeight, 660);
    document.querySelector('.pie-galaxia').style.top = `${alto-32}px`;
    $('volverCarta').style.top = `${alto-85}px`;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(ancho*dpr);
    canvas.height = Math.round(alto*dpr);
    canvas.style.height = `${alto}px`;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    estrellas = Array.from({length:110}, () => ({x:Math.random(),y:Math.random(),fase:Math.random()*6.28,radio:.4+Math.random()*1.2}));
    colocarFlores();
    dibujar(performance.now());
}
function colocarFlores() {
    const top = Math.max(document.querySelector('.galaxia-ui').offsetTop + document.querySelector('.galaxia-ui').offsetHeight + 32, alto*.31);
    const espacio = Math.max(80, alto-top-(finalVisto ? 160 : 95));
    flores = escena === 'especial' ? [{x:ancho/2,y:top+espacio*.45,tamaño:53,index:-1}] : posiciones.map(([x,y],index) => ({x:ancho*x,y:top+espacio*y,tamaño:[29,25,37,26,31,25][index],index}));
    $('floresAccesibles').replaceChildren();
    if (!['galaxia','especial'].includes(escena)) return;
    flores.forEach(flor => {
        const boton = document.createElement('button');
        boton.className = 'flor-interactiva';
        boton.style.left = `${flor.x}px`;
        boton.style.top = `${flor.y}px`;
        boton.style.width = boton.style.height = `${Math.max(60,flor.tamaño*2.7)}px`;
        boton.dataset.index = flor.index;
        boton.setAttribute('aria-label',flor.index<0 ? 'Abrir la carta para Adri' : `Girasol ${flor.index+1}: ${mensajes[flor.index].titulo}`);
        if (flor.index>=0) boton.setAttribute('aria-pressed',String(descubiertas.has(flor.index)));
        const etiqueta = document.createElement('span');
        etiqueta.className = 'etiqueta-flor';
        etiqueta.textContent = flor.index<0 ? 'Para ti, Adri' : String(flor.index+1).padStart(2,'0') + (descubiertas.has(flor.index) ? ' · ♡' : '');
        boton.append(etiqueta);
        boton.addEventListener('click',() => flor.index<0 ? abrirFinal() : abrirRecuerdo(flor.index,boton));
        $('floresAccesibles').append(boton);
    });
}
function progreso() {
    $('contadorFlores').textContent = descubiertas.size;
    $('progresoPuntos').replaceChildren(...mensajes.map((_,i) => {
        const punto = document.createElement('span');
        punto.className = descubiertas.has(i) ? 'descubierto' : '';
        return punto;
    }));
}
function abrirRecuerdo(index,boton) {
    origenFlor = boton;
    descubiertas.add(index);
    boton.setAttribute('aria-pressed','true');
    boton.querySelector('span').textContent = `${String(index+1).padStart(2,'0')} · ♡`;
    document.querySelector('.mensaje-pequeno').textContent = `RECUERDO ${String(index+1).padStart(2,'0')} DE 06`;
    $('tituloFlor').textContent = mensajes[index].titulo;
    $('textoFlor').textContent = mensajes[index].texto;
    $('cerrarMensaje').textContent = descubiertas.size===mensajes.length && !finalVisto ? 'Descubrir la última flor ↗' : 'Seguir explorando ✦';
    progreso();
    $('mensajeFlor').showModal();
    dibujar(performance.now());
}
$('cerrarMensaje').addEventListener('click',() => $('mensajeFlor').close());
$('mensajeFlor').addEventListener('close',() => {
    if (descubiertas.size===mensajes.length && !finalVisto) $('desbloqueoFinal').showModal();
    else if (origenFlor?.isConnected) origenFlor.focus();
    else document.querySelector('.flor-interactiva')?.focus();
});
$('desbloqueoFinal').addEventListener('cancel',event => { event.preventDefault(); mostrarEspecial(); });
$('btnFlorFinal').addEventListener('click',mostrarEspecial);
function mostrarEspecial() {
    $('desbloqueoFinal').close();
    escena = 'especial';
    document.querySelector('.galaxia-texto').textContent = 'Y al final de este pequeño universo…';
    document.querySelector('.galaxia-ui h2').innerHTML = 'siempre estabas<br><span>tú.</span>';
    document.querySelector('.instruccion').textContent = 'Hay una última flor esperando por ti.';
    $('progresoFlores').classList.add('oculto');
    $('progresoPuntos').classList.add('oculto');
    colocarFlores();
    document.querySelector('.flor-interactiva').focus();
    dibujar(performance.now());
}
function abrirFinal() {
    escena = 'final';
    inicioFinal = performance.now();
    $('floresAccesibles').replaceChildren();
    document.querySelector('.galaxia-ui').style.opacity = '0';
    if (motion.matches) mostrarCarta();
    else iniciarAnimacion();
}
function mostrarCarta() {
    escena = 'carta'; finalVisto = true;
    detenerAnimacion();
    $('galaxia').classList.add('oculto');
    $('cartaFinal').classList.remove('oculto');
    $('cartaFinal').scrollTop = 0;
    $('tituloCarta').focus({preventScroll:true});
    $('petalos').replaceChildren();
    if (!motion.matches) for (let i=0;i<12;i++) {
        const petalo = document.createElement('i');
        petalo.className = 'petalo';
        petalo.style.cssText = `left:${Math.random()*100}%;animation-delay:${-Math.random()*12}s;animation-duration:${9+Math.random()*7}s`;
        $('petalos').append(petalo);
    }
}
$('btnEntrar').addEventListener('click',() => {
    escena = 'galaxia';
    $('inicio').classList.add('oculto');
    $('galaxia').classList.remove('oculto');
    $('controlMusica').classList.remove('oculto');
    if ($('conMusica').checked) reproducir(); else actualizarMusica();
    ajustar(); iniciarAnimacion();
    document.querySelector('.flor-interactiva').focus({preventScroll:true});
});
$('volverGalaxia').addEventListener('click',() => {
    escena = 'galaxia';
    $('cartaFinal').classList.add('oculto'); $('petalos').replaceChildren();
    $('galaxia').classList.remove('oculto');
    document.querySelector('.galaxia-ui').style.opacity = '1';
    document.querySelector('.galaxia-texto').textContent = 'Hay recuerdos a los que siempre se puede volver.';
    document.querySelector('.galaxia-ui h2').innerHTML = 'Nuestra pequeña<br><span>constelación.</span>';
    document.querySelector('.instruccion').textContent = 'Vuelve a abrir cualquiera de nuestros recuerdos.';
    $('progresoFlores').classList.remove('oculto'); $('progresoPuntos').classList.remove('oculto');
    $('volverCarta').classList.remove('oculto');
    ajustar(); iniciarAnimacion();
    document.querySelector('.flor-interactiva').focus({preventScroll:true});
});
const volverCarta = document.createElement('button');
volverCarta.id = 'volverCarta'; volverCarta.className = 'boton-secundario volver-carta oculto';
volverCarta.textContent = 'Leer tu carta ♡';
volverCarta.addEventListener('click',mostrarCarta); $('galaxia').append(volverCarta);
$('btnSecreto').addEventListener('click',() => $('mensajeSecreto').showModal());
$('cerrarSecreto').addEventListener('click',() => $('mensajeSecreto').close());
// Cada diálogo tiene una sola acción; Tab permanece dentro del mensaje.
document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('keydown',event => {
        if (event.key === 'Tab') {
            event.preventDefault();
            dialog.querySelector('button').focus();
        }
    });
});
function dibujar(tiempo) {
    if (!['galaxia','especial','final'].includes(escena)) return;
    ctx.clearRect(0,0,ancho,alto);
    estrellas.forEach(e => {
        const alpha = motion.matches ? .5 : .4+Math.sin(tiempo*.0006+e.fase)*.3;
        ctx.fillStyle = `rgba(255,235,195,${alpha})`;
        ctx.beginPath(); ctx.arc(e.x*ancho,e.y*alto,e.radio,0,Math.PI*2); ctx.fill();
    });
    if (escena==='final') {
        const avance = Math.min(1,(tiempo-inicioFinal)/1800);
        const escala = Math.min(ancho*.022,alto*.025,13);
        ctx.fillStyle = '#f6d381'; ctx.shadowColor = '#ddb95a'; ctx.shadowBlur = 12;
        for (let i=0;i<120;i++) {
            const t = i/120*Math.PI*2;
            const x = 16*Math.pow(Math.sin(t),3);
            const y = 13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);
            ctx.beginPath(); ctx.arc(ancho/2+x*escala*avance,alto*.43-y*escala*avance,1.5,0,Math.PI*2); ctx.fill();
        }
        ctx.shadowBlur = 0; ctx.textAlign = 'center'; ctx.font = 'italic 30px Georgia';
        ctx.fillText('Para ti, Adri.',ancho/2,alto*.76);
        if (tiempo-inicioFinal>3400) mostrarCarta();
        return;
    }
    ctx.strokeStyle = 'rgba(238,201,125,.25)'; ctx.lineWidth = 1; ctx.beginPath();
    flores.filter(f=>descubiertas.has(f.index)).forEach((f,i)=> i ? ctx.lineTo(f.x,f.y) : ctx.moveTo(f.x,f.y));
    ctx.stroke();
    flores.forEach(f => {
        dibujarGirasol(f.x,f.y,f.tamaño,motion.matches ? -.12 : Math.sin(tiempo*.0002+f.index)*.12);
        if (descubiertas.has(f.index)) {
            ctx.strokeStyle = 'rgba(250,216,139,.45)';
            ctx.beginPath(); ctx.arc(f.x,f.y,f.tamaño*1.35,0,Math.PI*2); ctx.stroke();
        }
    });
}
function animar(t) {
    frame = 0; dibujar(t);
    if (!document.hidden && ['galaxia','especial','final'].includes(escena) && !motion.matches) frame = requestAnimationFrame(animar);
}
function iniciarAnimacion() {
    if (!frame && !document.hidden && !motion.matches && ['galaxia','especial','final'].includes(escena)) frame = requestAnimationFrame(animar);
}
function detenerAnimacion() { cancelAnimationFrame(frame); frame = 0; }
document.addEventListener('visibilitychange',()=>document.hidden ? detenerAnimacion() : iniciarAnimacion());
motion.addEventListener('change',()=> {
    detenerAnimacion();
    if (escena==='final') mostrarCarta(); else { dibujar(performance.now()); iniciarAnimacion(); }
    if (motion.matches) $('petalos').replaceChildren();
});
window.addEventListener('resize',ajustar);
async function reproducir() {
    try { await audio.play(); } catch { /* Puede continuar sin sonido y reintentar. */ }
    actualizarMusica();
}
function actualizarMusica() {
    const sonando = !audio.paused;
    $('controlMusica').textContent = sonando ? 'Ⅱ Música' : '♫ Música';
    $('controlMusica').setAttribute('aria-label',sonando ? 'Pausar música' : 'Reproducir música');
    $('controlMusica').setAttribute('aria-pressed',String(sonando));
}
$('controlMusica').addEventListener('click',()=>audio.paused ? reproducir() : audio.pause());
audio.addEventListener('play',actualizarMusica); audio.addEventListener('pause',actualizarMusica);
audio.addEventListener('error',()=> {
    $('controlMusica').textContent = '♫ No disponible';
    $('controlMusica').setAttribute('aria-label','Música no disponible; puedes continuar el regalo sin sonido');
});
progreso();
