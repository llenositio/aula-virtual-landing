// js/planificacion.js

let bancoGlobalTPs = [];

export async function cargarPlanificacionCurso(cursoId, supabase, callbackRenderMatriz) {
    const contenedor = document.getElementById('contenedorPlanificacion');
    if (!contenedor) return;

    try {
        const { data: plan, error } = await supabase
            .from('curso_planificacion')
            .select('*')
            .eq('curso_id', cursoId)
            .order('periodo_evaluativo', { ascending: true })
            .order('unidad_tematica', { ascending: true });

        if (error) throw error;

        if (!plan || plan.length === 0) {
            contenedor.innerHTML = `
                <div class="alert alert-light text-center py-4 border">
                    <p class="text-muted mb-0">No hay Trabajos Prácticos asignados a este curso todavía.</p>
                </div>`;
            return;
        }

        // Agrupar TPs por Período
        const agrupado = {};
        plan.forEach(tp => {
            const periodo = tp.periodo_evaluativo || 'Sin Período Definido';
            if (!agrupado[periodo]) agrupado[periodo] = [];
            agrupado[periodo].push(tp);
        });

        let html = '';
        Object.keys(agrupado).forEach(periodo => {
            html += `
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center py-2 px-3">
                        <h6 class="mb-0 fw-bold">📅 ${periodo}</h6>
                        <span class="badge bg-secondary">${agrupado[periodo].length} TP(s)</span>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light small">
                                    <tr>
                                        <th>Código / Alias</th>
                                        <th>Unidad Temática</th>
                                        <th>Alcance / Asignación</th>
                                        <th>Fecha Vencimiento</th>
                                        <th class="text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>`;

            agrupado[periodo].forEach(tp => {
                const cod = tp.cod_tp_completo || tp.cod_tp;
                const alias = tp.alias_tp || cod;
                const esDiferenciado = Array.isArray(tp.alumnos_asignados) && tp.alumnos_asignados.length > 0;
                const badgeAlcance = esDiferenciado 
                    ? `<span class="badge bg-warning text-dark">🎯 ${tp.alumnos_asignados.length} Alumno(s) Seleccionado(s)</span>`
                    : `<span class="badge bg-info text-dark">👥 Todo el Curso</span>`;

                html += `
                    <tr>
                        <td>
                            <div class="fw-bold text-dark">${alias}</div>
                            <small class="text-muted">${cod}</small>
                        </td>
                        <td>${tp.unidad_tematica || '-'}</td>
                        <td>${badgeAlcance}</td>
                        <td>${tp.fecha_vencimiento ? new Date(tp.fecha_vencimiento).toLocaleDateString() : '<span class="text-muted small">Sin límite</span>'}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-danger btn-eliminar-tp-plan" data-id="${tp.id}" title="Quitar de la planificación">
                                🗑️ Quitar
                            </button>
                        </td>
                    </tr>`;
            });

            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>`;
        });

        contenedor.innerHTML = html;

        // Eventos para eliminar TPs del plan
        document.querySelectorAll('.btn-eliminar-tp-plan').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idTp = e.currentTarget.dataset.id;
                if (confirm('¿Estás seguro de que querés quitar este TP del plan de trabajo?')) {
                    try {
                        const { error: errDel } = await supabase.from('curso_planificacion').delete().eq('id', idTp);
                        if (errDel) throw errDel;
                        cargarPlanificacionCurso(cursoId, supabase, callbackRenderMatriz);
                        if (callbackRenderMatriz) callbackRenderMatriz(cursoId);
                    } catch (err) {
                        alert('Error al quitar TP: ' + err.message);
                    }
                }
            });
        });

    } catch (err) {
        contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar la planificación: ${err.message}</div>`;
    }
}

export async function cargarBancoGlobal(supabase) {
    try {
        const { data, error } = await supabase.from('banco_tp').select('*').order('cod_tp', { ascending: true });
        if (error) throw error;
        bancoGlobalTPs = data || [];
        renderizarBancoGlobal(bancoGlobalTPs, supabase);
    } catch (err) {
        console.error('Error al cargar banco de TPs:', err);
    }
}

export function aplicarFiltrosBanco(supabase) {
    const txt = (document.getElementById('filtroTextoTP')?.value || '').toLowerCase();
    const bloom = document.getElementById('filtroBloomTP')?.value || 'TODOS';
    const anio = document.getElementById('filtroAnioTP')?.value || 'TODOS';

    const filtrados = bancoGlobalTPs.filter(tp => {
        const coincideTxt = !txt || (tp.cod_tp || '').toLowerCase().includes(txt) || 
                            (tp.titulo || '').toLowerCase().includes(txt) || 
                            (tp.descripcion || '').toLowerCase().includes(txt);
        const coincideBloom = bloom === 'TODOS' || tp.nivel_bloom === bloom;
        const coincideAnio = anio === 'TODOS' || String(tp.anio) === anio;
        return coincideTxt && coincideBloom && coincideAnio;
    });

    renderizarBancoGlobal(filtrados, supabase);
}

function renderizarBancoGlobal(lista, supabase) {
    const contenedor = document.getElementById('contenedorListaBancoTP');
    if (!contenedor) return;

    if (lista.length === 0) {
        contenedor.innerHTML = `<div class="text-center text-muted py-4">No se encontraron TPs que coincidan con los filtros.</div>`;
        return;
    }

    contenedor.innerHTML = lista.map(tp => `
        <div class="card mb-2 border shadow-sm">
            <div class="card-body p-3 d-flex justify-content-between align-items-center">
                <div>
                    <span class="badge bg-primary me-2">${tp.cod_tp}</span>
                    <span class="badge bg-outline-secondary border text-dark me-2">${tp.nivel_bloom || 'Nivel General'}</span>
                    <h6 class="fw-bold d-inline text-dark mb-0">${tp.titulo || tp.cod_tp}</h6>
                    <p class="small text-muted mb-0 mt-1">${tp.descripcion ? tp.descripcion.substring(0, 90) + '...' : 'Sin descripción'}</p>
                </div>
                <button class="btn btn-sm btn-success fw-bold btn-seleccionar-tp-banco" data-cod="${tp.cod_tp}" data-titulo="${tp.titulo || tp.cod_tp}">
                    ➕ Seleccionar
                </button>
            </div>
        </div>`).join('');

    document.querySelectorAll('.btn-seleccionar-tp-banco').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cod = e.currentTarget.dataset.cod;
            const inputTarget = document.getElementById('inputCodTPAsignar');
            if (inputTarget) inputTarget.value = cod;

            const modalEl = document.getElementById('modalAsignarTP');
            if (modalEl) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }
        });
    });
}

export async function ejecutarAsignacionTP(cursoId, supabase, callbackExito) {
    const codTp = document.getElementById('inputCodTPAsignar')?.value;
    const periodo = document.getElementById('inputNuevoPeriodo')?.value.trim() || '1° Trimestre';
    const unidad = document.getElementById('inputNuevaUnidad')?.value.trim() || 'Unidad 1';
    const fechaVenc = document.getElementById('inputFechaVencimientoTP')?.value || null;

    // Lógica para detectar si la asignación es a Todo el Curso o Diferenciada
    const radioAlcance = document.querySelector('input[name="radioAlcanceAsignacion"]:checked')?.value || 'TODOS';
    let alumnosSeleccionados = null;

    if (radioAlcance === 'SELECCION') {
        const checkboxes = document.querySelectorAll('.chk-alumno-diferenciado:checked');
        alumnosSeleccionados = Array.from(checkboxes).map(c => c.value);

        if (alumnosSeleccionados.length === 0) {
            alert('Por favor seleccioná al menos un alumno para realizar la asignación diferenciada.');
            return;
        }
    }

    if (!cursoId || !codTp) {
        alert('Por favor seleccioná un TP antes de agregar.');
        return;
    }

    try {
        const { error } = await supabase.from('curso_planificacion').insert([{
            curso_id: cursoId,
            cod_tp: codTp,
            cod_tp_completo: codTp,
            periodo_evaluativo: periodo,
            unidad_tematica: unidad,
            alias_tp: codTp,
            fecha_vencimiento: fechaVenc,
            alumnos_asignados: alumnosSeleccionados, // null si es para todos, array de IDs si es diferenciado
            activo: true
        }]);

        if (error) throw error;

        document.getElementById('inputCodTPAsignar').value = '';
        if (callbackExito) callbackExito();

    } catch (err) {
        alert('Error al asignar TP: ' + err.message);
    }
}
