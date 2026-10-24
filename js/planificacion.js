// js/planificacion.js

let bancoGlobalTPs = [];

// Función auxiliar para extraer el número del código del TP y ordenar secuencialmente
function extraerNumeroCodigo(cod) {
    if (!cod) return 0;
    const match = cod.match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

export async function cargarPlanificacionCurso(cursoId, supabase) {
    const contenedor = document.getElementById('contenedorPlanificacion');
    if (!contenedor) {
        console.error('No se encontró el elemento contenedorPlanificacion');
        return;
    }

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
                <div class="alert alert-light text-center py-4 border my-3">
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
            // Ordenar numéricamente los TPs dentro del período de forma ascendente (001, 002, 005...)
            agrupado[periodo].sort((a, b) => {
                const codA = a.cod_tp_completo || a.cod_tp || '';
                const codB = b.cod_tp_completo || b.cod_tp || '';
                return extraerNumeroCodigo(codA) - extraerNumeroCodigo(codB);
            });

            html += `
                <div class="card border-0 shadow-sm mb-4 my-3">
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
                                        <th>Fecha Vencimiento</th>
                                        <th class="text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>`;

            agrupado[periodo].forEach(tp => {
                const cod = tp.cod_tp_completo || tp.cod_tp || 'TP';
                const alias = tp.alias_tp || cod;
                const fechaVencStr = tp.fecha_vencimiento ? new Date(tp.fecha_vencimiento).toISOString().split('T')[0] : '';

                html += `
                    <tr>
                        <td>
                            <div class="fw-bold text-dark">${alias}</div>
                            <small class="text-muted">${cod}</small>
                        </td>
                        <td>${tp.unidad_tematica || '-'}</td>
                        <td>${tp.fecha_vencimiento ? new Date(tp.fecha_vencimiento).toLocaleDateString() : '<span class="text-muted small">Sin límite</span>'}</td>
                        <td class="text-end">
                            <div class="d-flex justify-content-end gap-1">
                                <button class="btn btn-sm btn-outline-primary btn-editar-plan" 
                                        data-id="${tp.id}" 
                                        data-periodo="${tp.periodo_evaluativo || ''}" 
                                        data-unidad="${tp.unidad_tematica || ''}" 
                                        data-vencimiento="${fechaVencStr}" 
                                        data-nombre="${alias}"
                                        title="Editar detalles o fecha de vencimiento">
                                    ✏️ Editar
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-eliminar-tp-plan" data-id="${tp.id}" title="Quitar de la planificación">
                                    🗑️ Quitar
                                </button>
                            </div>
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

        // Eventos de eliminación
        document.querySelectorAll('.btn-eliminar-tp-plan').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idTp = e.currentTarget.dataset.id;
                if (confirm('¿Estás seguro de que querés quitar este TP del plan de trabajo?')) {
                    try {
                        const { error: errDel } = await supabase.from('curso_planificacion').delete().eq('id', idTp);
                        if (errDel) throw errDel;
                        
                        await cargarPlanificacionCurso(cursoId, supabase);
                        if (typeof window.refrescarMatrizActual === 'function') {
                            window.refrescarMatrizActual();
                        }
                    } catch (err) {
                        alert('Error al quitar TP: ' + err.message);
                    }
                }
            });
        });

    } catch (err) {
        console.error('Error al cargar la planificación:', err);
        contenedor.innerHTML = `
            <div class="alert alert-danger my-3">
                <strong>Error al cargar la planificación:</strong> ${err.message || JSON.stringify(err)}
            </div>`;
    }
}

export async function cargarBancoGlobal(supabase) {
    try {
        const { data, error } = await supabase.from('banco_tp').select('*').order('cod_tp', { ascending: true });
        if (error) throw error;
        
        // Ordenar numéricamente el banco de TPs
        bancoGlobalTPs = (data || []).sort((a, b) => extraerNumeroCodigo(a.cod_tp) - extraerNumeroCodigo(b.cod_tp));
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
    const contenedor = document.getElementById('listaBancoTPs') || document.getElementById('contenedorListaBancoTP');
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
            const titulo = e.currentTarget.dataset.titulo;

            const inputHidden = document.getElementById('inputCodTPAsignar');
            const inputTexto = document.getElementById('inputCodTPAsignarTexto');

            if (inputHidden) inputHidden.value = cod;
            if (inputTexto) inputTexto.value = `${cod} - ${titulo}`;

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

    if (!cursoId || !codTp) {
        alert('Por favor seleccioná un TP antes de agregar.');
        return;
    }

    // Capturar si es asignación a Todo el Curso o Diferenciada
    const radioAlcance = document.querySelector('input[name="radioAlcanceAsignacion"]:checked')?.value;
    let alumnosAsignados = null;

    if (radioAlcance === 'DIFERENCIADO' || radioAlcance === 'SELECCION') {
        const seleccionados = Array.from(document.querySelectorAll('.chk-alumno-diferenciado:checked')).map(cb => cb.value);
        if (seleccionados.length === 0) {
            alert('Has seleccionado Asignación Diferenciada pero no marcaste ningún alumno.');
            return;
        }
        alumnosAsignados = seleccionados;
    }

    try {
        const datosInsert = {
            curso_id: cursoId,
            cod_tp: codTp,
            cod_tp_completo: codTp,
            periodo_evaluativo: periodo,
            unidad_tematica: unidad,
            alias_tp: codTp,
            activo: true,
            alumnos_asignados: alumnosAsignados
        };

        const { error } = await supabase.from('curso_planificacion').insert([datosInsert]);

        if (error) throw error;

        // Limpiar campos del formulario
        const inputHidden = document.getElementById('inputCodTPAsignar');
        const inputTexto = document.getElementById('inputCodTPAsignarTexto');
        if (inputHidden) inputHidden.value = '';
        if (inputTexto) inputTexto.value = '';

        if (callbackExito) callbackExito();

    } catch (err) {
        alert('Error al asignar TP: ' + err.message);
    }
}
