// =========================================================================
// ESPECIALISTA OM (Opción Múltiple)
// Replica la lógica de 005_OM.gs y JS_Especialistas
// =========================================================================

const EspecialistaOM = {
    /**
     * Procesa los datos crudos de Supabase y los adapta al objeto esperado.
     */
    normalizar(pregunta) {
        let listaOpciones = [];
        
        if (Array.isArray(pregunta.opciones)) {
            listaOpciones = pregunta.opciones;
        } else if (typeof pregunta.opciones === 'string') {
            listaOpciones = pregunta.opciones.split(',,,').map(opt => opt.trim());
        }

        const respuestaCorrecta = pregunta.respuesta_correcta || 
                                 (Array.isArray(pregunta.respuestasCorrectas) ? pregunta.respuestasCorrectas[0] : '') || 
                                 '';

        return {
            id: pregunta.id || pregunta.N_de_orden_pregunta,
            enunciado: pregunta.consigna || pregunta.enunciado || 'Seleccioná la opción correcta:',
            opciones: listaOpciones,
            correcta: respuestaCorrecta.trim()
        };
    },

    /**
     * Genera el HTML de la interfaz para preguntas de Opción Múltiple.
     */
    render(preguntaNormalizada, respuestaGuardada) {
        const p = preguntaNormalizada;
        
        const opcionesHTML = p.opciones.map(opt => {
            const esSeleccionado = (respuestaGuardada === opt) ? 'selected' : '';
            return `<option value="${opt}" ${esSeleccionado}>${opt}</option>`;
        }).join('');

        return `
            <div class="pregunta-om-container">
                <div class="enunciado-texto text-center fw-bold mb-4 fs-5 text-dark">
                    ${p.enunciado}
                </div>
                <div class="mb-3" style="max-width: 480px; margin: 0 auto;">
                    <select id="opcionSeleccionadaOM" class="form-select form-select-lg text-center fs-6 shadow-sm" onchange="EspecialistaOM.validarSeleccion()">
                        <option value="">-- Selecciona una opción --</option>
                        ${opcionesHTML}
                    </select>
                </div>
            </div>
        `;
    },

    /**
     * Valida que el alumno haya elegido una opción para activar el botón.
     */
    validarSeleccion() {
        const select = document.getElementById('opcionSeleccionadaOM');
        const valor = select ? select.value.trim() : '';
        
        if (window.Director) {
            window.Director.habilitarBotonNavegacion(valor !== '');
        }
    },

    /**
     * Captura la respuesta seleccionada por el alumno.
     */
    obtenerRespuesta() {
        const select = document.getElementById('opcionSeleccionadaOM');
        return select ? select.value.trim() : '';
    },

    /**
     * Calcula el puntaje (1 si coincide exactamente con la correcta, 0 si no).
     */
    calcularPuntaje(respuestaAlumno, respuestaCorrecta) {
        if (!respuestaAlumno) return 0;
        return respuestaAlumno.trim().toLowerCase() === respuestaCorrecta.trim().toLowerCase() ? 1 : 0;
    }
};

window.EspecialistaOM = EspecialistaOM;
