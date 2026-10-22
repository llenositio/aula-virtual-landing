// js/especialista_cv.js - Especialista para Casillas de Verificación (CV)

export function renderizarCV(p, indiceActual, totalPreguntas) {
    // Inicializar el arreglo de respuestas del alumno para esta pregunta
    if (!window.respuestasCV) {
        window.respuestasCV = {};
    }
    if (!window.respuestasCV[p.id]) {
        window.respuestasCV[p.id] = [];
    }

    const opciones = Array.isArray(p.opciones) 
        ? p.opciones 
        : (typeof p.opciones === 'string' ? p.opciones.split(',,,').map(o => o.trim()) : []);

    let html = `
        <div class="pregunta-cv-container" style="max-width: 600px; margin: 0 auto;">
            <p style="text-align: center; color: #555; font-size: 0.95rem; margin-bottom: 8px;">
                Seleccioná todas las correctas
            </p>
            <div style="font-size: 1.1rem; margin: 15px 0 25px 0; text-align: center; color: #333;">
                ${window.renderizarContenidoInteligente ? window.renderizarContenidoInteligente(p.enunciado || p.consigna, true) : (p.enunciado || p.consigna)}
            </div>

            <div class="grid-cv" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
    `;

    opciones.forEach((opt, idx) => {
        const estaSeleccionada = window.respuestasCV[p.id].includes(opt);
        const claseSeleccionada = estaSeleccionada ? 'seleccionada' : '';
        
        html += `
            <div class="tarjeta-cv ${claseSeleccionada}" 
                 id="cv_opt_${idx}" 
                 onclick="window.toggleOpcionCV('${p.id}', '${opt.replace(/'/g, "\\'")}', this)"
                 style="border: 2px solid ${estaSeleccionada ? '#2563eb' : '#e2e8f0'}; 
                        border-radius: 10px; 
                        padding: 20px 10px; 
                        text-align: center; 
                        cursor: pointer; 
                        background: ${estaSeleccionada ? '#eff6ff' : '#ffffff'}; 
                        transition: all 0.2s ease;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.03);
                        font-size: 1.1rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 80px;">
                ${window.renderizarContenidoInteligente ? window.renderizarContenidoInteligente(opt) : opt}
            </div>
        `;
    });

    html += `</div></div>`;
    return html;
}

// Función global para conmutar la selección de cada casilla
window.toggleOpcionCV = function(preguntaId, valor, el) {
    if (!window.respuestasCV[preguntaId]) {
        window.respuestasCV[preguntaId] = [];
    }

    const arr = window.respuestasCV[preguntaId];
    const index = arr.indexOf(valor);

    if (index > -1) {
        arr.splice(index, 1);
        el.style.border = '2px solid #e2e8f0';
        el.style.background = '#ffffff';
    } else {
        arr.push(valor);
        el.style.border = '2px solid #2563eb';
        el.style.background = '#eff6ff';
    }

    // Habilitar / deshabilitar botón Siguiente según si seleccionó al menos 1
    const btnSig = document.getElementById('btnSig') || document.getElementById('btnSiguiente');
    if (btnSig) {
        btnSig.disabled = (arr.length === 0);
    }

    // Guardar respuesta en la matriz global de entregas
    if (window.respuestasFinales) {
        window.respuestasFinales[preguntaId] = arr.join(', ');
    }
};
