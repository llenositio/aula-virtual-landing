// js/especialista_fr1.js - Especialista para Fracciones Interactivas Paso a Paso (FR1)

const EspecialistaFR1 = {
    normalizar(pRaw) {
        let consignaLimpia = pRaw.consigna || pRaw.enunciado || 'Resuelve la siguiente operación con fracciones:';
        if (consignaLimpia.includes(',,,')) {
            consignaLimpia = consignaLimpia.split(',,,')[0].trim();
        }

        // Parseo de la configuración en Columna L (separada por triple coma ,,,)
        let configRawStr = pRaw.opciones || pRaw.config || '';
        let configRaw = [];
        if (Array.isArray(configRawStr)) {
            configRaw = configRawStr;
        } else if (typeof configRawStr === 'string') {
            configRaw = configRawStr.split(',,,').map(item => item.trim()).filter(item => item !== '');
        }

        let tipoOperacion = "SUMA";
        if (configRaw.length > 0 && configRaw[0] && !configRaw[0].includes(':')) {
            tipoOperacion = configRaw[0].toUpperCase();
        }

        let pasosObj = {};
        configRaw.forEach(item => {
            if (item && item.includes(':')) {
                const partes = item.split(':');
                const clave = partes[0].trim().toLowerCase();
                const valor = partes[1].trim();
                pasosObj[clave] = valor;
            }
        });

        // Extraer MCM correcto
        const mcmCorrecto = pasosObj['mcm'] || '';

        // Extraer numeradores equivalentes (ej: "10,36,-9" -> ["10", "36", "-9"])
        let equivalentesArr = [];
        if (pasosObj['equivalentes']) {
            equivalentesArr = pasosObj['equivalentes'].split(',').map(v => v.trim()).filter(v => v !== '');
        }

        // Extraer y procesar resultado final (Columna M)
        const rawResultado = String(pRaw.respuesta_correcta || pRaw.correcta || pRaw.respuestasCorrectas?.[0] || '').trim();
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

        // Generamos distractores para la tarjeta de resultado si no vinieron en la planilla
        const tarjetasResultado = this.generarTarjetasResultado(resultadoCorrectoLimpio, opcionesResultadoLimpias);

        return {
            id: pRaw.id || pRaw.N_de_orden_pregunta || 'preg_fr1',
            consigna: consignaLimpia,
            operacion: tipoOperacion,
            mcmCorrecto: mcmCorrecto,
            equivalentesCorrectos: equivalentesArr,
            resultadoCorrecto: resultadoCorrectoLimpio,
            opcionesResultado: tarjetasResultado
        };
    },

    generarTarjetasResultado(correcta, opcionesLimpias) {
        let opciones = [...opcionesLimpias];
        if (opciones.length <= 1 && correcta) {
            // Si solo vino el valor correcto, armamos 2 distractores automáticos para el selector
            if (correcta.includes('/')) {
                const partes = correcta.split('/');
                const num = parseInt(partes[0]) || 1;
                const den = parseInt(partes[1]) || 1;
                opciones.push(`${num + 2}/${den}`);
                opciones.push(`${num}/${den + 1}`);
            } else {
                const val = parseInt(correcta) || 0;
                opciones.push(`${val + 1}`);
                opciones.push(`${val - 1}`);
            }
        }
        return this.mezclarArray([...new Set(opciones)]);
    },

    mezclarArray(arr) {
        const copia = [...arr];
        for (let i = copia.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copia[i], copia[j]] = [copia[j], copia[i]];
        }
        return copia;
    },

    renderTextoConImagen(texto) {
        if (!texto) return '';
        const regexUrl = /(https?:\/\/[^\s]+)/g;
        return texto.replace(regexUrl, (url) => {
            return `<br><img src="${url}" class="img-fluid rounded my-2" style="max-height: 280px; width: auto; max-width: 100%; display: block; margin: 0 auto;" alt="Consigna"><br>`;
        });
    },

    render(pNormalizada, respGuardada) {
        window.fr1Estado = {
            mcmIngresado: '',
            mcmValidado: false,
            numeradoresIngresados: new Array(pNormalizada.equivalentesCorrectos.length).fill(''),
            numeradoresValidados: false,
            resultadoSeleccionado: '',
            pregunta: pNormalizada
        };

        let html = `
            <div class="pregunta-fr1-container" style="max-width: 600px; margin: 0 auto;">
                <div style="font-size: 1.2rem; font-weight: 700; margin-bottom: 20px; text-align: center; color: #1e293b;">
                    ${this.renderTextoConImagen(pNormalizada.consigna)}
                </div>

                <!-- Paso 1: MCM -->
                <div class="card p-3 mb-3 border-0 bg-light shadow-sm" style="border-radius: 10px;">
                    <label class="fw-bold text-dark mb-2" style="font-size: 0.95rem;">
                        Paso 1: MCM
                    </label>
                    <div class="d-flex align-items-center gap-2">
                        <input type="text" 
                               id="inputFr1Mcm" 
                               class="form-control text-center fw-bold" 
                               style="max-width: 180px;" 
                               placeholder="Ej: 12" 
                               oninput="window.EspecialistaFR1.onInputMcm(this.value)">
                        <span id="badgeMcmStatus" class="badge bg-secondary p-2 hidden">✓</span>
                    </div>
                </div>

                <!-- Paso 2: Numeradores Equivalentes -->
                <div class="card p-3 mb-3 border-0 bg-light shadow-sm" style="border-radius: 10px;">
                    <label class="fw-bold text-dark mb-2" style="font-size: 0.95rem;">
                        Paso 2: Numeradores
                    </label>
                    <div id="contenedorNumeradoresFr1">
                        ${this.renderCamposNumeradoresBloqueados(pNormalizada.equivalentesCorrectos.length)}
                    </div>
                </div>

                <!-- Paso 3: Resultado Simplificado -->
                <div class="card p-3 mb-3 border-0 bg-light shadow-sm" style="border-radius: 10px;">
                    <label class="fw-bold text-primary mb-2" style="font-size: 1rem;">
                        Resultado simplificado
                    </label>
                    <div id="contenedorTarjetasResultadoFr1" class="text-center">
                        <div class="p-3 text-muted border rounded" style="background-color: #f1f5f9; font-size: 0.9rem; font-weight: 600;">
                            Completá los pasos previos.
                        </div>
                    </div>
                </div>
            </div>
        `;

        return html;
    },

    renderCamposNumeradoresBloqueados(cantidad) {
        let html = `<div class="d-flex flex-wrap align-items-center justify-content-center gap-2">`;
        for (let i = 0; i < cantidad; i++) {
            html += `
                <input type="text" 
                       class="form-control text-center fw-bold" 
                       style="width: 75px;" 
                       placeholder="Ej: ${i === 0 ? '4' : '15'}" 
                       disabled>
                ${i < cantidad - 1 ? '<span class="fw-bold text-secondary">,</span>' : ''}
            `;
        }
        html += `</div>`;
        return html;
    },

    onInputMcm(val) {
        const est = window.fr1Estado;
        est.mcmIngresado = val.trim();

        // Validar MCM al instante
        if (est.mcmIngresado === est.pregunta.mcmCorrecto) {
            est.mcmValidado = true;
            this.desbloquearNumeradores();
        }
    },

    desbloquearNumeradores() {
        const est = window.fr1Estado;
        const contenedor = document.getElementById('contenedorNumeradoresFr1');
        if (!contenedor) return;

        const cantidad = est.pregunta.equivalentesCorrectos.length;
        let html = `<div class="d-flex flex-wrap align-items-center justify-content-center gap-2">`;

        for (let i = 0; i < cantidad; i++) {
            html += `
                <input type="text" 
                       id="inputNumFr1_${i}" 
                       class="form-control text-center fw-bold" 
                       style="width: 80px;" 
                       placeholder="Num ${i + 1}" 
                       oninput="window.EspecialistaFR1.onInputNumerador(${i}, this.value)">
                ${i < cantidad - 1 ? '<span class="fw-bold text-secondary">,</span>' : ''}
            `;
        }
        html += `</div>`;
        contenedor.innerHTML = html;

        // Deshabilitar input MCM para fijar el paso 1
        const inputMcm = document.getElementById('inputFr1Mcm');
        if (inputMcm) inputMcm.disabled = true;
    },

    onInputNumerador(idx, val) {
        const est = window.fr1Estado;
        est.numeradoresIngresados[idx] = val.trim();

        // Verificar si todos los numeradores son correctos
        const todosCorrectos = est.pregunta.equivalentesCorrectos.every((valCorr, i) => {
            return est.numeradoresIngresados[i] === valCorr;
        });

        if (todosCorrectos) {
            est.numeradoresValidados = true;
            this.desbloquearResultadoFinal();
        }
    },

    desbloquearResultadoFinal() {
        const est = window.balanzaEstado || window.fr1Estado;
        const contenedor = document.getElementById('contenedorTarjetasResultadoFr1');
        if (!contenedor) return;

        // Bloquear inputs de numeradores
        est.pregunta.equivalentesCorrectos.forEach((_, i) => {
            const input = document.getElementById(`inputNumFr1_${i}`);
            if (input) input.disabled = true;
        });

        let html = `<div class="d-flex flex-wrap justify-content-center gap-2">`;

        est.pregunta.opcionesResultado.forEach((optRes, idx) => {
            const optAttribute = optRes.replace(/"/g, '&quot;');
            // Formateo como LaTeX si contiene '/' para que se vea como fracción bonita ($\frac{a}{b}$)
            let textoRender = optRes;
            if (optRes.includes('/') && !optRes.includes('$')) {
                const partes = optRes.split('/');
                textoRender = `$\\frac{${partes[0]}}{${partes[1]}}$`;
            }

            html += `
                <div class="tarjeta-cv" 
                     id="fr1_res_opt_${idx}"
                     data-valor="${optAttribute}"
                     style="min-width: 120px; padding: 12px 18px; min-height: 55px; font-weight: 700; font-size: 1.2rem;"
                     onclick="window.EspecialistaFR1.seleccionarResultadoFinal(this)">
                    ${this.renderTextoConImagen(textoRender)}
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

        document.querySelectorAll('#contenedorTarjetasResultadoFr1 .tarjeta-cv').forEach(el => el.classList.remove('seleccionada'));

        if (window.fr1Estado.resultadoSeleccionado === valorLimpio) {
            window.fr1Estado.resultadoSeleccionado = '';
        } else {
            window.fr1Estado.resultadoSeleccionado = valorLimpio;
            elemento.classList.add('seleccionada');
        }

        if (window.Director) {
            window.Director.habilitarBotonNavegacion(window.fr1Estado.resultadoSeleccionado !== '');
        }
    },

    obtenerRespuesta() {
        return window.fr1Estado ? window.fr1Estado.resultadoSeleccionado : '';
    },

    calcularPuntaje(respAlumnoStr, resultadoCorrectoStr) {
        const est = window.fr1Estado;
        if (!est || !est.mcmValidado || !est.numeradoresValidados) return 0;

        const valAlumno = String(respAlumnoStr || '').trim().replace(/\s+/g, '').toLowerCase();
        const valCorrecto = String(resultadoCorrectoStr || '').trim().replace(/\s+/g, '').toLowerCase();

        return (valAlumno === valCorrecto) ? 1 : 0;
    }
};

window.EspecialistaFR1 = EspecialistaFR1;
