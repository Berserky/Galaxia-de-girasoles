// Ilustración original del proyecto, dibujada sin recursos externos.
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


