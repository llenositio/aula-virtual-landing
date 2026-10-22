// js/especialista_rm.js - Especialista para Relación / Tarjetas Interactivas (RM)

const EspecialistaRM = {
    normalizar(pRaw) {
        let opciones = [];
        const rawOpciones = pRaw.opciones || pRaw.opciones_respuesta || '';
        if (Array.isArray(rawOpciones)) {
            opciones = rawOpciones.map(o => String(o).trim());
        } else if (typeof rawOpciones === 'string') {
            opciones = rawOpciones.split(',,,').map(o => o.trim()).filter(o => o !== '');
        }

        return {
            id: pRaw.id || pRaw.N_de_orden_pregunta || 'preg_rm',
            consigna: pRaw.consigna || pRaw.enunciado || 'Seleccioná la correcta:',
            opciones: opciones,
            correcta: String(pRaw.respuesta_correcta || pRaw.correcta || '').trim()
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
        window.respuestaRMActual = respGuardada || '';

        let html = `
            <div class="pregunta-rm-container" style="max-width: 600px; margin: 0 auto;">
                <p style="text-align: center; color: #64748b; font-size: 0.9rem; margin-bottom: 8px;">
                    Seleccioná la correcta
                </p>
                <div style="font-size: 1.1rem; font-weight: 600; margin: 15px 0 25px 0; text-align: center; color: #1e293b;">
                    ${this.renderTextoConImagen(pNormalizada.consigna)}
                </div>

                <div class="grid-cv">
        `;

        pNormalizada.opciones.forEach((opt, idx) => {
            const estaSeleccionada = (window.respuestaRMActual.trim() === opt.trim());
            const claseSel = estaSeleccionada ? 'seleccionada' : '';
            // Escapamos comillas dobles para guardarlo de manera 100% segura en el HTML
            const optAttribute = opt.replace(/"/g, '&quot;');

            html += `
                <div class="tarjeta-cv ${claseSel}" 
                     id="rm_opt_${idx}" 
                     data-valor="${optAttribute}"
                     onclick="window.EspecialistaRM.seleccionar(this)">
                    ${this.renderTextoConImagen(opt)}
                </div>
            `;
        });

        html += `</div></div>`;
        return html;
    },

    seleccionar(elemento) {
        // Leemos el valor directo desde el atributo dataset para preservar intactos los carácteres como la '\' de LaTeX
        const valorLimpio = elemento.getAttribute('data-valor') || '';

        // 1. Desmarcar todas las demás tarjetas
        document.querySelectorAll('.grid-cv .tarjeta-cv').forEach(el => el.classList.remove('seleccionada'));

        // 2. Si vuelve a tocar la misma, la desmarca; si toca otra, la marca (Selección Única)
        if (window.respuestaRMActual === valorLimpio) {
            window.respuestaRMActual = '';
        } else {
            window.respuestaRMActual = valorLimpio;
            elemento.classList.add('seleccionada');
        }

        // 3. Habilita botón Siguiente si hay una selección
        if (window.Director) {
            window.Director.habilitarBotonNavegacion(window.respuestaRMActual !== '');
        }
    },

    obtenerRespuesta() {
        return window.respuestaRMActual || '';
    },

    calcularPuntaje(respAlumnoStr, correctaStr) {
        if (!respAlumnoStr || !correctaStr) return 0;
        return (String(respAlumnoStr).trim() === String(correctaStr).trim()) ? 1 : 0;
    }
};

window.EspecialistaRM = EspecialistaRM;
