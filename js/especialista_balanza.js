// js/especialista_balanza.js - Especialista para Ecuaciones Paso a Paso (BALANZA)

const EspecialistaBalanza = {
    normalizar(pRaw) {
        // Columna L: Pasos separados por triple coma (,,,)
        // Cada paso contiene: opción_correcta ; distractor1 ; distractor2
        let pasosRaw = [];
        const rawOpciones = pRaw.opciones || pRaw.pasosDisponibles || '';
        if (Array.isArray(rawOpciones)) {
            pasosRaw = rawOpciones;
        } else if (typeof rawOpciones === 'string') {
            pasosRaw = rawOpciones.split(',,,').map(p => p.trim()).filter(p => p !== '');
        }

        // Estructuramos cada paso separando las alternativas por ';'
        const pasosEstructurados = pasosRaw.map(pasoStr => {
            const opcionesPaso = pasoStr.split(';').map(o => o.trim()).filter(o => o !== '');
            return {
                correcta: opcionesPaso[0] || '', // La primera opción antes del ';' siempre es la correcta
                opciones: this.mezclarArray([...opcionesPaso]) // Se mezclan para no mostrar siempre la correcta primera
            };
        });

        return {
            id: pRaw.id || pRaw.N_de_orden_pregunta || 'preg_balanza',
            consigna: pRaw.consigna || pRaw.enunciado || 'Resuelve la siguiente ecuación paso a paso:',
            pasos: pasosEstructurados,
            resultadoCorrecto: String(pRaw.respuesta_correcta || pRaw.correcta || pRaw.respuestasCorrectas?.[0] || '').trim()
        };
    },

    mezclarArray(arr) {
        return arr.sort(() => Math.random() - 0.5);
    },

    renderTextoConImagen(texto) {
        if (!texto) return '';
        const regexUrl = /(https?:\/\/[^\s]+)/g;
        return texto.replace(regexUrl, (url) => {
            return `<br><img src="${url}" class="img-fluid rounded my-2" style="max-height: 280px; width: auto; max-width: 100%; display: block; margin: 0 auto;" alt="Consigna"><br>`;
        });
    },

    render(pNormalizada, respGuardada) {
        // Estado interno del ejercicio
        window.balanzaEstado = {
            pasoActual: 0,
            vidas: 2,
            pasosCompletados: false,
            respuestaInput: '',
            pregunta: pNormalizada
        };

        let html = `
            <div class="pregunta-balanza-container" style="max-width: 620px; margin: 0 auto; text-align: center;">
                <div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 10px; color: #1e293b;">
                    ${this.renderTextoConImagen(pNormalizada.consigna)}
                </div>

                <!-- Indicador de Vidas -->
                <div id="balanzaVidas" style="font-size: 1.4rem; margin-bottom: 15px;">
                    💖 💖
                </div>

                <!-- Contenedor del Paso Actual -->
                <div id="balanzaPasosArea">
                    ${this.renderPasoActual()}
                </div>

                <!-- Bloque Final del Resultado -->
                <div class="card p-3 my-3 border-0 bg-light shadow-sm" style="border-radius: 10px;">
                    <label style="font-weight: 700; color: #2563eb; margin-bottom: 8px; font-size: 0.95rem;">
                        Resultado final ($x = \dots$):
                    </label>
                    <input type="text" 
                           id="inputResultadoBalanza" 
                           class="form-control text-center mx-auto" 
                           style="max-width: 280px; font-weight: 600;" 
                           placeholder="Completá los pasos previos." 
                           disabled 
                           oninput="window.EspecialistaBalanza.onInputResultado(this.value)">
                </div>
            </div>
        `;

        return html;
    },

    renderPasoActual() {
        const est = window.balanzaEstado;
        const totalPasos = est.pregunta.pasos.length;

        if (est.pasoActual >= totalPasos) {
            est.pasosCompletados = true;
            setTimeout(() => this.desbloquearInputFinal(), 50);
            return `
                <div class="alert alert-success py-2 fw-bold" style="border-radius: 8px;">
                    ¡Pasos completados correctamente! Ahora ingresá el resultado final.
                </div>
            `;
        }

        const pasoObj = est.pregunta.pasos[est.pasoActual];

        let html = `
            <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 10px;">
                Paso ${est.pasoActual + 1} de ${totalPasos}: Seleccioná la operación conveniente para ambos miembros:
            </p>
            <div class="d-flex flex-wrap justify-content-center gap-2 mb-3">
        `;

        pasoObj.opciones.forEach((optStr, idx) => {
            const optAttribute = optStr.replace(/"/g, '&quot;');
            html += `
                <button class="btn btn-outline-primary fw-semibold px-3 py-2" 
                        style="border-radius: 8px; min-width: 140px; font-size: 0.95rem;" 
                        data-valor="${optAttribute}" 
                        onclick="window.EspecialistaBalanza.evaluarOpcionPaso(this)">
                    ${this.renderTextoConImagen(optStr)}
                </button>
            `;
        });

        html += `</div>`;
        return html;
    },

    evaluarOpcionPaso(btnElem) {
        const est = window.balanzaEstado;
        const seleccion = btnElem.getAttribute('data-valor') || '';
        const pasoObj = est.pregunta.pasos[est.pasoActual];

        // Comparación limpia contra la opción correcta del paso
        if (seleccion.trim().toLowerCase() === pasoObj.correcta.trim().toLowerCase()) {
            // Correcto: Avanza al siguiente paso
            est.pasoActual++;
            document.getElementById('balanzaPasosArea').innerHTML = this.renderPasoActual();

            // Re-procesar MathJax para refrescar las fórmulas del nuevo paso
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise();
            }
        } else {
            // Incorrecto: Descuenta una vida
            est.vidas--;
            this.actualizarVidasUI();

            btnElem.classList.remove('btn-outline-primary');
            btnElem.classList.add('btn-danger');
            btnElem.disabled = true;

            if (est.vidas <= 0) {
                document.getElementById('balanzaPasosArea').innerHTML = `
                    <div class="alert alert-danger py-2 fw-bold" style="border-radius: 8px;">
                        Te quedaste sin vidas. Intentá nuevamente.
                    </div>
                `;
            }
        }
    },

    actualizarVidasUI() {
        const est = window.balanzaEstado;
        const elemVidas = document.getElementById('balanzaVidas');
        if (!elemVidas) return;

        if (est.vidas === 2) elemVidas.innerText = '💖 💖';
        else if (est.vidas === 1) elemVidas.innerText = '💖 💔';
        else elemVidas.innerText = '💔 💔';
    },

    desbloquearInputFinal() {
        const input = document.getElementById('inputResultadoBalanza');
        if (input) {
            input.removeAttribute('disabled');
            input.placeholder = 'Ingresá el valor de x';
            input.focus();
        }
    },

    onInputResultado(val) {
        window.balanzaEstado.respuestaInput = val.trim();
        if (window.Director) {
            window.Director.habilitarBotonNavegacion(val.trim() !== '');
        }
    },

    obtenerRespuesta() {
        return window.balanzaEstado ? window.balanzaEstado.respuestaInput : '';
    },

    calcularPuntaje(respAlumnoStr, resultadoCorrectoStr) {
        const est = window.balanzaEstado;
        if (!est || !est.pasosCompletados || est.vidas <= 0) return 0;

        // Compara reemplazando coma por punto por si ingresan decimales
        const valAlumno = String(respAlumnoStr || '').trim().replace(',', '.').toLowerCase();
        const valCorrecto = String(resultadoCorrectoStr || '').trim().replace(',', '.').toLowerCase();

        return (valAlumno === valCorrecto) ? 1 : 0;
    }
};

window.EspecialistaBalanza = EspecialistaBalanza;
