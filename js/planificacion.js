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
    'potenciación': ['potencia', 'potenciacion', 'potenciación', 'exponente', 'radicación', 'radicacion', 'raíz', 'raiz'],
    'logica': ['logica', 'lógica', 'conjeturas', 'conjetura', 'razonamiento', 'demostración', 'premisa', 'validación']
};

// Normalizador Unicode (remueve tildes, símbolos y convierte a minúsculas)
function normalizarTexto(txt) {
    if (!txt) return '';
    return String(txt)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

// Extraer número para ordenamiento secuencial
function extraerNumeroCodigo(cod) {
    if (!cod) return 0;
    const match = String(cod).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

// Cargar la planificación del curso desde 'curso_planificacion'
export async function cargarPlanificacionCurso(cursoId, supabase) {
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
                <div class="alert alert-light text-center py-4 border my-3">
                    <p class="text-muted mb-0">No hay Trabajos Prácticos asignados a este curso todavía.</p>
                </div>`;
            return;
        }

        const agrupado = {};
        plan.forEach(tp => {
            const periodo = tp.periodo_evaluativo || 'Sin Período Definido';
            if (!agrupado[periodo]) agrupado[periodo] = [];
            agrupado[periodo].push(tp);
        });

        let html = '';
        Object.keys(agrupado).forEach(periodo => {
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
                                        data-nombre="${alias}">
                                    ✏️ Editar
                                </button>
                                <button class="btn btn-sm btn-outline-danger btn-eliminar-tp-plan" data-id="${tp.id}">
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

// Carga del Banco Global agrupando por 'cod_tp_completo'
export async function cargarBancoGlobal(supabase) {
    try {
        console.log('🔄 Cargando catálogo global desde banco_preguntas...');

        const { data: preguntas, error: errPreg } = await supabase
            .from('banco_preguntas')
            .select('cod_tp, cod_tp_completo, titulo_humano, nivel_bloom, especialidad_nivel, anio, materia, consigna')
            .range(0, 4999);

        if (errPreg) {
            console.error('❌ Error de Supabase al consultar banco_preguntas:', errPreg);
            return;
        }

        const mapaTPs = new Map();

        (preguntas || []).forEach(p => {
            // Clave única basada en cod_tp_completo para evitar colisiones entre TPs que compartan cod_tp
            const claveUnica = p.cod_tp_completo || `${p.cod_tp}_${p.materia || 'MAT'}_${p.anio || 1}`;
            if (!claveUnica) return;

            if (!mapaTPs.has(claveUnica)) {
                mapaTPs.set(claveUnica, {
                    id_unico: claveUnica,
                    cod_tp: p.cod_tp || 'TP',
                    cod_tp_completo: p.cod_tp_completo || claveUnica,
                    titulo_humano: p.titulo_humano || p.cod_tp_completo || p.cod_tp,
                    nivel_bloom: p.nivel_bloom || 'General',
                    anio: p.anio || 1,
                    materia: p.materia || 'MAT',
                    especialidad: p.especialidad_nivel || '',
                    consignasTexto: ''
                });
            }

            const tpObj = mapaTPs.get(claveUnica);
            if (p.titulo_humano && (!tpObj.titulo_humano || tpObj.titulo_humano === p.cod_tp)) {
                tpObj.titulo_humano = p.titulo_humano;
            }
            if (p.nivel_bloom) tpObj.nivel_bloom = p.nivel_bloom;

            tpObj.consignasTexto += ` ${p.consigna || ''}`;
        });

        bancoGlobalTPs = Array.from(mapaTPs.values()).sort((a, b) => 
            extraerNumeroCodigo(a.cod_tp_completo || a.cod_tp) - extraerNumeroCodigo(b.cod_tp_completo || b.cod_tp)
        );

        console.log(`✅ Catálogo cargado exitosamente: ${bancoGlobalTPs.length} TPs únicos detectados.`, bancoGlobalTPs);

        renderizarBancoGlobal(bancoGlobalTPs, supabase);
        conectarEventosBusquedaInstantanea(supabase);

    } catch (err) {
        console.error('Error crítico cargando catálogo global:', err);
    }
}

// Búsqueda en tiempo real e inteligente
export function aplicarFiltrosBanco(supabase) {
    const rawTexto = document.getElementById('filtroTextoTP')?.value || '';
    const bloom = document.getElementById('filtroBloomTP')?.value || 'TODOS';
    const anio = document.getElementById('filtroAnioTP')?.value || 'TODOS';

    const textoLimpio = normalizarTexto(rawTexto);
    
    const terminosIngresados = textoLimpio
        .split(/[\s,.;:-]+/)
        .filter(t => t.length > 1);

    let terminosExpandidos = [...terminosIngresados];
    terminosIngresados.forEach(term => {
        Object.keys(DICCIONARIO_FACETAS).forEach(clave => {
            const claveNorm = normalizarTexto(clave);
            if (claveNorm.includes(term) || term.includes(claveNorm)) {
                DICCIONARIO_FACETAS[clave].forEach(sinonimo => {
                    terminosExpandidos.push(normalizarTexto(sinonimo));
                });
            }
        });
    });
    terminosExpandidos = Array.from(new Set(terminosExpandidos));

    const filtrados = bancoGlobalTPs.filter(tp => {
        const codShort = normalizarTexto(tp.cod_tp);
        const codFull = normalizarTexto(tp.cod_tp_completo);
        const titulo = normalizarTexto(tp.titulo_humano);
        const materia = normalizarTexto(tp.materia);
        const especialidad = normalizarTexto(tp.especialidad);
        const textoConsignas = normalizarTexto(tp.consignasTexto);

        const todoElContenido = `${codShort} ${codFull} ${titulo} ${materia} ${especialidad} ${textoConsignas}`;

        const coincideTxt = terminosIngresados.length === 0 || terminosExpandidos.some(t => todoElContenido.includes(t));
        const coincideBloom = bloom === 'TODOS' || normalizarTexto(tp.nivel_bloom) === normalizarTexto(bloom);
        const coincideAnio = anio === 'TODOS' || String(tp.anio) === String(anio);

        return coincideTxt && coincideBloom && coincideAnio;
    });

    renderizarBancoGlobal(filtrados, supabase);
}

// Búsqueda instantánea mientras se escribe
let timerDebounce = null;
function conectarEventosBusquedaInstantanea(supabase) {
    const inputTexto = document.getElementById('filtroTextoTP');
    const selectBloom = document.getElementById('filtroBloomTP');
    const selectAnio = document.getElementById('filtroAnioTP');

    const ejecutarFiltrado = () => {
        clearTimeout(timerDebounce);
        timerDebounce = setTimeout(() => {
            aplicarFiltrosBanco(supabase);
        }, 120);
    };

    if (inputTexto && !inputTexto.dataset.listenerConectado) {
        inputTexto.dataset.listenerConectado = 'true';
        inputTexto.addEventListener('input', ejecutarFiltrado);
    }

    if (selectBloom && !selectBloom.dataset.listenerConectado) {
        selectBloom.dataset.listenerConectado = 'true';
        selectBloom.addEventListener('change', () => aplicarFiltrosBanco(supabase));
    }

    if (selectAnio && !selectAnio.dataset.listenerConectado) {
        selectAnio.dataset.listenerConectado = 'true';
        selectAnio.addEventListener('change', () => aplicarFiltrosBanco(supabase));
    }
}

function renderizarBancoGlobal(lista, supabase) {
    const contenedor = document.getElementById('listaBancoTPs') || document.getElementById('contenedorListaBancoTP');
    const cantEl = document.getElementById('cantTPsEncontrados');
    
    if (cantEl) {
        cantEl.innerText = `${lista.length} disponibles`;
    }

    if (!contenedor) return;

    if (lista.length === 0) {
        contenedor.innerHTML = `
            <div class="text-center text-muted py-4 small">
                No se encontraron Trabajos Prácticos que coincidan con la búsqueda.
            </div>`;
        return;
    }

    const tarjetasHtml = lista.map(tp => {
        const codFull = tp.cod_tp_completo || tp.cod_tp || '';
        const titulo = tp.titulo_humano || codFull;
        const bloom = tp.nivel_bloom || 'General';

        return `
        <div class="card mb-2 border shadow-sm">
            <div class="card-body p-3 d-flex justify-content-between align-items-center">
                <div>
                    <span class="badge bg-primary me-2">${tp.cod_tp}</span>
                    <span class="badge bg-outline-secondary border text-dark me-2">${bloom}</span>
                    <h6 class="fw-bold d-inline text-dark mb-0">${titulo}</h6>
                    <p class="small text-muted mb-0 mt-1">Código completo: <code>${codFull}</code></p>
                </div>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-info fw-bold btn-inspeccionar-tp-banco" data-cod="${tp.id_unico}">
                        👁️ Inspeccionar
                    </button>
                    <button class="btn btn-sm btn-success fw-bold btn-seleccionar-tp-banco" data-cod="${codFull}" data-titulo="${titulo}">
                        ➕ Seleccionar
                    </button>
                </div>
            </div>
        </div>`;
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
            const idUnico = e.currentTarget.dataset.cod;
            const tpObj = bancoGlobalTPs.find(t => t.id_unico === idUnico);
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

    const tituloMostrar = tp.titulo_humano || tp.cod_tp_completo || tp.cod_tp;

    document.getElementById('drawerBadgeCodTP').innerText = tp.cod_tp;
    document.getElementById('drawerTituloTP').innerText = tituloMostrar;
    document.getElementById('drawerNivelBloom').innerText = 'Bloom: ' + (tp.nivel_bloom || 'General');
    document.getElementById('drawerAnioNivel').innerText = tp.anio ? (tp.anio + '° Año') : 'Nivel Secundario';
    document.getElementById('drawerDescripcionTP').innerText = `Código Completo: ${tp.cod_tp_completo || tp.cod_tp}`;

    const btnSeleccionar = document.getElementById('btnDrawerSeleccionarTP');
    if (btnSeleccionar) {
        btnSeleccionar.onclick = () => seleccionarTPParaPlan(tp.cod_tp_completo || tp.cod_tp, tituloMostrar);
    }

    const contConsignas = document.getElementById('contenedorDrawerConsignas');
    const contRespuestas = document.getElementById('contenedorDrawerRespuestas');
    const contSaberes = document.getElementById('contenedorDrawerSaberes');

    contConsignas.innerHTML = '<div class="text-center py-4 text-muted small"><div class="spinner-border spinner-border-sm me-2"></div>Cargando consignas...</div>';
    contRespuestas.innerHTML = '<div class="text-center py-4 text-muted small"><div class="spinner-border spinner-border-sm me-2"></div>Cargando respuestas...</div>';
    contSaberes.innerHTML = '<div class="text-center py-4 text-muted small"><div class="spinner-border spinner-border-sm me-2"></div>Cargando saberes...</div>';

    const bsOffcanvas = new bootstrap.Offcanvas(drawerEl);
    bsOffcanvas.show();

    try {
        let query = supabase.from('banco_preguntas').select('N_de_orden_pregunta, consigna, opciones, respuesta_correcta');

        if (tp.cod_tp_completo) {
            query = query.eq('cod_tp_completo', tp.cod_tp_completo);
        } else {
            query = query.eq('cod_tp', tp.cod_tp);
        }

        const { data: preguntas, error } = await query.order('N_de_orden_pregunta', { ascending: true });

        if (error) throw error;

        if (!preguntas || preguntas.length === 0) {
            contConsignas.innerHTML = '<div class="alert alert-light text-center small text-muted">No se encontraron consignas registradas para este TP.</div>';
            contRespuestas.innerHTML = '<div class="alert alert-light text-center small text-muted">Sin clave de respuestas.</div>';
            contSaberes.innerHTML = '<div class="alert alert-light text-center small text-muted">Sin saberes catalogados.</div>';
            return;
        }

        contConsignas.innerHTML = preguntas.map((p, idx) => {
            let opcionesHtml = '';
            if (p.opciones) {
                const listaOps = typeof p.opciones === 'string' ? p.opciones.split(',,') : p.opciones;
                if (Array.isArray(listaOps) && listaOps.length > 0) {
                    opcionesHtml = '<ul class="list-group list-group-flush small mt-2">' +
                        listaOps.map(o => '<li class="list-group-item px-2 py-1 bg-light">' + o + '</li>').join('') +
                    '</ul>';
                }
            }
            return '<div class="card border-0 shadow-sm p-3 bg-white mb-2">' +
                '<div class="fw-bold text-dark mb-1">Pregunta ' + (p.N_de_orden_pregunta || (idx + 1)) + '</div>' +
                '<div class="small text-dark mb-1">' + (p.consigna || 'Consigna en formato interactivo') + '</div>' +
                opcionesHtml +
            '</div>';
        }).join('');

        contRespuestas.innerHTML = preguntas.map((p, idx) => {
            return '<div class="border-bottom pb-2 mb-2 small">' +
                '<span class="fw-bold text-dark">P' + (p.N_de_orden_pregunta || (idx + 1)) + ':</span> ' +
                '<span class="badge bg-success me-1">' + (p.respuesta_correcta || 'Verificación automática') + '</span>' +
            '</div>';
        }).join('');

        contSaberes.innerHTML = `
            <div class="card border-0 bg-light p-3">
                <h6 class="fw-bold text-primary small mb-2">Contenido temático:</h6>
                <p class="small text-dark mb-0">${tp.titulo_humano}</p>
            </div>`;

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
