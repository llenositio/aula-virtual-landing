// js/especialista_cv.js - Especialista para Casillas de Verificación (CV)

const EspecialistaCV = {
    normalizar(pRaw) {
        // 1. Opciones (Columna: opciones)
        let opciones = [];
        if (Array.isArray(pRaw.opciones)) {
            opciones = pRaw.opciones.map(o => String(o).trim());
        } else if (typeof pRaw.opciones === 'string') {
            opciones = pRaw.opciones.split(',,,').map(o => o.trim()).filter(o => o !== '');
        }

        // 2. Respuestas Correctas (Columna: respuesta_correcta)
        let correctas = [];
        if (Array.isArray(pRaw.respuesta_correcta)) {
            correctas = pRaw.respuesta_correcta.map(c => String(c).trim());
        } else if (typeof pRaw.respuesta_correcta === 'string') {
            correctas = pRaw.respuesta_correcta.split(',,,').map(c => c.trim()).filter(c => c !== '');
        }

        return {
            id: pRaw.id || pRaw.N_de_orden_pregunta || 'preg_cv',
            consigna: pRaw.consigna || 'Seleccioná todas las opciones correctas:',
            opciones: opciones,
            correctas: correctas
        };
    },

    renderTextoConImagen(texto) {
        if (!texto) return '';
        const regexUrl = /(https?:\/\/[^\s]+)/g;
        return texto.replace(regexUrl, (url) => {
            return `<br><img src="${url}" class="img-fluid rounded my-2" style="max-height: 280px; width: auto; max-width: 100%; display: block; margin: 0 auto;" alt="Consigna"><br>`;
        });
    },

    render(pNormalizada, respGuardada) {
        window.respuestasCVActual = respGuardada ? respGuardada.split(',,,').map(r => r.trim()) : [];

        let html = `
            <div class="pregunta-cv-container" style="max-width: 600px; margin: 0 auto;">
                <p style="text-align: center; color: #64748b; font-size: 0.9rem; margin-bottom: 8px;">
                    Seleccioná todas las opciones correctas
                </p>
                <div style="font-size: 1.1rem; font-weight: 600; margin: 15px 0 25px 0; text-align: center; color: #1e293b;">
                    ${this.renderTextoConImagen(pNormalizada.consigna)}
                </div>

                <div class="grid-cv">
        `;

        pNormalizada.opciones.forEach((opt, idx) => {
            const seleccionada = window.respuestasCVActual.some(r => r.toLowerCase() === opt.toLowerCase());
            const claseSel = seleccionada ? 'seleccionada' : '';

            html += `
                <div class="tarjeta-cv ${claseSel}" 
                     id="cv_opt_${idx}" 
                     onclick="window.EspecialistaCV.toggleSeleccion('${opt.replace(/'/g, "\\'")}', this)">
                    ${this.renderTextoConImagen(opt)}
                </div>
            `;
        });

        html += `</div></div>`;
        return html;
    },

    toggleSeleccion(valor, elemento) {
        if (!window.respuestasCVActual) window.respuestasCVActual = [];

        const valorLimpio = String(valor).trim();
        const index = window.respuestasCVActual.findIndex(r => r.toLowerCase() === valorLimpio.toLowerCase());

        if (index > -1) {
            window.respuestasCVActual.splice(index, 1);
            elemento.classList.remove('seleccionada');
        } else {
            window.respuestasCVActual.push(valorLimpio);
            elemento.classList.add('seleccionada');
        }

        if (window.Director) {
            window.Director.habilitarBotonNavegacion(window.respuestasCVActual.length > 0);
        }
    },

    obtenerRespuesta() {
        return (window.respuestasCVActual || []).join(',,,');
    },

    calcularPuntaje(respAlumnoStr, correctasArr) {
        if (!respAlumnoStr) return 0;

        const seleccionAlumno = String(respAlumnoStr).split(',,,').map(s => s.trim()).filter(s => s !== '');
        const correctas = (Array.isArray(correctasArr) ? correctasArr : String(correctasArr || '').split(',,,'))
            .map(c => String(c).trim())
            .filter(c => c !== '');

        if (seleccionAlumno.length !== correctas.length) return 0;

        const coincidenTodas = seleccionAlumno.every(sel => 
            correctas.some(corr => corr.toLowerCase() === sel.toLowerCase())
        );

        return coincidenTodas ? 1 : 0;
    }
};

window.EspecialistaCV = EspecialistaCV;
