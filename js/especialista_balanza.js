// js/especialista_balanza.js - Especialista BALANZA (con Tarjetas para el Resultado Final)

const EspecialistaBalanza = {
    normalizar(pRaw) {
        let consignaLimpia = pRaw.consigna || pRaw.enunciado || 'Resuelve la siguiente ecuación paso a paso:';
        
        // Si la consigna trae pasos concatenados por ',,,', toma solo el enunciado inicial
        if (consignaLimpia.includes(',,,')) {
            consignaLimpia = consignaLimpia.split(',,,')[0].trim();
        }

        // Columna L: Pasos separados por triple coma (,,,)
        let pasosRaw = [];
        const rawOpciones = pRaw.opciones || pRaw.pasosDisponibles || '';
        if (Array.isArray(rawOpciones)) {
            pasosRaw = rawOpciones;
        } else if (typeof rawOpciones === 'string') {
            pasosRaw = rawOpciones.split(',,,').map(p => p.trim()).filter(p => p !== '');
        }

        // Estructuramos cada paso detectando el asterisco '*'
        const pasosEstructurados = pasosRaw
            .filter(pasoStr => pasoStr.includes(';') || pasoStr.includes('='))
            .map(pasoStr => {
                const opcionesPaso = pasoStr.split(';').map(o => o.trim()).filter(o => o !== '');
                
                let correctaLimpia = '';
                const opcionesProcesadas = opcionesPaso.map(opt => {
                    if (opt.startsWith('*')) {
                        correctaLimpia = opt.substring(1).trim();
                        return correctaLimpia;
                    }
                    return opt.trim();
                });

                if (!correctaLimpia && opcionesProcesadas.length > 0) {
                    correctaLimpia = opcionesProcesadas[0];
                }

                return {
                    correcta: correctaLimpia,
                    opciones: this.mezclarArray([...opcionesProcesadas])
                };
            });

        // Parseo de opciones para el Resultado Final (Columna M / respuesta_correcta)
        // Pueden venir varias alternativas separadas por ';' donde una incluye '*' o la primera es la correcta
        const rawResultado = String(pRaw.respuesta_correcta || pRaw.correcta || '').trim();
        let opcionesResultadoRaw = rawResultado.split(';').map(r => r.trim()).filter(r => r !== '');

        let resultadoCorrectoLimpio = '';
        const opcionesResultadoLimpias = opcionesResultadoRaw.map(opt => {
            if (opt.startsWith('*')) {
                resultadoCorrectoLimpio = opt.substring(1).trim();
                return resultadoCorrectoLimpio;
            }
            return opt.trim();
        });

        if (!resultadoCorrectoLimpio && opcionesResultadoLimpias.length > 0) {
            resultadoCorrectoLimpio = opcionesResultadoLimpias[0];
        }

        return {
            id: pRaw.id || pRaw.N_de_orden_pregunta || 'preg_balanza',
            consigna: consignaLimpia,
            pasos: pasosEstructurados,
            resultadoCorrecto: resultadoCorrectoLimpio,
            opcionesResultado: this.mezclarArray([...opcionesResultadoLimpias])
        };
    },

    mezclarArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    },

    renderTextoConImagen(texto) {
        if (!texto) return '';
        const regexUrl = /(https?:\/\/[^\s]+)/g;
        return texto.replace(regexUrl, (url) => {
            return `<br><img src="${url}" class="img-fluid rounded my-2" style="max-height: 280px; width: auto; max-width: 100%; display: block; margin: 0 auto;" alt="Consigna"><br>`;
        });
    },

    render(pNormalizada, respGuardada) {
        window.balanzaEstado = {
            pasoActual: 0,
            vidas: 2,
            pasosCompletados: false,
            resultadoSeleccionado: '',
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

                <!-- Bloque Final del Resultado en Tarjetas -->
                <div class="card p-3 my-3 border-0 bg-light shadow-sm" style="border-radius: 10px;">
                    <label style="font-weight: 700; color: #2563eb; margin-bottom: 12px; font-size: 1rem;">
                        Resultado
                    </label>
                    <div id="contenedorTarjetasResultado">
                        ${this.renderTarjetasResultadoBloqueadas()}
                    </div>
                </div>
            </div>
        `;

        return html;
    },

    renderPasoActual() {
        const est = window.balanzaEstado;
        const totalPasos = est.pregunta.pasos.length;

        if (totalPasos === 0 || est.pasoActual >= totalPasos) {
            est.pasosCompletados = true;
            setTimeout(() => this.desbloquearResultadosFinales(), 50);
            return `
                <div class="alert alert-success py-2 fw-bold" style="border-radius: 8px;">
                    ¡Pasos completados correctamente! Ahora elegí el resultado.
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

        pasoObj.opciones.forEach((optStr) => {
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

    renderTarjetasResultadoBloqueadas() {
        return `
            <div class="p-3 text-muted border rounded" style="background-color: #f1f5f9; font-size: 0.9rem; font-weight: 600;">
                Completá los pasos previos.
            </div>
        `;
    },

    desbloquearResultadosFinales() {
        const est = window.balanzaEstado;
        const contenedor = document.getElementById('contenedorTarjetasResultado');
        if (!contenedor) return;

        let html = `<div class="d-flex flex-wrap justify-content-center gap-2">`;

        est.pregunta.opcionesResultado.forEach((optRes, idx) => {
            const optAttribute = optRes.replace(/"/g, '&quot;');
            html += `
                <div class="tarjeta-cv" 
                     id="balanza_res_opt_${idx}"
                     data-valor="${optAttribute}"
                     style="min-width: 130px; padding: 12px 18px; min-height: 50px; font-weight: 600;"
                     onclick="window.EspecialistaBalanza.seleccionarResultadoFinal(this)">
                    ${this.renderTextoConImagen(optRes)}
                </div>
            `;
        });

        html += `</div>`;
        contenedor.innerHTML = html;

        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise();
        }
    },

    seleccionarResultadoFinal(elemento) {
        const valorLimpio = elemento.getAttribute('data-valor') || '';

        // Desmarcar las demás tarjetas de resultado
        document.querySelectorAll('#contenedorTarjetasResultado .tarjeta-cv').forEach(el => el.classList.remove('seleccionada'));

        if (window.balanzaEstado.resultadoSeleccionado === valorLimpio) {
            window.balanzaEstado.resultadoSeleccionado = '';
        } else {
            window.balanzaEstado.resultadoSeleccionado = valorLimpio;
            elemento.classList.add('seleccionada');
        }

        if (window.Director) {
            window.Director.habilitarBotonNavegacion(window.balanzaEstado.resultadoSeleccionado !== '');
        }
    },

    evaluarOpcionPaso(btnElem) {
        const est = window.balanzaEstado;
        const seleccion = btnElem.getAttribute('data-valor') || '';
        const pasoObj = est.pregunta.pasos[est.pasoActual];

        if (seleccion.trim().toLowerCase() === pasoObj.correcta.trim().toLowerCase()) {
            est.pasoActual++;
            document.getElementById('balanzaPasosArea').innerHTML = this.renderPasoActual();

            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise();
            }
        } else {
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

    obtenerRespuesta() {
        return window.balanzaEstado ? window.balanzaEstado.resultadoSeleccionado : '';
    },

    calcularPuntaje(respAlumnoStr, resultadoCorrectoStr) {
        const est = window.balanzaEstado;
        if (!est || !est.pasosCompletados || est.vidas <= 0) return 0;

        const valAlumno = String(respAlumnoStr || '').trim().toLowerCase();
        const valCorrecto = String(resultadoCorrectoStr || '').trim().toLowerCase();

        return (valAlumno === valCorrecto) ? 1 : 0;
    }
};

window.EspecialistaBalanza = EspecialistaBalanza;
