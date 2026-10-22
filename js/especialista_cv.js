// js/especialista_cv.js - Especialista para Casillas de Verificación (CV)

const EspecialistaCV = {
    normalizar(pRaw) {
        let opciones = [];
        if (Array.isArray(pRaw.opciones)) {
            opciones = pRaw.opciones;
        } else if (typeof pRaw.opciones === 'string') {
            opciones = pRaw.opciones.split(',,,').map(o => o.trim()).filter(o => o !== '');
        }

        let correctas = [];
        if (Array.isArray(pRaw.correcta)) {
            correctas = pRaw.correcta;
        } else if (typeof pRaw.correcta === 'string') {
            correctas = pRaw.correcta.split(',,,').map(c => c.trim()).filter(c => c !== '');
        }

        return {
            id: pRaw.id || pRaw.N_de_orden_pregunta || 'preg_cv',
            consigna: pRaw.consigna || pRaw.enunciado || 'Seleccioná todas las opciones correctas:',
            opciones: opciones,
            correctas: correctas
        };
    },

    render(pNormalizada, respGuardada) {
        window.respuestasCVActual = respGuardada ? respGuardada.split(',,,').map(r => r.trim()) : [];

        // Función auxiliar local para parsear links de imágenes en el texto
        const renderTextoConImagen = (texto) => {
            if (!texto) return '';
            const regexUrl = /(https?:\/\/[^\s]+)/g;
            return texto.replace(regexUrl, (url) => {
                return `<br><img src="${url}" class="img-fluid rounded my-2" style="max-height: 280px; width: auto; max-width: 100%; display: block; margin: 0 auto;" alt="Consigna"><br>`;
            });
        };

        let html = `
            <div class="pregunta-cv-container" style="max-width: 600px; margin: 0 auto;">
                <p style="text-align: center; color: #64748b; font-size: 0.9rem; margin-bottom: 8px;">
                    Seleccioná todas las correctas
                </p>
                <div style="font-size: 1.1rem; font-weight: 600; margin: 15px 0 25px 0; text-align: center; color: #1e293b;">
                    ${renderTextoConImagen(pNormalizada.consigna)}
                </div>

                <div class="grid-cv">
        `;

        pNormalizada.opciones.forEach((opt, idx) => {
            const seleccionada = window.respuestasCVActual.includes(opt);
            const claseSel = seleccionada ? 'seleccionada' : '';

            html += `
                <div class="tarjeta-cv ${claseSel}" 
                     id="cv_opt_${idx}" 
                     onclick="window.EspecialistaCV.toggleSeleccion('${opt.replace(/'/g, "\\'")}', this)">
                    ${renderTextoConImagen(opt)}
                </div>
            `;
        });

        html += `</div></div>`;
        return html;
    },

    toggleSeleccion(valor, elemento) {
        if (!window.respuestasCVActual) window.respuestasCVActual = [];

        const index = window.respuestasCVActual.indexOf(valor);
        if (index > -1) {
            window.respuestasCVActual.splice(index, 1);
            elemento.classList.remove('seleccionada');
        } else {
            window.respuestasCVActual.push(valor);
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
        const seleccionAlumno = respAlumnoStr.split(',,,').map(s => s.trim());
        const correctas = Array.isArray(correctasArr) ? correctasArr : [];

        const esMismoLargo = seleccionAlumno.length === correctas.length;
        const coincidenTodas = seleccionAlumno.every(sel => 
            correctas.some(corr => corr.toLowerCase() === sel.toLowerCase())
        );

        return (esMismoLargo && coincidenTodas) ? 1 : 0;
    }
};

window.EspecialistaCV = EspecialistaCV;
