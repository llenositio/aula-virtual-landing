// js/planificacion.js

let bancoTPsMemoria = [];

export async function cargarPlanificacionCurso(cursoId, supabase, renderizarMatrizFn) {
    const contenedor = document.getElementById('contenedorPlanificacionDocente');
    if (!contenedor) return;

    contenedor.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div><div class="mt-2 text-muted">Cargando planificación...</div></div>';

    try {
        const { data: plan, error } = await supabase
            .from('curso_planificacion')
            .select('*')
            .eq('curso_id', cursoId)
            .order('periodo_evaluativo', { ascending: true })
            .order('unidad_tematica', { ascending: true })
            .order('orden', { ascending: true });

        if (error) throw error;

        if (!plan || plan.length === 0) {
            contenedor.innerHTML = `
                <div class="alert alert-info text-center my-4 p-4 shadow-sm border-0">
                    <h5>📌 Este curso aún no tiene un Plan de Trabajo armado</h5>
                    <p class="text-muted small mb-0">Utilizá la barra superior para definir un Período, Unidad y seleccionar un TP del Banco.</p>
                </div>`;
            return;
        }

        const estructura = {};
        plan.forEach(item => {
            const p = item.periodo_evaluativo || '1° Trimestre';
            const u = item.unidad_tematica || 'Unidad 1';
            if (!estructura[p]) estructura[p] = {};
            if (!estructura[p][u]) estructura[p][u] = [];
            estructura[p][u].push(item);
        });

        let html = '';
        for (const [periodo, unidades] of Object.entries(estructura)) {
            html += `
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-header bg-dark text-white fw-bold py-2 d-flex justify-content-between align-items-center">
                        <span>🗓️ ${periodo}</span>
                        <span class="badge bg-secondary">${Object.keys(unidades).length} Unidad(es)</span>
                    </div>
                    <div class="card-body p-3">`;

            for (const [unidad, tps] of Object.entries(unidades)) {
                html += `
                    <div class="mb-4">
                        <h6 class="fw-bold text-primary border-bottom pb-2">📖 ${unidad}</h6>
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light small">
                                    <tr>
                                        <th>Código Técnico</th>
                                        <th>Alias para el Alumno</th>
                                        <th class="text-center">Estado</th>
                                        <th class="text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>`;

                tps.forEach(tp => {
                    const codigoTecnico = tp.cod_tp_completo || tp.cod_tp;
                    const aliasActual = tp.alias_tp || codigoTecnico;
                    const switchChecked = tp.activo ? 'checked' : '';
                    const badgeEstado = tp.activo 
                        ? '<span class="badge bg-success ms-2">Visible</span>' 
                        : '<span class="badge bg-secondary ms-2">Oculto</span>';

                    html += `
                        <tr>
                            <td><code>${codigoTecnico}</code></td>
                            <td>
                                <div class="input-group input-group-sm" style="max-width: 380px;">
                                    <input type="text" class="form-control" id="alias-input-${tp.id}" value="${aliasActual}">
                                    <button class="btn btn-outline-secondary btn-guardar-alias" data-id="${tp.id}">💾</button>
                                </div>
                            </td>
                            <td class="text-center">
                                <div class="form-check form-switch d-inline-block">
                                    <input class="form-check-input switch-visibilidad-tp" type="checkbox" data-id="${tp.id}" ${switchChecked}>
                                </div>
                                ${badgeEstado}
                            </td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-danger btn-eliminar-tp-plan" data-id="${tp.id}">🗑️ Quitar</button>
                            </td>
                        </tr>`;
                });

                html += `</tbody></table></div></div>`;
            }

            html += `</div></div>`;
        }

        contenedor.innerHTML = html;
        vincularEventosPlanificacion(cursoId, supabase, renderizarMatrizFn);

    } catch (err) {
        console.error('Error al cargar planificación:', err);
        contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar planificación: ${err.message}</div>`;
    }
}

function vincularEventosPlanificacion(cursoId, supabase, renderizarMatrizFn) {
    document.querySelectorAll('.btn-guardar-alias').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const nuevoAlias = document.getElementById(`alias-input-${id}`).value;
            const { error } = await supabase.from('curso_planificacion').update({ alias_tp: nuevoAlias }).eq('id', id);
            if (error) alert('Error: ' + error.message);
            else {
                alert('✅ Alias guardado correctamente.');
                renderizarMatrizFn(cursoId);
            }
        });
    });

    document.querySelectorAll('.switch-visibilidad-tp').forEach(sw => {
        sw.addEventListener('change', async (e) => {
            const id = e.currentTarget.dataset.id;
            const activo = e.currentTarget.checked;
            const { error } = await supabase.from('curso_planificacion').update({ activo }).eq('id', id);
            if (error) { alert('Error: ' + error.message); e.currentTarget.checked = !activo; }
            else {
                cargarPlanificacionCurso(cursoId, supabase, renderizarMatrizFn);
                renderizarMatrizFn(cursoId);
            }
        });
    });

    document.querySelectorAll('.btn-eliminar-tp-plan').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('¿Seguro que querés quitar este TP de la planificación?')) return;
            const id = e.currentTarget.dataset.id;
            const { error } = await supabase.from('curso_planificacion').delete().eq('id', id);
            if (error) alert('Error: ' + error.message);
            else {
                cargarPlanificacionCurso(cursoId, supabase, renderizarMatrizFn);
                renderizarMatrizFn(cursoId);
            }
        });
    });
}

export async function cargarBancoGlobal(supabase) {
    const contenedor = document.getElementById('listaBancoTPs');
    if (!contenedor) return;

    contenedor.innerHTML = `<div class="list-group-item text-center text-muted py-3 small">Cargando catálogo del Banco Global...</div>`;

    try {
        let { data, error } = await supabase
            .from('banco_preguntas')
            .select('cod_tp, cod_tp_completo, titulo_humano, anio, nivel_bloom')
            .order('cod_tp_completo');

        if (error || !data || data.length === 0) {
            const resFallback = await supabase
                .from('tps_matematica')
                .select('cod_tp, cod_tp_completo, titulo_humano, anio, nivel_bloom')
                .order('cod_tp');

            if (!resFallback.error && resFallback.data && resFallback.data.length > 0) {
                data = resFallback.data;
                error = null;
            }
        }

        if (error) throw error;

        const mapaTPs = new Map();
        (data || []).forEach(item => {
            const codigoFinal = item.cod_tp_completo || item.cod_tp;
            if (codigoFinal && !mapaTPs.has(codigoFinal)) {
                mapaTPs.set(codigoFinal, {
                    cod_tp: codigoFinal,
                    titulo: item.titulo_humano || 'Sin Título',
                    anio: item.anio || 1,
                    bloom: item.nivel_bloom || 'Comprender'
                });
            }
        });

        bancoTPsMemoria = Array.from(mapaTPs.values());
        renderizarBancoTPs(bancoTPsMemoria, supabase);

    } catch (err) {
        contenedor.innerHTML = `<div class="list-group-item text-center text-danger py-3 small">Error al conectar con el Banco Global: ${err.message}</div>`;
    }
}

function renderizarBancoTPs(lista, supabase) {
    const contenedor = document.getElementById('listaBancoTPs');
    const contador = document.getElementById('cantTPsEncontrados');
    if (!contenedor) return;

    if (contador) contador.textContent = `${lista.length} disponibles`;

    if (lista.length === 0) {
        contenedor.innerHTML = `<div class="list-group-item text-center text-muted py-4 small">No se encontraron TPs con los criterios ingresados.</div>`;
        return;
    }

    contenedor.innerHTML = lista.map(tp => `
        <div class="list-group-item py-3">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <div class="fw-bold text-dark mb-1">
                        ${tp.titulo}
                        <span class="badge bg-info text-dark ms-2">${tp.bloom}</span>
                        <span class="badge bg-secondary ms-1">${tp.anio}° Año</span>
                    </div>
                    <div class="small text-muted">Código: <code>${tp.cod_tp}</code></div>
                </div>
                <div>
                    <button type="button" class="btn btn-sm btn-outline-secondary me-2 btn-preview-tp" data-cod="${tp.cod_tp}">👁️ Vista Previa</button>
                    <button type="button" class="btn btn-sm btn-primary fw-bold btn-seleccionar-tp" data-cod="${tp.cod_tp}">+ Seleccionar TP</button>
                </div>
            </div>
            <div class="mt-3 p-3 bg-light rounded border" id="preview-${encodeURIComponent(tp.cod_tp)}" style="display: none;">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div> 
                <span class="small text-muted ms-2">Generando ficha pedagógica...</span>
            </div>
        </div>`).join('');

    document.querySelectorAll('.btn-seleccionar-tp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            ejecutarAsignacionTP(e.currentTarget.dataset.cod);
        });
    });

    document.querySelectorAll('.btn-preview-tp').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const codTp = e.currentTarget.dataset.cod;
            const containerPreview = document.getElementById(`preview-${encodeURIComponent(codTp)}`);
            if (!containerPreview) return;

            if (containerPreview.style.display !== 'none') {
                containerPreview.style.display = 'none';
                return;
            }

            containerPreview.style.display = 'block';
            if (containerPreview.dataset.cargado === 'true') return;

            try {
                const { data: preguntas, error } = await supabase
                    .from('banco_preguntas')
                    .select('titulo_humano, consigna, nivel_bloom, especialidad_nivel, N_de_orden_pregunta, tipo, opciones')
                    .or(`cod_tp_completo.eq.${codTp},cod_tp.eq.${codTp}`)
                    .order('N_de_orden_pregunta', { ascending: true });

                if (error) throw error;

                if (!preguntas || preguntas.length === 0) {
                    containerPreview.innerHTML = `<div class="text-muted small">No hay datos suficientes para generar la vista previa.</div>`;
                    return;
                }

                const tituloGeneral = preguntas[0].titulo_humano || 'Trabajo Práctico';
                const especialidad = preguntas[0].especialidad_nivel || 'General';
                const totalPreguntas = preguntas.length;

                let resenaHTML = `
                    <div class="mb-3 p-2 bg-white rounded border-start border-primary border-3 shadow-sm">
                        <h6 class="fw-bold text-primary mb-1">📌 Ficha Pedagógica: ${tituloGeneral}</h6>
                        <p class="small text-dark mb-1">Este trabajo práctico consta de <strong>${totalPreguntas} consignas de evaluación</strong> orientadas al nivel <strong>${especialidad}</strong>.</p>
                    </div>`;

                containerPreview.innerHTML = resenaHTML;
                containerPreview.dataset.cargado = 'true';
                if (window.MathJax && window.MathJax.typesetPromise) { MathJax.typesetPromise(); }

            } catch (err) {
                containerPreview.innerHTML = `<div class="text-danger small">Error al cargar vista previa: ${err.message}</div>`;
            }
        });
    });
}

export function aplicarFiltrosBanco(supabase) {
    const filtroTexto = (document.getElementById('filtroTextoTP')?.value || '').toLowerCase();
    const filtroAnio = document.getElementById('filtroAnioTP')?.value || '';
    const filtroBloom = document.getElementById('filtroBloomTP')?.value || '';

    const resultado = bancoTPsMemoria.filter(tp => {
        const coincideTexto = tp.titulo.toLowerCase().includes(filtroTexto) || tp.cod_tp.toLowerCase().includes(filtroTexto);
        const coincideAnio = !filtroAnio || tp.anio.toString() === filtroAnio;
        const coincideBloom = !filtroBloom || tp.bloom.toLowerCase() === filtroBloom.toLowerCase();
        return coincideTexto && coincideAnio && coincideBloom;
    });

    renderizarBancoTPs(resultado, supabase);
}

export function ejecutarAsignacionTP(codTp) {
    const elemCod = document.getElementById('inputCodTPAsignar');
    const elemTexto = document.getElementById('inputCodTPAsignarTexto');
    if (elemCod) elemCod.value = codTp;
    if (elemTexto) elemTexto.value = codTp;

    const modalEl = document.getElementById('modalAsignarTP');
    if (modalEl) {
        const modalInstance = bootstrap.Modal.getInstance(modalEl);
        if (modalInstance) modalInstance.hide();
    }
}
