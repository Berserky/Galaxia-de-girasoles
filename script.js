const inicio = document.getElementById("inicio");
const galaxia = document.getElementById("galaxia");
const btnEntrar = document.getElementById("btnEntrar");
const musicaFondo =
    document.getElementById("musicaFondo");

const controlMusica =
    document.getElementById("controlMusica");

let musicaSonando = false;
let fadeMusica = null;
const canvas = document.getElementById("universo");
const ctx = canvas.getContext("2d");

let estrellas = [];
let girasoles = [];
let animacionIniciada = false;

/* =========================
   ABRIR GALAXIA
========================= */

btnEntrar.addEventListener("click", () => {
iniciarMusica();
    inicio.style.opacity = "0";
    inicio.style.transition = "opacity 1.2s ease";

    setTimeout(() => {

        inicio.classList.add("oculto");
        galaxia.classList.remove("oculto");

        ajustarCanvas();
        crearUniverso();

        if (!animacionIniciada) {
            animacionIniciada = true;
            animar();
        }

    }, 1200);
});


/* =========================
   AJUSTAR CANVAS
========================= */

function ajustarCanvas() {

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

}

window.addEventListener("resize", () => {

    ajustarCanvas();
    crearUniverso();

});


/* =========================
   CREAR ESTRELLAS
========================= */

function crearUniverso() {

    estrellas = [];
    girasoles = [];

    const cantidadEstrellas = 150;

    for (let i = 0; i < cantidadEstrellas; i++) {

        estrellas.push({

            x: Math.random() * canvas.width,

            y: Math.random() * canvas.height,

            radio: Math.random() * 1.5 + 0.3,

            alpha: Math.random(),

            velocidad:
                Math.random() * 0.015 + 0.003,

            direccion:
                Math.random() > 0.5 ? 1 : -1

        });

    }

    crearGirasoles();
}


/* =========================
   CREAR GIRASOLES
========================= */

function crearGirasoles() {

    const posiciones = [

        {
            x: 0.18,
            y: 0.40,
            tamaño: 26
        },

        {
            x: 0.78,
            y: 0.36,
            tamaño: 20
        },

        {
            x: 0.50,
            y: 0.56,
            tamaño: 38
        },

        {
            x: 0.22,
            y: 0.72,
            tamaño: 22
        },

        {
            x: 0.82,
            y: 0.70,
            tamaño: 28
        },

        {
            x: 0.48,
            y: 0.84,
            tamaño: 20
        }

    ];

    posiciones.forEach((girasol, index) => {

        girasoles.push({

            x: canvas.width * girasol.x,

            y: canvas.height * girasol.y,

            tamaño: girasol.tamaño,

            angulo: Math.random() * Math.PI * 2,

            velocidad:
                0.003 + Math.random() * 0.003,

            fase:
                Math.random() * Math.PI * 2,

            index: index

        });

    });

}


/* =========================
   DIBUJAR ESTRELLAS
========================= */

function dibujarEstrellas() {

    estrellas.forEach(estrella => {

        estrella.alpha +=
            estrella.velocidad *
            estrella.direccion;

        if (estrella.alpha >= 1) {

            estrella.alpha = 1;
            estrella.direccion = -1;

        }

        if (estrella.alpha <= 0.15) {

            estrella.alpha = 0.15;
            estrella.direccion = 1;

        }

        ctx.beginPath();

        ctx.arc(
            estrella.x,
            estrella.y,
            estrella.radio,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            `rgba(255, 240, 190, ${estrella.alpha})`;

        ctx.fill();

    });

}


/* =========================
   DIBUJAR GIRASOL
========================= */

function dibujarGirasol(x, y, tamaño, rotacion) {

    ctx.save();

    ctx.translate(x, y);
    ctx.rotate(rotacion);

    /* RESPLANDOR */

    const brillo =
        ctx.createRadialGradient(
            0,
            0,
            0,
            0,
            0,
            tamaño * 1.8
        );

    brillo.addColorStop(
        0,
        "rgba(255,190,40,0.22)"
    );

    brillo.addColorStop(
        1,
        "rgba(255,190,40,0)"
    );

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        tamaño * 1.8,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = brillo;
    ctx.fill();


    /* PÉTALOS */

    const cantidadPetalos = 18;

    for (
        let i = 0;
        i < cantidadPetalos;
        i++
    ) {

        ctx.save();

        ctx.rotate(
            (Math.PI * 2 / cantidadPetalos) * i
        );

        ctx.beginPath();

        ctx.ellipse(
            0,
            -tamaño * 0.65,
            tamaño * 0.16,
            tamaño * 0.42,
            0,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#f6b91a";

        ctx.fill();

        ctx.restore();

    }


    /* SEGUNDA CAPA DE PÉTALOS */

    for (
        let i = 0;
        i < cantidadPetalos;
        i++
    ) {

        ctx.save();

        ctx.rotate(
            (Math.PI * 2 / cantidadPetalos) * i
            +
            Math.PI / cantidadPetalos
        );

        ctx.beginPath();

        ctx.ellipse(
            0,
            -tamaño * 0.52,
            tamaño * 0.13,
            tamaño * 0.32,
            0,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = "#ffd54f";

        ctx.fill();

        ctx.restore();

    }


    /* CENTRO */

    const centro =
        ctx.createRadialGradient(
            -tamaño * 0.1,
            -tamaño * 0.1,
            2,
            0,
            0,
            tamaño * 0.42
        );

    centro.addColorStop(
        0,
        "#8d5b22"
    );

    centro.addColorStop(
        0.55,
        "#513116"
    );

    centro.addColorStop(
        1,
        "#241207"
    );

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        tamaño * 0.38,
        0,
        Math.PI * 2
    );

    ctx.fillStyle = centro;

    ctx.fill();


    /* SEMILLITAS */

    for (let i = 0; i < 22; i++) {

        const angulo =
            i * 2.399;

        const distancia =
            Math.sqrt(i / 22)
            *
            tamaño
            *
            0.30;

        const sx =
            Math.cos(angulo)
            *
            distancia;

        const sy =
            Math.sin(angulo)
            *
            distancia;

        ctx.beginPath();

        ctx.arc(
            sx,
            sy,
            1,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "rgba(255,190,80,0.55)";

        ctx.fill();

    }

    ctx.restore();

}


/* =========================
   DIBUJAR GIRASOLES
========================= */

function dibujarGirasoles() {

    const tiempo =
        Date.now() * 0.001;

    girasoles.forEach(girasol => {

        girasol.angulo +=
            girasol.velocidad;

        const movimiento =
            Math.sin(
                tiempo +
                girasol.fase
            ) * 5;

        dibujarGirasol(
            girasol.x,
            girasol.y + movimiento,
            girasol.tamaño,
            girasol.angulo
        );

    });

}


/* =========================
   ANIMACIÓN PRINCIPAL
========================= */

function animar() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    dibujarEstrellas();

    dibujarGirasoles();


    /*
    Animación especial
    del final.
    */

    dibujarParticulasFinales();


    requestAnimationFrame(
        animar
    );

}

/* =========================
   MENSAJES SECRETOS
========================= */

const mensajeFlor =
    document.getElementById("mensajeFlor");

const tituloFlor =
    document.getElementById("tituloFlor");

const textoFlor =
    document.getElementById("textoFlor");

const numeroFlor =
    document.getElementById("numeroFlor");

const cerrarMensaje =
    document.getElementById("cerrarMensaje");


const mensajes = [

    {
        titulo: "Donde comenzó todo",
        texto:
            "Todavía me acuerdo de nuestra primera cita, pintando a Candelario y a Pocho. Dos perritos de cerámica que terminaron guardando el recuerdo del comienzo de algo que ninguno de los dos sabía hasta dónde nos iba a llevar."
    },

    {
        titulo: "Nuestra segunda cita",
        texto:
            "Después vino el estadio, el Inter de Bogotá y nuestra segunda cita. Y poco a poco empezamos a llenar nuestra historia de planes, lugares y momentos que ahora me encanta poder llamar nuestros."
    },

    {
        titulo: "Boyacá",
        texto:
            "Nuestro viaje a Boyacá, conocer a tus tías y compartir contigo fuera de nuestra rutina. Me gusta pensar en todos esos lugares que ahora significan un poquito más para mí simplemente porque estuve ahí contigo."
    },

    {
        titulo: "Nuestra primera noche",
        texto:
            "Y cómo olvidar nuestra primera noche juntos... especialmente porque casi logro espantarte con mis ronquidos. No fue precisamente mi momento más seductor, pero al menos sobreviviste para contarlo."
    },

    {
        titulo: "Útica",
        texto:
            "Contigo también descubrí algo importantísimo sobre mi futuro: cuando sea un viejito quiero estar pescando desde un puente con una rueda de nailon. Suena absurdo, pero ese recuerdo contigo me hace imaginar todos esos pequeños momentos que todavía quiero vivir."
    },

    {
        titulo: "Cuatro meses",
        texto:
            "Solo han pasado cuatro meses, Adri. Cuatro meses desde que empezamos esta historia y ya tenemos viajes, perritos de cerámica, estadios, noches juntos, aventuras y recuerdos que me hacen sonreír mientras escribo esto. Y todavía nos falta muchísimo."
    }

];

/* =========================
   PROGRESO DE FLORES
========================= */

const floresEncontradas =
    new Set();

const contadorFlores =
    document.getElementById(
        "contadorFlores"
    );

const desbloqueoFinal =
    document.getElementById(
        "desbloqueoFinal"
    );

const btnFlorFinal =
    document.getElementById(
        "btnFlorFinal"
    );

let finalDesbloqueado = false;


/* =========================
   DETECTAR TOQUE
========================= */

canvas.addEventListener(
    "pointerdown",
    detectarGirasol
);


function detectarGirasol(evento) {

    const rect =
        canvas.getBoundingClientRect();

    const escalaX =
        canvas.width /
        rect.width;

    const escalaY =
        canvas.height /
        rect.height;

    const x =
        (evento.clientX - rect.left)
        *
        escalaX;

    const y =
        (evento.clientY - rect.top)
        *
        escalaY;


    let florEncontrada = null;


    girasoles.forEach(
        girasol => {

            const distancia =
                Math.sqrt(
                    Math.pow(
                        x - girasol.x,
                        2
                    )
                    +
                    Math.pow(
                        y - girasol.y,
                        2
                    )
                );


            /*
            El área táctil es mayor
            que la flor visible para
            que sea cómodo en celular.
            */

            if (
                distancia <
                girasol.tamaño * 1.4
            ) {

                florEncontrada =
                    girasol;

            }

        }
    );


    if (florEncontrada) {

    /* Es el girasol final */
    if (florEncontrada.especial) {

        abrirFinal();

    } else {

        abrirMensaje(
            florEncontrada.index
        );

    }

    }

}


/* =========================
   ABRIR MENSAJE
========================= */

function abrirMensaje(index) {

    const mensaje =
        mensajes[index];


    /* Registrar flor */

    if (!floresEncontradas.has(index)) {

        floresEncontradas.add(index);

        contadorFlores.textContent =
            floresEncontradas.size;
    }


    /* Mostrar mensaje */

    numeroFlor.textContent =
        "🌻";

    tituloFlor.textContent =
        mensaje.titulo;

    textoFlor.textContent =
        mensaje.texto;

    mensajeFlor.classList.remove(
        "oculto"
    );


    /* Revisar si encontró las 6 */

    if (
        floresEncontradas.size === 6
        &&
        !finalDesbloqueado
    ) {

        finalDesbloqueado = true;

    }

}

/* =========================
   CERRAR MENSAJE
========================= */

cerrarMensaje.addEventListener(
    "click",
    () => {

        mensajeFlor.classList.add(
            "oculto"
        );


        /*
        Si encontró todas,
        comienza la transición.
        */

        if (
            finalDesbloqueado
            &&
            floresEncontradas.size === 6
        ) {

            setTimeout(() => {

                desbloqueoFinal.classList.remove(
                    "oculto"
                );

            }, 600);

        }

    }
);

btnFlorFinal.addEventListener(
    "click",
    () => {

        desbloqueoFinal.classList.add(
            "oculto"
        );

        crearFlorFinal();

    }
);


/* =========================
   FLOR ESPECIAL
========================= */

function crearFlorFinal() {

    /*
    Quitamos los girasoles anteriores
    y dejamos uno especial.
    */

    girasoles = [

        {
            x: canvas.width / 2,

            y: canvas.height * 0.58,

            tamaño: 55,

            angulo: 0,

            velocidad: 0.001,

            fase: 0,

            index: -1,

            especial: true
        }

    ];


    document.querySelector(
        ".galaxia-texto"
    ).textContent =
        "Y al final de este pequeño universo...";


    document.querySelector(
        ".galaxia-ui h2"
    ).innerHTML =
        'siempre estabas<br><span>tú.</span>';


    document.querySelector(
        ".instruccion"
    ).textContent =
        "Toca el último girasol 🌻";


    document.getElementById(
        "progresoFlores"
    ).style.display =
        "none";

}

/* =========================
   ABRIR CARTA FINAL
========================= */

/* =========================
   FINAL CINEMATOGRÁFICO
========================= */

let animacionFinalActiva = false;
let particulasFinales = [];


function abrirFinal() {

    if (animacionFinalActiva) {
        return;
    }

    animacionFinalActiva = true;

    /*
    Ocultamos los textos superiores
    para dejar solamente el universo.
    */

    const interfazGalaxia =
        document.querySelector(
            ".galaxia-ui"
        );

    interfazGalaxia.style.transition =
        "opacity 0.8s ease";

    interfazGalaxia.style.opacity =
        "0";


    /*
    Guardamos la posición
    del último girasol.
    */

    const flor =
        girasoles.find(
            girasol =>
                girasol.especial
        );


    const centroX =
        flor
            ? flor.x
            : canvas.width / 2;

    const centroY =
        flor
            ? flor.y
            : canvas.height / 2;


    /*
    Quitamos el girasol.
    */

    girasoles = [];


    /*
    Flash inicial.
    */

    crearExplosion(
        centroX,
        centroY
    );


    /*
    Después de la explosión,
    construimos el corazón.
    */

    setTimeout(() => {

        formarCorazon();

    }, 1000);


    /*
    Después mostramos
    el mensaje.
    */

    setTimeout(() => {

        mostrarTextoFinal();

    }, 3300);


    /*
    Finalmente abrimos
    la carta.
    */

    setTimeout(() => {

        dispersarCorazon();

    }, 5700);


    setTimeout(() => {

        mostrarCartaFinal();

    }, 7000);

}


/* =========================
   EXPLOSIÓN
========================= */

function crearExplosion(x, y) {

    particulasFinales = [];

    const cantidad = 160;

    for (
        let i = 0;
        i < cantidad;
        i++
    ) {

        const angulo =
            Math.random()
            *
            Math.PI
            *
            2;

        const velocidad =
            Math.random()
            *
            5
            +
            1;


        particulasFinales.push({

            x: x,

            y: y,

            vx:
                Math.cos(angulo)
                *
                velocidad,

            vy:
                Math.sin(angulo)
                *
                velocidad,

            tamaño:
                Math.random()
                *
                2.5
                +
                1,

            alpha: 1,

            objetivoX: null,

            objetivoY: null,

            modo:
                "explosion"

        });

    }

}


/* =========================
   FORMA DEL CORAZÓN
========================= */

function formarCorazon() {

    const centroX =
        canvas.width / 2;

    const centroY =
        canvas.height * 0.47;


    const escala =
        Math.min(
            canvas.width,
            canvas.height
        )
        *
        0.012;


    /*
    Reutilizamos las partículas
    de la explosión.
    */

    particulasFinales.forEach(
        (particula, index) => {

            const porcentaje =
                index
                /
                particulasFinales.length;

            const t =
                porcentaje
                *
                Math.PI
                *
                2;


            /*
            Fórmula matemática
            de corazón.
            */

            const corazonX =
                16
                *
                Math.pow(
                    Math.sin(t),
                    3
                );


            const corazonY =
                13
                *
                Math.cos(t)

                -

                5
                *
                Math.cos(2 * t)

                -

                2
                *
                Math.cos(3 * t)

                -

                Math.cos(4 * t);


            particula.objetivoX =
                centroX
                +
                corazonX
                *
                escala;


            particula.objetivoY =
                centroY
                -
                corazonY
                *
                escala;


            particula.modo =
                "corazon";

            particula.alpha =
                1;

        }
    );

}


/* =========================
   TEXTO FINAL
========================= */

let textoFinalVisible = false;


function mostrarTextoFinal() {

    textoFinalVisible = true;

}


/* =========================
   DISPERSAR
========================= */

function dispersarCorazon() {

    textoFinalVisible = false;


    particulasFinales.forEach(
        particula => {

            const angulo =
                Math.random()
                *
                Math.PI
                *
                2;


            const velocidad =
                Math.random()
                *
                3
                +
                1;


            particula.vx =
                Math.cos(angulo)
                *
                velocidad;


            particula.vy =
                Math.sin(angulo)
                *
                velocidad;


            particula.modo =
                "dispersar";

        }
    );

}


/* =========================
   DIBUJAR PARTÍCULAS
========================= */

function dibujarParticulasFinales() {

    if (!animacionFinalActiva) {
        return;
    }


    particulasFinales.forEach(
        particula => {


            /*
            EXPLOSIÓN
            */

            if (
                particula.modo
                ===
                "explosion"
            ) {

                particula.x +=
                    particula.vx;

                particula.y +=
                    particula.vy;

                particula.vx *=
                    0.97;

                particula.vy *=
                    0.97;

            }


            /*
            FORMAR CORAZÓN
            */

            if (
                particula.modo
                ===
                "corazon"
            ) {

                particula.x +=
                    (
                        particula.objetivoX
                        -
                        particula.x
                    )
                    *
                    0.055;


                particula.y +=
                    (
                        particula.objetivoY
                        -
                        particula.y
                    )
                    *
                    0.055;

            }


            /*
            DISPERSIÓN
            */

            if (
                particula.modo
                ===
                "dispersar"
            ) {

                particula.x +=
                    particula.vx;

                particula.y +=
                    particula.vy;

                particula.alpha -=
                    0.015;

            }


            /*
            Dibujar brillo
            */

            ctx.beginPath();

            ctx.arc(
                particula.x,
                particula.y,
                particula.tamaño * 3,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(
                    255,
                    190,
                    40,
                    ${Math.max(
                        particula.alpha
                        *
                        0.10,
                        0
                    )}
                )`;

            ctx.fill();


            /*
            Centro brillante
            */

            ctx.beginPath();

            ctx.arc(
                particula.x,
                particula.y,
                particula.tamaño,
                0,
                Math.PI * 2
            );

            ctx.fillStyle =
                `rgba(
                    255,
                    215,
                    80,
                    ${Math.max(
                        particula.alpha,
                        0
                    )}
                )`;

            ctx.fill();

        }
    );


    /*
    Texto sobre el corazón
    */

    if (textoFinalVisible) {

        ctx.save();

        ctx.textAlign =
            "center";


        ctx.shadowColor =
            "rgba(255,190,40,0.5)";

        ctx.shadowBlur =
            20;


        ctx.fillStyle =
            "#fff3c4";

        ctx.font =
    "500 11px Arial";

        ctx.fillText(
            "ESTE UNIVERSO ES",
            canvas.width / 2,
            canvas.height * 0.69
        );


        ctx.fillStyle =
            "#ffd54f";

        ctx.font =
    "32px Georgia";

        ctx.fillText(
            "para ti, Adri.",
            canvas.width / 2,
            canvas.height * 0.74
        );


        ctx.restore();

    }

}


/* =========================
   MOSTRAR CARTA
========================= */

function mostrarCartaFinal() {

    const cartaFinal =
        document.getElementById(
            "cartaFinal"
        );


    galaxia.style.transition =
        "opacity 1.2s ease";


    galaxia.style.opacity =
        "0";


    setTimeout(() => {

        galaxia.classList.add(
            "oculto"
        );


        cartaFinal.classList.remove(
            "oculto"
        );


        cartaFinal.scrollTop =
            0;
      iniciarPetalos();

    }, 1200);

}

/* =========================
   SECRETO FINAL
========================= */

const btnSecreto =
    document.getElementById(
        "btnSecreto"
    );

const mensajeSecreto =
    document.getElementById(
        "mensajeSecreto"
    );

const cerrarSecreto =
    document.getElementById(
        "cerrarSecreto"
    );


btnSecreto.addEventListener(
    "click",
    () => {

        mensajeSecreto.classList.remove(
            "oculto"
        );

    }
);


cerrarSecreto.addEventListener(
    "click",
    () => {

        mensajeSecreto.classList.add(
            "oculto"
        );

    }
);

/* =========================
   PÉTALOS DE LA CARTA
========================= */

let petalosIniciados = false;


function iniciarPetalos() {

    if (petalosIniciados) {
        return;
    }

    petalosIniciados = true;


    const contenedor =
        document.getElementById(
            "petalos"
        );


    setInterval(() => {

        /*
        Máximo aproximado para
        mantener buen rendimiento.
        */

        if (
            contenedor.children.length
            > 18
        ) {
            return;
        }


        const petalo =
            document.createElement(
                "div"
            );


        petalo.className =
            "petalo";


        petalo.style.left =
            Math.random()
            *
            100
            +
            "vw";


        petalo.style.animationDuration =
            (
                6
                +
                Math.random()
                *
                5
            )
            +
            "s";


        petalo.style.opacity =
            0.25
            +
            Math.random()
            *
            0.4;


        const escala =
            0.6
            +
            Math.random()
            *
            0.8;


        petalo.style.scale =
            escala;


        contenedor.appendChild(
            petalo
        );


        setTimeout(() => {

            petalo.remove();

        }, 12000);


    }, 700);

}

/* =========================
   MÚSICA
========================= */

function iniciarMusica() {

    musicaFondo.volume = 0;

    const promesa =
        musicaFondo.play();


    if (promesa !== undefined) {

        promesa
            .then(() => {

                musicaSonando = true;

                controlMusica.classList.remove(
                    "oculto",
                    "pausada"
                );

                controlMusica.classList.add(
                    "sonando"
                );

                fadeInMusica();

            })
            .catch(() => {

                /*
                Si algún navegador bloquea
                el audio, mostramos igualmente
                el botón para activarlo.
                */

                controlMusica.classList.remove(
                    "oculto"
                );

                controlMusica.classList.add(
                    "pausada"
                );

            });

    }

}


function fadeInMusica() {

    clearInterval(
        fadeMusica
    );


    fadeMusica =
        setInterval(() => {

            if (
                musicaFondo.volume
                <
                0.38
            ) {

                musicaFondo.volume =
                    Math.min(
                        musicaFondo.volume
                        +
                        0.02,
                        0.38
                    );

            } else {

                clearInterval(
                    fadeMusica
                );

            }

        }, 100);

}

controlMusica.addEventListener(
    "click",
    () => {

        if (musicaFondo.paused) {

            musicaFondo.play();

            musicaSonando = true;

            controlMusica.classList.remove(
                "pausada"
            );

            controlMusica.classList.add(
                "sonando"
            );


        } else {

            musicaFondo.pause();

            musicaSonando = false;

            controlMusica.classList.remove(
                "sonando"
            );

            controlMusica.classList.add(
                "pausada"
            );

        }

    }
);