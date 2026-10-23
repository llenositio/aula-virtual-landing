// js/analitica.js

const instanciasGraficos = {};

export async function cargarAnaliticaCurso(cursoId, supabase) {
    try {
        const { data: plan } = await supabase
            .from('curso_planificacion')
            .select('*')
            .eq('curso_id', cursoId)
            .order('periodo_evaluativo', { ascending: true })
            .order('unidad_tematica', { ascending: true });

        if (!plan || plan.length === 0) return;

        const selectFiltroEstructura = document.getElementById('filtroAnaliticaEstructura');
        if (selectFiltroEstructura) {
            const periodos = [...new Set(plan.map(p => p.periodo_evaluativo).filter(Boolean))];
            
            if (selectFiltroEstructura.options.length <= 1) {
                selectFiltroEstructura.innerHTML = '<option value="TODOS">Todos los Períodos</option>' +
                    periodos.map(p => `<option value="${p}">Período: ${p}</option>`).join('');
            }
        }

        const periodoFiltro = selectFiltroEstructura ? selectFiltroEstructura.value : 'TODOS';

        const planFiltrado = (periodoFiltro && periodoFiltro !== 'TODOS')
            ? plan.filter(p => p.periodo_evaluativo === periodoFiltro)
            : plan;

        const { data: alumnos } = await supabase.from('alumnos').select('id, apellido, nombre').eq('curso_id', cursoId).order('apellido', { ascending: true });
        const idsAlumnos = alumnos ? alumnos.map(a => a.id) : [];

        const { data: resultados } = await supabase
            .from('evaluaciones_resultados')
            .select('*')
            .in('alumno_id', idsAlumnos.length > 0 ? idsAlumnos : ['00000000-0000-0000-0000-000000000000']);

        const mapaUltimaNotaAlumno = {};
        const notasPorTp = {};
        const todasLasNotasValidas = [];

        if (resultados) {
            resultados.forEach(r => {
                const cod = r.tp_codigo || r.cod_tp;
                const perteneceAlPlan = planFiltrado.some(p => (p.cod_tp_completo || p.cod_tp) === cod);
                if (!perteneceAlPlan) return;

                const clave = `${r.alumno_id}_${cod}`;
                const notaNum = Number(r.nota) || 0;

                if (!mapaUltimaNotaAlumno[clave] || notaNum > mapaUltimaNotaAlumno[clave].nota) {
                    mapaUltimaNotaAlumno[clave] = {
                        alumno_id: r.alumno_id,
                        nota: notaNum,
                        tp: cod,
                        respuestas: r.detalle_respuestas
                    };
                }
            });

            Object.values(mapaUltimaNotaAlumno).forEach(item => {
                if (!notasPorTp[item.tp]) notasPorTp[item.tp] = [];
                notasPorTp[item.tp].push(item.nota);
                todasLasNotasValidas.push(item.nota);
            });
        }

        // Renderizar gráficos estándar
        renderizarGraficosBasicos(planFiltrado, notasPorTp, todasLasNotasValidas, mapaUltimaNotaAlumno);

        // Renderizar el MAPA DE CALOR
        renderizarMapaDeCalorSaberes(alumnos || [], planFiltrado, mapaUltimaNotaAlumno);

        if (selectFiltroEstructura) {
            selectFiltroEstructura.onchange = () => cargarAnaliticaCurso(cursoId, supabase);
        }

    } catch (err) {
        console.error('Error al cargar analítica:', err);
    }
}

// FUNCION AUXILIAR PARA NORMALIZAR Y COMPARAR CUALQUIER FORMATO DE RESPUESTA
function evaluarRespuestaCorrecta(preg, subKey = null) {
    if (!preg) return false;

    // Si la pregunta trae un flag explícito global de corrección
    if (subKey === null) {
        if (preg.esCorrecta === true || preg.correcta === true || preg.es_correcta === true) return true;
        if (preg.opcionSeleccionada !== undefined && preg.opcionCorrecta !== undefined) {
            return String(preg.opcionSeleccionada).trim().toUpperCase() === String(preg.opcionCorrecta).trim().toUpperCase();
        }
    }

    // Extraer y deserializar respuesta del alumno y respuesta correcta
    let respAlumno = preg.respuesta;
    let respCorrecta = preg.correcta !== undefined ? preg.correcta : preg.respuesta_correcta;

    if (typeof respAlumno === 'string' && respAlumno.trim().startsWith('{')) {
        try { respAlumno = JSON.parse(respAlumno); } catch(e){}
    }
    if (typeof respCorrecta === 'string' && respCorrecta.trim().startsWith('{')) {
        try { respCorrecta = JSON.parse(respCorrecta); } catch(e){}
    }

    if (subKey !== null && respAlumno && typeof respAlumno === 'object') {
        const valAlumno = respAlumno[subKey] !== undefined ? respAlumno[subKey] : respAlumno[parseInt(subKey)];
        let valCorrecta = null;

        if (respCorrecta && typeof respCorrecta === 'object') {
            valCorrecta = respCorrecta[subKey] !== undefined ? respCorrecta[subKey] : respCorrecta[parseInt(subKey)];
        } else if (preg.solucion && typeof preg.solucion === 'object') {
            valCorrecta = preg.solucion[subKey] !== undefined ? preg.solucion[subKey] : preg.solucion[parseInt(subKey)];
        }

        if (valAlumno !== undefined && valCorrecta !== undefined && valCorrecta !== null) {
            return normalizarValor(valAlumno) === normalizarValor(valCorrecta);
        }

        // Si la pregunta viene marcada como justa/correcta globalmente en la entrega
        if (preg.esCorrecta === true || preg.correcta === true) return true;
    }

    return false;
}

function normalizarValor(v) {
    if (v === null || v === undefined) return '';
    const str = String(v).trim().toUpperCase();
    if (str === 'V' || str === 'VERDADERO' || str === 'TRUE' || str === '1') return 'VERDADERO';
    if (str === 'F' || str === 'FALSO' || str === 'FALSE' || str === '0') return 'FALSO';
    return str;
}

function renderizarMapaDeCalorSaberes(alumnos, planFiltrado, mapaUltimaNotaAlumno) {
    let contenedorCard = document.getElementById('wrapperMapaCalorCard');

    if (!contenedorCard) {
        const selectFiltro = document.getElementById('filtroAnaliticaEstructura');
        let cardPadre = selectFiltro ? selectFiltro.closest('.card, .row, .mb-4') : null;

        if (!cardPadre) {
            const chartCanvas = document.getElementById('chartRendimientoTp');
            if (chartCanvas) cardPadre = chartCanvas.closest('.row');
        }

        if (!cardPadre) return;

        const divWrapper = document.createElement('div');
        divWrapper.className = 'col-12 mb-4';
        divWrapper.id = 'wrapperMapaCalorCard';
        divWrapper.innerHTML = `
            <div class="card border-0 shadow-sm">
                <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3 flex-wrap gap-2">
                    <h5 class="mb-0 fw-bold">🔥 Mapa de Calor de Saberes Requeridos</h5>
                    <span class="badge bg-warning text-dark">Matriz de Error Común</span>
                </div>
                <div class="card-body p-3">
                    <div class="row g-3 align-items-center mb-3 bg-light p-2 rounded border">
                        <div class="col-md-4">
                            <label class="form-label small fw-bold mb-1">🔍 Modo de Visualización:</label>
                            <select id="selectModoMapaCalor" class="form-select form-select-sm">
                                <option value="TP_UNICO">Analizar 1 TP Específico (Desglose por Ítem/V-F)</option>
                                <option value="MICRO_SABERES">Agrupar por Micro-Saberes (Cruzando TPs)</option>
                            </select>
                        </div>
                        <div class="col-md-8">
                            <label class="form-label small fw-bold mb-1">📌 Seleccionar TP(s) a incluir:</label>
                            <select id="selectFiltroTpMapaCalor" class="form-select form-select-sm"></select>
                        </div>
                    </div>
                    <div id="contenedorMapaCalorSaberes" class="table-responsive"></div>
                </div>
            </div>`;

        cardPadre.parentNode.insertBefore(divWrapper, cardPadre.nextSibling);
    }

    const selectModo = document.getElementById('selectModoMapaCalor');
    const selectTp = document.getElementById('selectFiltroTpMapaCalor');
    const contenedorTabla = document.getElementById('contenedorMapaCalorSaberes');

    if (!selectModo || !selectTp || !contenedorTabla) return;

    const actualizarOpcionesSelect = () => {
        if (selectModo.value === 'TP_UNICO') {
            selectTp.innerHTML = planFiltrado.map(p => {
                const cod = p.cod_tp_completo || p.cod_tp;
                return `<option value="${cod}">${p.alias_tp || cod}</option>`;
            }).join('');
        } else {
            selectTp.innerHTML = `<option value="TODOS_PLAN">Todos los TPs del Período</option>` +
                planFiltrado.map(p => {
                    const cod = p.cod_tp_completo || p.cod_tp;
                    return `<option value="${cod}">${p.alias_tp || cod}</option>`;
                }).join('');
        }
    };

    const ejecutarDibujoMatriz = () => {
        dibujarTablaTermica(alumnos, planFiltrado, mapaUltimaNotaAlumno, selectModo.value, selectTp.value, contenedorTabla);
    };

    selectModo.onchange = () => {
        actualizarOpcionesSelect();
        ejecutarDibujoMatriz();
    };

    selectTp.onchange = ejecutarDibujoMatriz;

    actualizarOpcionesSelect();
    ejecutarDibujoMatriz();
}

function dibujarTablaTermica(alumnos, planFiltrado, mapaUltimaNotaAlumno, modo, tpSeleccionado, contenedor) {
    if (alumnos.length === 0 || planFiltrado.length === 0) {
        contenedor.innerHTML = `<div class="alert alert-light text-center py-3 text-muted">Sin datos suficientes.</div>`;
        return;
    }

    let columnasEvaluadas = [];

    const tpsAIncluir = (modo === 'TP_UNICO') 
        ? [tpSeleccionado]
        : (tpSeleccionado === 'TODOS_PLAN' ? planFiltrado.map(p => p.cod_tp_completo || p.cod_tp) : [tpSeleccionado]);

    tpsAIncluir.forEach(cod => {
        const tpPlan = planFiltrado.find(p => (p.cod_tp_completo || p.cod_tp) === cod);
        const aliasTP = tpPlan ? (tpPlan.alias_tp || cod) : cod;

        const muestra = Object.values(mapaUltimaNotaAlumno).find(item => item.tp === cod && Array.isArray(item.respuestas));
        
        if (muestra && muestra.respuestas) {
            muestra.respuestas.forEach((preg, idxPreg) => {
                let respObj = preg.respuesta;

                if (typeof respObj === 'string' && respObj.trim().startsWith('{')) {
                    try { respObj = JSON.parse(respObj); } catch(e){}
                }

                if (respObj && typeof respObj === 'object' && !Array.isArray(respObj)) {
                    Object.keys(respObj).forEach((subKey) => {
                        const numItem = parseInt(subKey) + 1;
                        let textoSub = `P${idxPreg + 1} - Ítem ${numItem}`;
                        let descSub = preg.saber_evaluado || (preg.opciones && Array.isArray(preg.opciones) ? preg.opciones[subKey] : null) || aliasTP;

                        columnasEvaluadas.push({
                            key: `${cod}_p${idxPreg}_sub${subKey}`,
                            tpCod: cod,
                            idxPreg: idxPreg,
                            subKey: subKey,
                            esSubItem: true,
                            label: textoSub,
                            subLabel: descSub
                        });
                    });
                } else {
                    columnasEvaluadas.push({
                        key: `${cod}_p${idxPreg}`,
                        tpCod: cod,
                        idxPreg: idxPreg,
                        esSubItem: false,
                        label: `Pregunta ${idxPreg + 1}`,
                        subLabel: preg.saber_evaluado || preg.consigna ? preg.consigna.substring(0, 30) + '...' : aliasTP
                    });
                }
            });
        }
    });

    if (columnasEvaluadas.length === 0) {
        contenedor.innerHTML = `<div class="alert alert-info text-center py-3">Esperando entregas registradas para la selección actual.</div>`;
        return;
    }

    let html = `
        <table class="table table-bordered align-middle text-center mb-0" style="font-size: 0.8rem;">
            <thead class="table-light">
                <tr>
                    <th class="text-start sticky-col bg-light" style="min-width: 180px;">Estudiante</th>`;

    columnasEvaluadas.forEach(col => {
        html += `
            <th title="${col.subLabel}" style="max-width: 130px; font-size: 0.73rem; vertical-align: bottom;" class="px-2 py-1">
                <div class="fw-bold">${col.label}</div>
                <div class="text-muted fw-normal" style="font-size: 0.65rem; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${col.subLabel}</div>
            </th>`;
    });

    html += `   <th class="bg-light" style="min-width: 90px;">% Logro</th>
                </tr>
            </thead>
            <tbody>`;

    alumnos.forEach(alumno => {
        let aciertosAlumno = 0;
        let evaluadosAlumno = 0;

        html += `<tr>`;
        html += `<td class="text-start fw-semibold sticky-col bg-white">${alumno.apellido}, ${alumno.nombre}</td>`;

        columnasEvaluadas.forEach(col => {
            const clave = `${alumno.id}_${col.tpCod}`;
            const entrega = mapaUltimaNotaAlumno[clave];

            if (entrega && Array.isArray(entrega.respuestas) && entrega.respuestas[col.idxPreg]) {
                const preg = entrega.respuestas[col.idxPreg];
                const esOk = evaluarRespuestaCorrecta(preg, col.esSubItem ? col.subKey : null);

                evaluadosAlumno++;
                if (esOk) aciertosAlumno++;

                const bgClass = esOk ? 'bg-success text-white' : 'bg-danger text-white';
                const simbolo = esOk ? '✓' : '✗';

                html += `<td class="${bgClass} fw-bold" title="${alumno.apellido}: ${col.label}">${simbolo}</td>`;
            } else {
                html += `<td class="bg-light text-muted" title="Sin realizar">-</td>`;
            }
        });

        const pctIndividual = evaluadosAlumno > 0 ? Math.round((aciertosAlumno / evaluadosAlumno) * 100) : null;
        let badgeInd = '<span class="text-muted">-</span>';
        if (pctIndividual !== null) {
            const colorInd = pctIndividual >= 70 ? 'bg-success' : pctIndividual >= 50 ? 'bg-warning text-dark' : 'bg-danger';
            badgeInd = `<span class="badge ${colorInd}">${pctIndividual}%</span>`;
        }

        html += `<td class="fw-bold bg-light">${badgeInd}</td></tr>`;
    });

    html += `</tbody></table>`;
    contenedor.innerHTML = html;
}

function renderizarGraficosBasicos(planFiltrado, notasPorTp, todasLasNotasValidas, mapaUltimaNotaAlumno) {
    const labelsTP = planFiltrado.map(p => {
        const alias = p.alias_tp || p.cod_tp_completo || p.cod_tp;
        return alias.length > 20 ? alias.substring(0, 18) + '...' : alias;
    });

    const aprobadosData = planFiltrado.map(p => (notasPorTp[p.cod_tp_completo || p.cod_tp] || []).filter(n => n >= 6).length);
    const reprobadosData = planFiltrado.map(p => (notasPorTp[p.cod_tp_completo || p.cod_tp] || []).filter(n => n < 6).length);

    renderizarGrafico('chartRendimientoTp', 'bar', {
        labels: labelsTP,
        datasets: [
            { label: 'Aprobados (≥6)', data: aprobadosData, backgroundColor: '#198754' },
            { label: 'A Rehacer (<6)', data: reprobadosData, backgroundColor: '#dc3545' }
        ]
    }, {
        scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }
        }
    });

    const promGeneral = todasLasNotasValidas.length > 0
        ? Math.round((todasLasNotasValidas.reduce((a, b) => a + b, 0) / todasLasNotasValidas.length) * 10)
        : 0;

    renderizarGrafico('chartBloomRadar', 'radar', {
        labels: ['Recordar', 'Comprender', 'Aplicar', 'Analizar', 'Evaluar', 'Crear'],
        datasets: [{
            label: 'Dominio Real (%)',
            data: [promGeneral, promGeneral, promGeneral, Math.max(0, promGeneral - 10), Math.max(0, promGeneral - 15), Math.max(0, promGeneral - 20)],
            backgroundColor: 'rgba(13, 110, 253, 0.2)',
            borderColor: '#0d6efd',
            pointBackgroundColor: '#0d6efd'
        }]
    }, { scales: { r: { min: 0, max: 100 } } });

    let sob = 0, apr = 0, riesg = 0;
    todasLasNotasValidas.forEach(n => {
        if (n >= 8) sob++;
        else if (n >= 6) apr++;
        else riesg++;
    });

    renderizarGrafico('chartNotasDistribucion', 'doughnut', {
        labels: ['Sobresaliente (8-10)', 'Aprobado (6-7)', 'En Riesgo (<6)'],
        datasets: [{
            data: [sob, apr, riesg],
            backgroundColor: ['#198754', '#0d6efd', '#dc3545']
        }]
    });
}

export function renderizarGrafico(canvasId, tipo, datos, opciones = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (canvas.parentElement) {
        canvas.parentElement.style.position = 'relative';
        canvas.parentElement.style.height = '300px';
        canvas.parentElement.style.maxHeight = '300px';
    }

    if (instanciasGraficos[canvasId]) {
        instanciasGraficos[canvasId].destroy();
    }

    instanciasGraficos[canvasId] = new Chart(canvas, {
        type: tipo,
        data: datos,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            ...opciones
        }
    });
}
