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

        const { data: alumnos } = await supabase.from('alumnos').select('id').eq('curso_id', cursoId);
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

        // 1. Rendimiento Global
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

        // 2. Bloom Radar
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

        // 3. Distribucion
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

        // 4. Diagnostico
        const selectDiag = document.getElementById('selectTpDiagnostico');
        if (selectDiag) {
            selectDiag.innerHTML = '<option value="">Seleccionar TP para diagnosticar...</option>' +
                planFiltrado.map(p => {
                    const cod = p.cod_tp_completo || p.cod_tp;
                    return `<option value="${cod}">${p.alias_tp || cod}</option>`;
                }).join('');

            if (planFiltrado.length > 0) {
                selectDiag.value = planFiltrado[0].cod_tp_completo || planFiltrado[0].cod_tp;
            }

            const actualizarGraficoDiagnostico = (codSeleccionado) => {
                if (!codSeleccionado) return;

                const respsTp = Object.values(mapaUltimaNotaAlumno)
                    .filter(item => item.tp === codSeleccionado && Array.isArray(item.respuestas))
                    .map(item => item.respuestas);

                if (respsTp.length === 0) {
                    renderizarGrafico('chartDiagnosticoPreguntas', 'bar', {
                        labels: ['Sin datos suficientes'],
                        datasets: [{ label: '% Acierto', data: [0], backgroundColor: '#6c757d' }]
                    });
                    return;
                }

                let listaItemsEvaluados = [];

                respsTp[0].forEach((preg, idxPreg) => {
                    let respObj = preg.respuesta;
                    if (typeof respObj === 'string' && respObj.trim().startsWith('{')) {
                        try { respObj = JSON.parse(respObj); } catch(e){}
                    }

                    if (respObj && typeof respObj === 'object' && !Array.isArray(respObj)) {
                        Object.keys(respObj).forEach((subKey) => {
                            const numFila = parseInt(subKey) + 1;
                            listaItemsEvaluados.push({
                                label: `P${idxPreg + 1} - Ítem ${numFila}`,
                                esSubItem: true,
                                idxPreg: idxPreg,
                                subKey: subKey
                            });
                        });
                    } else {
                        listaItemsEvaluados.push({
                            label: `Pregunta ${idxPreg + 1}`,
                            esSubItem: false,
                            idxPreg: idxPreg
                        });
                    }
                });

                const porcentajesAcierto = listaItemsEvaluados.map(itemSpec => {
                    const aciertos = respsTp.filter(r => {
                        const preg = r[itemSpec.idxPreg];
                        if (!preg) return false;

                        if (itemSpec.esSubItem) {
                            let respAlumno = preg.respuesta;
                            if (typeof respAlumno === 'string' && respAlumno.trim().startsWith('{')) {
                                try { respAlumno = JSON.parse(respAlumno); } catch(e){}
                            }
                            
                            let respCorrecta = preg.correcta;
                            if (typeof respCorrecta === 'string' && respCorrecta.trim().startsWith('{')) {
                                try { respCorrecta = JSON.parse(respCorrecta); } catch(e){}
                            }

                            if (respAlumno && respCorrecta && respAlumno[itemSpec.subKey] !== undefined) {
                                return String(respAlumno[itemSpec.subKey]).trim().toUpperCase() === 
                                       String(respCorrecta[itemSpec.subKey]).trim().toUpperCase();
                            }
                            return false;
                        } else {
                            if (preg.esCorrecta === true || preg.correcta === true || preg.es_correcta === true) return true;
                            if (preg.opcionSeleccionada !== undefined && preg.opcionCorrecta !== undefined) {
                                return preg.opcionSeleccionada === preg.opcionCorrecta;
                            }
                            return false;
                        }
                    }).length;

                    return Math.round((aciertos / respsTp.length) * 100);
                });

                renderizarGrafico('chartDiagnosticoPreguntas', 'bar', {
                    labels: listaItemsEvaluados.map(i => i.label),
                    datasets: [{
                        label: '% Acierto por Ítem / Afirmación',
                        data: porcentajesAcierto,
                        backgroundColor: porcentajesAcierto.map(val => val < 60 ? '#dc3545' : '#0d6efd')
                    }]
                }, { 
                    scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } 
                });
            };

            selectDiag.onchange = (e) => actualizarGraficoDiagnostico(e.target.value);
            if (selectDiag.value) actualizarGraficoDiagnostico(selectDiag.value);
        }

        if (selectFiltroEstructura) {
            selectFiltroEstructura.onchange = () => cargarAnaliticaCurso(cursoId, supabase);
        }

    } catch (err) {
        console.error('Error al cargar analítica:', err);
    }
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
