// =========================================================================
// ESPECIALISTA VF (Verdadero / Falso - Matriz)
// Replica la lógica de 004_VF.gs y JS_Especialistas
// =========================================================================

const EspecialistaVF = {
    // Memoria temporal para las selecciones V/F de la pregunta activa
    respuestasActuales: {},

    /**
     * Procesa los datos de Supabase y los convierte en el objeto estructurado de subPreguntas.
     */
    normalizar(pregunta) {
        let listaTextos = [];
        let listaResp = [];

        // Parsing de opciones (afirmaciones)
        if (Array.isArray(pregunta.opciones)) {
            listaTextos = pregunta.opciones;
        } else if (typeof pregunta.opciones === 'string') {
            listaTextos = pregunta.opciones.split(',,,').map(t => t.trim());
        }

        // Parsing de respuestas correctas
        const respCorrectaRaw = pregunta.respuesta_correcta || 
                               (Array.isArray(pregunta.respuestasCorrectas) ? pregunta.respuestasCorrectas.join(',,,') : '') || 
                               '';

        if (respCorrectaRaw.includes(',,,')) {
            listaResp = respCorrectaRaw.split(',,,').map(r => r.trim().toUpperCase());
        } else if (respCorrectaRaw.length === listaTextos.length) {
            // Caso donde viene todo junto como "VVFVF"
            listaResp = respCorrectaRaw.toUpperCase().split('');
        } else {
            listaResp = [respCorrectaRaw.trim().toUpperCase()];
        }

        const subPreguntas = listaTextos.map((texto, idx) => ({
            texto: texto.trim(),
            correcta: (listaResp[idx] ? listaResp[idx].trim().toUpperCase() : 'V')
        }));

        const enunciadoFinal = pregunta.consigna || pregunta.enunciado || 'Indica si es Verdadero (V) o Falso (F):';

        return {
            id: pregunta.id || pregunta.N_de_orden_pregunta,
            enunciado: enunciadoFinal,
            subPreguntas: subPreguntas
        };
    },

    /**
     * Genera la tabla estilizada idéntica a la vista original de Apps Script.
     */
    render(preguntaNormalizada, respuestaGuardada) {
        const p = preguntaNormalizada;
        this.respuestasActuales = {};

        if (respuestaGuardada) {
            try {
                this.respuestasActuales = JSON.parse(respuestaGuardada);
            } catch (e) {
                this.respuestasActuales = {};
            }
        }

        let filasHTML = '';
        p.subPreguntas.forEach((sub, i) => {
            const valSel = this.respuestasActuales[i] || '';
            const claseV = (valSel === 'V') ? 'seleccionado-v' : '';
            const claseF = (valSel === 'F') ? 'seleccionado-f' : '';

            filasHTML += `
                <tr>
                    <td class="col-concepto text-start">${sub.texto}</td>
                    <td class="col-opcion text-center">
                        <button type="button" class="btn-vf-opcion btn-v-${i} ${claseV}" onclick="EspecialistaVF.marcar(${i}, 'V', ${p.subPreguntas.length})">V</button>
                    </td>
                    <td class="col-opcion text-center">
                        <button type="button" class="btn-vf-opcion btn-f-${i} ${claseF}" onclick="EspecialistaVF.marcar(${i}, 'F', ${p.subPreguntas.length})">F</button>
                    </td>
                </tr>
            `;
        });

        return `
            <div class="pregunta-vf-container">
                <div class="enunciado-texto text-center fw-bold mb-3 fs-5 text-dark">
                    ${p.enunciado}
                </div>
                <table class="tabla-vf">
                    <thead>
                        <tr>
                            <th class="text-center">Concepto / Afirmación</th>
                            <th style="width: 60px;" class="text-center">V</th>
                            <th style="width: 60px;" class="text-center">F</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filasHTML}
                    </tbody>
                </table>
            </div>
        `;
    },

    /**
     * Gestiona el clic en los botones V y F de cada fila.
     */
    marcar(filaIndex, valor, totalFilas) {
        this.respuestasActuales[filaIndex] = valor;

        const contenedor = document.querySelector('.pregunta-vf-container');
        if (contenedor) {
            const btnV = contenedor.querySelector(`.btn-v-${filaIndex}`);
            const btnF = contenedor.querySelector(`.btn-f-${filaIndex}`);

            if (btnV && btnF) {
                if (valor === 'V') {
                    btnV.classList.add('seleccionado-v');
                    btnF.classList.remove('seleccionado-f');
                } else {
                    btnF.classList.add('seleccionado-f');
                    btnV.classList.remove('seleccionado-v');
                }
            }
        }

        // Habilita el botón SIGUIENTE cuando el alumno respondió todas las filas
        const contestadas = Object.keys(this.respuestasActuales).length;
        if (window.Director) {
            window.Director.habilitarBotonNavegacion(contestadas === totalFilas);
        }
    },

    /**
     * Obtiene el estado actual de las respuestas serializado como JSON.
     */
    obtenerRespuesta() {
        return JSON.stringify(this.respuestasActuales);
    },

    /**
     * Calcula el puntaje proporcional (aciertos / total subpreguntas).
     */
    calcularPuntaje(respuestaAlumnoJSON, subPreguntas) {
        if (!respuestaAlumnoJSON || !subPreguntas || subPreguntas.length === 0) return 0;
        
        let respAlumno = {};
        try {
            respAlumno = JSON.parse(respuestaAlumnoJSON);
        } catch (e) {
            return 0;
        }

        let aciertos = 0;
        subPreguntas.forEach((sub, i) => {
            if (respAlumno[i] && respAlumno[i] === sub.correcta) {
                aciertos++;
            }
        });

        return aciertos / subPreguntas.length;
    }
};

window.EspecialistaVF = EspecialistaVF;
