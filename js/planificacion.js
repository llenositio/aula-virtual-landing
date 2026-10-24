// js/planificacion.js

let bancoGlobalTPs = [];

// Diccionario de facetas y sinónimos pedagógicos para el motor de búsqueda
const DICCIONARIO_FACETAS = {
    'fracciones': ['fraccion', 'fracciones', 'racionales', 'racional', 'densidad', 'simplificación', 'simplificacion', 'numerador', 'denominador', 'mínimo común múltiplo', 'mcm'],
    'racionales': ['fraccion', 'fracciones', 'racionales', 'racional', 'densidad', 'simplificación', 'simplificacion'],
    'ecuaciones': ['ecuacion', 'ecuaciones', 'incógnita', 'incognita', 'despeje', 'primer grado', 'segundo grado', 'sistema de ecuaciones'],
    'geometria': ['geometría', 'geometria', 'triángulos', 'triangulos', 'ángulos', 'angulos', 'perímetro', 'perimetro', 'área', 'area', 'pitágoras', 'pitagoras'],
    'funciones': ['función', 'funcion', 'lineal', 'cuadrática', 'cuadratica', 'dominio', 'imagen', 'pendiente', 'ordenada', 'gráfico'],
    'porcentaje': ['porcentaje', 'proporcionalidad', 'regla de tres', 'descuento', 'recargo', 'razón', 'razon'],
    'potenciación': ['potencia', 'potenciacion', 'potenciación', 'exponente', 'radicación', 'radicacion', 'raíz', 'raiz']
};

// Función auxiliar para extraer el número del código del TP y ordenar secuencialmente
function extraerNumeroCodigo(cod) {
    if (!cod) return 0;
    const match = String(cod).match(/\d+/);
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
            // Ordenar numéricamente los TPs dentro del período de forma ascendente
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

export async function iniciarUIAsignacionDiferenciada(cursoId, supabase) {
    const contenedorBarra = document.querySelector('#panel-planificacion .card-body');
    if (!contenedorBarra || document.getElementById('wrapperAlcanceAsignacion')) return;

    const divAlcance = document.createElement('div');
    divAlcance.id = 'wrapperAlcanceAsignacion';
    divAlcance.className = 'bg-light p-3 rounded mb-3 border';
    divAlcance.innerHTML = `
        <label class="form-label fw-bold small text-muted d-block mb-2">👥 Alcance de la Asignación:</label>
        <div class="d-flex align-items-center gap-4 small mb-2">
            <div class="form-check">
                <input class="form-check-input" type="radio" name="radioAlcanceAsignacion" id="radioAsignarTodoCurso" value="CURSO" checked>
                <label class="form-check-label fw-semibold" for="radioAsignarTodoCurso">
                    Asignar a Todo el Curso
                </label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="radioAlcanceAsignacion" id="radioAsignarDiferenciado" value="DIFERENCIADO">
                <label class="form-check-label fw-semibold" for="radioAsignarDiferenciado">
                    🎯 Asignación Diferenciada (Seleccionar Alumnos)
                </label>
            </div>
        </div>
        <div id="contenedorListaAlumnosDiferenciados" class="d-none border-top pt-2 mt-2">
            <small class="text-muted d-block mb-2">Marque los alumnos que deberán resolver este TP:</small>
            <div id="gridCheckboxesAlumnos" class="row g-2 max-vh-25 overflow-auto">
                <div class="col-12 text-muted small">Cargando nómina...</div>
            </div>
        </div>
    `;

    const filaCampos = contenedorBarra.querySelector('.row');
    if (filaCampos) {
        contenedorBarra.insertBefore(divAlcance, filaCampos);
    }

    const radios = divAlcance.querySelectorAll('input[name="radioAlcanceAsignacion"]');
    const panelAlumnos = divAlcance.querySelector('#contenedorListaAlumnosDiferenciados');
    const gridAlumnos = divAlcance.querySelector('#gridCheckboxesAlumnos');

    radios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const esDiferenciado = e.target.value === 'DIFERENCIADO';
            panelAlumnos.classList.toggle('d-none', !esDiferenciado);

            if (esDiferenciado && gridAlumnos) {
                try {
                    const { data: alumnos, error } = await supabase
                        .from('alumnos')
                        .select('id, apellido, nombre')
                        .eq('curso_id', cursoId)
                        .order('apellido', { ascending: true });

                    if (error) throw error;

                    if (!alumnos || alumnos.length === 0) {
                        gridAlumnos.innerHTML = `<div class="col-12 text-muted small py-2">No hay alumnos inscriptos en este curso.</div>`;
                        return;
                    }

                    gridAlumnos.innerHTML = alumnos.map(a => `
                        <div class="col-md-4 col-sm-6">
                            <div class="form-check small">
                                <input class="form-check-input chk-alumno-diferenciado" type="checkbox" value="${a.id}" id="chk_alum_${a.id}">
                                <label class="form-check-label text-truncate" for="chk_alum_${a.id}" title="${a.apellido}, ${a.nombre}">
                                    ${a.apellido}, ${a.nombre}
                                </label>
                            </div>
                        </div>
                    `).join('');
                } catch (err) {
                    gridAlumnos.innerHTML = `<div class="col-12 text-danger small">Error al cargar nómina: ${err.message}</div>`;
                }
            }
        });
    });
}

export async function cargarBancoGlobal(supabase) {
    try {
        const { data, error } = await supabase.from('banco_tp').select('*').order('cod_tp', { ascending: true });
        if (error) throw error;
        
        bancoGlobalTPs = (data || []).sort((a, b) => extraerNumeroCodigo(a.cod_tp) - extraerNumeroCodigo(b.cod_tp));
        renderizarBancoGlobal(bancoGlobalTPs, supabase);
    } catch (err) {
        console.error('Error al cargar banco de TPs:', err);
    }
}

export function aplicarFiltrosBanco(supabase) {
    const inputTexto = (document.getElementById('filtroTextoTP')?.value || '').trim().toLowerCase();
    const bloom = document.getElementById('filtroBloomTP')?.value || 'TODOS';
    const anio = document.getElementById('filtroAnioTP')?.value || 'TODOS';

    // 1. Separar el texto ingresado por comas o espacios en palabras sueltas
    const palabrasIngresadas = inputTexto.split(/[\s,]+/).filter(p => p.length > 0);

    // 2. Expandir los términos con el diccionario de facetas
    let terminosBusqueda = [...palabrasIngresadas];
    palabrasIngresadas.forEach(palabra => {
        Object.keys(DICCIONARIO_FACETAS).forEach(clave => {
            if (clave.includes(palabra) || palabra.includes(clave)) {
                terminosBusqueda = [...terminosBusqueda, ...DICCIONARIO_FACETAS[clave]];
            }
        });
    });
    terminosBusqueda = Array.from(new Set(terminosBusqueda));

    const filtrados = bancoGlobalTPs.filter(tp => {
        const cod = (tp.cod_tp || '').toLowerCase();
        // Mapea tanto 'titulo_humano' como 'titulo' para dar soporte al esquema Supabase
        const titulo = (tp.titulo_humano || tp.titulo || '').toLowerCase();
        const descripcion = (tp.descripcion || '').toLowerCase();
        const saberes = (tp.saberes_evaluados || tp.temas || []).toString().toLowerCase();

        // Coincide si alguna de las palabras clave está presente en algún campo
        const coincideTxt = palabrasIngresadas.length === 0 || terminosBusqueda.some(termino => 
            cod.includes(termino) || 
            titulo.includes(termino) || 
            descripcion.includes(termino) ||
            saberes.includes(termino)
        );

        const coincideBloom = bloom === 'TODOS' || tp.nivel_bloom === bloom;
        const coincideAnio = anio === 'TODOS' || String(tp.anio) === anio;

        return coincideTxt && coincideBloom && coincideAnio;
    });

    renderizarBancoGlobal(filtrados, supabase);
}

function renderizarBancoGlobal(lista, supabase) {
    const contenedor = document.getElementById('listaBancoTPs') || document.getElementById('contenedorListaBancoTP');
    const cantEl = document.getElementById('cantTPsEncontrados');
    
    if (cantEl) {
        cantEl.innerText = `${lista.length} disponibles`;
    }

    if (!contenedor) return;

    if (lista.length === 0) {
        contenedor.innerHTML = '<div class="text-center text-muted py-4">No se encontraron TPs que coincidan con los filtros.</div>';
        return;
    }

    const tarjetasHtml = lista.map(tp => {
        const cod = tp.cod_tp || '';
        const titulo = tp.titulo_humano || tp.titulo || cod;
        const bloom = tp.nivel_bloom || 'Nivel General';
        const desc = tp.descripcion ? (tp.descripcion.substring(0, 90) + '...') : 'Sin descripción';

        return '<div class="card mb-2 border shadow-sm">' +
            '<div class="card-body p-3 d-flex justify-content-between align-items-center">' +
                '<div>' +
                    '<span class="badge bg-primary me-2">' + cod + '</span>' +
                    '<span class="badge bg-outline-secondary border text-dark me-2">' + bloom + '</span>' +
                    '<h6 class="fw-bold d-inline text-dark mb-0">' + titulo + '</h6>' +
                    '<p class="small text-muted mb-0 mt-1">' + desc + '</p>' +
                '</div>' +
                '<div class="d-flex gap-2">' +
                    '<button class="btn btn-sm btn-outline-info fw-bold btn-inspeccionar-tp-banco" data-cod="' + cod + '">' +
                        '👁️ Inspeccionar' +
                    '</button>' +
                    '<button class="btn btn-sm btn-success fw-bold btn-seleccionar-tp-banco" data-cod="' + cod + '" data-titulo="' + titulo + '">' +
                        '➕ Seleccionar' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join('');

    contenedor.innerHTML = tarjetasHtml;

    document.querySelectorAll('.btn-seleccionar-tp-banco').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cod = e.currentTarget.dataset.cod;
            const titulo = e.currentTarget.dataset.titulo;
            seleccionarTPParaPlan(cod, titulo);
        });
    });

    document.querySelectorAll('.btn-inspeccionar-tp-banco').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cod = e.currentTarget.dataset.cod;
            const tpObj = bancoGlobalTPs.find(t => t.cod_tp === cod);
            if (tpObj) {
                abrirExploradorDrawer(tpObj, supabase);
            }
        });
    });
}

function seleccionarTPParaPlan(cod, titulo) {
    const inputHidden = document.getElementById('inputCodTPAsignar');
    const inputTexto = document.getElementById('inputCodTPAsignarTexto');

    if (inputHidden) inputHidden.value = cod;
    if (inputTexto) inputTexto.value = cod + ' - ' + titulo;

    const modalEl = document.getElementById('modalAsignarTP');
    if (modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
    }

    const drawerEl = document.getElementById('drawerExploradorTP');
    if (drawerEl) {
        const drawer = bootstrap.Offcanvas.getInstance(drawerEl);
        if (drawer) drawer.hide();
    }
}

async function abrirExploradorDrawer(tp, supabase) {
    const drawerEl = document.getElementById('drawerExploradorTP');
    if (!drawerEl) return;

    const tituloMostrar = tp.titulo_humano || tp.titulo || tp.cod_tp;

    document.getElementById('drawerBadgeCodTP').innerText = tp.cod_tp;
    document.getElementById('drawerTituloTP').innerText = tituloMostrar;
    document.getElementById('drawerNivelBloom').innerText = 'Bloom: ' + (tp.nivel_bloom || 'General');
    document.getElementById('drawerAnioNivel').innerText = tp.anio ? (tp.anio + '° Año') : 'Nivel Secundario';
    document.getElementById('drawerDescripcionTP').innerText = tp.descripcion || 'Sin descripción disponible.';

    const btnSeleccionar = document.getElementById('btnDrawerSeleccionarTP');
    if (btnSeleccionar) {
        btnSeleccionar.onclick = () => seleccionarTPParaPlan(tp.cod_tp, tituloMostrar);
    }

    const contConsignas = document.getElementById('contenedorDrawerConsignas');
    const contRespuestas = document.getElementById('contenedorDrawerRespuestas');
    const contSaberes = document.getElementById('contenedorDrawerSaberes');

    contConsignas.innerHTML = '<div class="text-center py-4 text-muted small"><div class="spinner-border spinner-border-sm me-2"></div>Cargando consignas...</div>';
    contRespuestas.innerHTML = '<div class="text-center py-4 text-muted small"><div class="spinner-border spinner-border-sm me-2"></div>Cargando respuestas...</div>';
    contSaberes.innerHTML = '<div class="text-center py-4 text-muted small"><div class="spinner-border spinner-border-sm me-2"></div>Cargando matriz...</div>';

    const bsOffcanvas = new bootstrap.Offcanvas(drawerEl);
    bsOffcanvas.show();

    try {
        const { data: preguntas, error } = await supabase
            .from('banco_preguntas')
            .select('*')
            .eq('cod_tp', tp.cod_tp)
            .order('orden', { ascending: true });

        if (error) throw error;

        if (!preguntas || preguntas.length === 0) {
            contConsignas.innerHTML = '<div class="alert alert-light text-center small text-muted">No se encontraron consignas registradas para este TP.</div>';
            contRespuestas.innerHTML = '<div class="alert alert-light text-center small text-muted">Sin clave de respuestas.</div>';
            contSaberes.innerHTML = '<div class="alert alert-light text-center small text-muted">Sin saberes catalogados.</div>';
            return;
        }

        contConsignas.innerHTML = preguntas.map((p, idx) => {
            let opcionesHtml = '';
            if (p.opciones && Array.isArray(p.opciones)) {
                opcionesHtml = '<ul class="list-group list-group-flush small">' +
                    p.opciones.map(o => '<li class="list-group-item px-2 py-1 bg-light">' + o + '</li>').join('') +
                '</ul>';
            }
            return '<div class="card border-0 shadow-sm p-3 bg-white">' +
                '<div class="fw-bold text-dark mb-1">Pregunta ' + (idx + 1) + '</div>' +
                '<div class="small text-dark mb-2">' + (p.consigna || 'Consigna en formato interactivo') + '</div>' +
                opcionesHtml +
            '</div>';
        }).join('');

        contRespuestas.innerHTML = preguntas.map((p, idx) => {
            const exp = p.explicacion ? '<p class="text-muted mb-0 mt-1 fst-italic">' + p.explicacion + '</p>' : '';
            return '<div class="border-bottom pb-2 mb-2 small">' +
                '<span class="fw-bold text-dark">P' + (idx + 1) + ':</span> ' +
                '<span class="badge bg-success">' + (p.respuesta_correcta || p.correcta || 'Verificación en sistema') + '</span>' +
                exp +
            '</div>';
        }).join('');

        const saberesSet = new Set(preguntas.map(p => p.saber_evaluado).filter(Boolean));
        if (saberesSet.size > 0) {
            contSaberes.innerHTML = '<h6 class="fw-bold text-primary small mb-2">Micro-competencias evaluadas:</h6>' +
                '<ul class="mb-0 ps-3 small text-muted">' +
                    Array.from(saberesSet).map(s => '<li class="mb-1"><strong>' + s + '</strong></li>').join('') +
                '</ul>';
        } else {
            contSaberes.innerHTML = '<div class="text-muted small">Este TP evalúa contenidos generales del nivel.</div>';
        }

        if (window.MathJax && typeof window.MathJax.typesetPromise === 'function') {
            window.MathJax.typesetPromise([drawerEl]);
        }

    } catch (err) {
        console.error('Error al cargar detalle del TP:', err);
        contConsignas.innerHTML = '<div class="alert alert-danger small">Error al cargar consignas: ' + err.message + '</div>';
    }
}

export async function ejecutarAsignacionTP(cursoId, supabase, callbackExito) {
    const codTp = document.getElementById('inputCodTPAsignar')?.value;
    const periodo = document.getElementById('inputNuevoPeriodo')?.value.trim() || '1° Trimestre';
    const unidad = document.getElementById('inputNuevaUnidad')?.value.trim() || 'Unidad 1';

    if (!cursoId || !codTp) {
        alert('Por favor seleccioná un TP antes de agregar.');
        return;
    }

    const radioAlcance = document.querySelector('input[name="radioAlcanceAsignacion"]:checked')?.value;
    let alumnosAsignados = null;

    if (radioAlcance === 'DIFERENCIADO' || radioAlcance === 'SELECCION') {
        const seleccionados = Array.from(document.querySelectorAll('.chk-alumno-diferenciado:checked')).map(cb => cb.value);
        if (seleccionados.length === 0) {
            alert('Has seleccionado Asignación Diferenciada pero no marcaste ningún alumno de la lista.');
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

        const inputHidden = document.getElementById('inputCodTPAsignar');
        const inputTexto = document.getElementById('inputCodTPAsignarTexto');
        if (inputHidden) inputHidden.value = '';
        if (inputTexto) inputTexto.value = '';

        document.querySelectorAll('.chk-alumno-diferenciado').forEach(cb => cb.checked = false);

        if (callbackExito) callbackExito();

    } catch (err) {
        alert('Error al asignar TP: ' + err.message);
    }
}
