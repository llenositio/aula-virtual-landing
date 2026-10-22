// js/especialista_om.js - Especialista para Opción Múltiple (OM)

const EspecialistaOM = {
    normalizar(pRaw) {
        let opciones = [];
        if (Array.isArray(pRaw.opciones)) {
            opciones = pRaw.opciones;
        } else if (typeof pRaw.opciones === 'string') {
            opciones = pRaw.opciones.split(',,,').map(o => o.trim()).filter(o => o !== '');
        }

        return {
            id: pRaw.id || pRaw.N_de_orden_pregunta || 'preg_om',
            consigna: pRaw.consigna || pRaw.enunciado || 'Seleccioná la opción correcta:',
            opciones: opciones,
            correcta: pRaw.correcta || pRaw.respuesta_correcta || ''
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
        window.respuestaOMActual = respGuardada || '';

        let html = `
            <div class="pregunta-om-container" style="max-width: 600px; margin: 0 auto;">
                <div style="font-size: 1.1rem; font-weight: 600; margin: 15px 0 25px 0; text-align: center; color: #1e293b;">
                    ${this.renderTextoConImagen(pNormalizada.consigna)}
                </div>

                <div class="mb-3">
                    <select id="selectOpcionOM" class="form-select form-select-lg" onchange="window.EspecialistaOM.onChangeSeleccion(this.value)">
                        <option value="">-- Selecciona una opción --</option>
        `;

        pNormalizada.opciones.forEach(opt => {
            const selected = (respGuardada === opt) ? 'selected' : '';
            html += `<option value="${opt.replace(/"/g, '&quot;')}" ${selected}>${opt}</option>`;
        });

        html += `
                    </select>
                </div>
            </div>
        `;
        return html;
    },

    onChangeSeleccion(val) {
        window.respuestaOMActual = val;
        if (window.Director) {
            window.Director.habilitarBotonNavegacion(val !== '');
        }
    },

    obtenerRespuesta() {
        return window.respuestaOMActual || '';
    },

    calcularPuntaje(respAlumno, correcta) {
        if (!respAlumno || !correcta) return 0;
        return (respAlumno.trim().toLowerCase() === correcta.trim().toLowerCase()) ? 1 : 0;
    }
};

window.EspecialistaOM = EspecialistaOM;
