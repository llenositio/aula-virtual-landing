import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// =========================================================================
// CONFIGURACIÓN DIRECTA DE SUPABASE
// =========================================================================
const SUPABASE_URL = 'https://bpwxxodhiswltefhqbol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3h4b2RoaXN3bHRlZmhxYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzc3NjQsImV4cCI6MjEwNjYxMzc2NH0.tVs4JpCyJFAcakyIHMCV49xiuzNgNr2SeG1S5iUeF48';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ELEMENTOS DEL DOM
const seccionAuth = document.getElementById('seccionAuth');
const seccionDashboard = document.getElementById('seccionDashboard');
const seccionDetalleCurso = document.getElementById('seccionDetalleCurso');
const contenedorCursos = document.getElementById('contenedorCursos');
const btnVolverCursos = document.getElementById('btnVolverCursos');
const detalleTituloCurso = document.getElementById('detalleTituloCurso');
const detalleSubtituloCurso = document.getElementById('detalleSubtituloCurso');
const tablaAlumnosBody = document.getElementById('tablaAlumnosBody');
const tablaTPsAsignadosBody = document.getElementById('tablaTPsAsignadosBody');

const formAuth = document.getElementById('formAuth');
const authTitulo = document.getElementById('authTitulo');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authNombre = document.getElementById('authNombre');
const authApellido = document.getElementById('authApellido');
const camposRegistro = document.getElementById('camposRegistro');
const btnAuthSubmit = document.getElementById('btnAuthSubmit');
const toggleAuthMode = document.getElementById('toggleAuthMode');
const btnCerrarSesion = document.getElementById('btnCerrarSesion');
const btnGoogleAuth = document.getElementById('btnGoogleAuth');

let esModoRegistro = false;
let cursoActualId = null;
let cursoActualInfo = null;
let bancoTPsMemoria = []; // Caché local del banco de TPs para filtrado rápido

// =========================================================================
// AUTENTICACIÓN
// =========================================================================
if (toggleAuthMode) {
    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        esModoRegistro = !esModoRegistro;

        if (esModoRegistro) {
            authTitulo.textContent = 'Crear Cuenta Docente';
            btnAuthSubmit.textContent = 'Registrarse';
            camposRegistro.classList.remove('d-none');
            toggleAuthMode.textContent = '¿Ya tenés cuenta? Iniciá sesión acá';
        } else {
            authTitulo.textContent = 'Iniciar Sesión';
            btnAuthSubmit.textContent = 'Ingresar';
            camposRegistro.classList.add('d-none');
            toggleAuthMode.textContent = '¿No tenés cuenta? Registrate acá';
        }
    });
}

if (btnGoogleAuth) {
    btnGoogleAuth.addEventListener('click', async () => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname
                }
            });
            if (error) throw error;
        } catch (err) {
            alert('Error al iniciar sesión con Google: ' + err.message);
        }
    });
}

if (formAuth) {
    formAuth.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authEmail.value;
        const password = authPassword.value;

        try {
            if (esModoRegistro) {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            nombre: authNombre ? authNombre.value : '',
                            apellido: authApellido ? authApellido.value : ''
                        }
                    }
                });

                if (error) throw error;
                alert('¡Registro exitoso! Ya podés ingresar.');
                toggleAuthMode.click();

            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;
                actualizarInterfaz(data.user);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        }
    });
}

if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', async () => {
        await supabase.auth.signOut();
        actualizarInterfaz(null);
    });
}

function actualizarInterfaz(usuario) {
    if (usuario) {
        if (seccionAuth) seccionAuth.classList.add('d-none');
        if (seccionDashboard) seccionDashboard.classList.remove('d-none');
        if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');
        if (btnCerrarSesion) btnCerrarSesion.classList.remove('d-none');
        cargarCursos(usuario.id);
    } else {
        if (seccionAuth) seccionAuth.classList.remove('d-none');
        if (seccionDashboard) seccionDashboard.classList.add('d-none');
        if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');
        if (btnCerrarSesion) btnCerrarSesion.classList.add('d-none');
    }
}

async function inicializarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    actualizarInterfaz(session ? session.user : null);

    supabase.auth.onAuthStateChange((_event, session) => {
        actualizarInterfaz(session ? session.user : null);
    });
}

inicializarSesion();

// =========================================================================
// NÓMINA DE ALUMNOS (PARSER Y GUARDADO)
// =========================================================================
function parsearLineaAlumno(linea) {
    const partes = linea.split(',').map(p => p.trim());
    let apellido = 'SIN APELLIDO';
    let nombre = 'SIN NOMBRE';
    let emailTutor = null;

    if (partes.length >= 3) {
        apellido = partes[0];
        nombre = partes[1];
        emailTutor = partes[2] && partes[2].includes('@') ? partes[2] : null;
    } else if (partes.length === 2) {
        apellido = partes[0];
        if (partes[1].includes('@')) {
            const subPartes = partes[0].split(' ');
            apellido = subPartes[0] || 'SIN APELLIDO';
            nombre = subPartes.slice(1).join(' ') || 'SIN NOMBRE';
            emailTutor = partes[1];
        } else {
            nombre = partes[1];
        }
    } else {
        const palabras = linea.trim().split(/\s+/);
        apellido = palabras[0] || 'SIN APELLIDO';
        nombre = palabras.slice(1).join(' ') || 'SIN NOMBRE';
    }

    return { apellido, nombre, emailTutor };
}

async function guardarNominaCurso(cursoId, alumnosList) {
    const regInsert = alumnosList.map(a => ({
        curso_id: cursoId,
        nombre: `${a.apellido.toUpperCase()}, ${a.nombre}`,
        email: a.emailTutor
    }));

    const { error } = await supabase.from('alumnos').insert(regInsert);
    if (error) throw error;
}

// =========================================================================
// GESTIÓN DE CURSOS
// =========================================================================
async function cargarCursos(profesorId) {
    if (!contenedorCursos) return;

    try {
        const { data: cursos, error } = await supabase
            .from('cursos')
            .select('*, alumnos(count)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!cursos || cursos.length === 0) {
            contenedorCursos.innerHTML = `
                <div class="col-12 text-center text-muted py-5">
                    <p>No tenés cursos creados todavía. ¡Creá el primero!</p>
                </div>`;
            return;
        }

        contenedorCursos.innerHTML = cursos.map(c => `
            <div class="col-md-4 mb-4">
                <div class="card card-custom h-100 p-3 border-0 shadow-sm">
                    <div class="card-body d-flex flex-column justify-content-between">
                        <div>
                            <span class="badge bg-primary mb-2">${c.escuela || 'S/E'}</span>
                            <h4 class="card-title fw-bold text-dark mb-1">${c.nombre}</h4>
                            <p class="small text-muted mb-1"><strong>Código Invitación:</strong> <code>${c.codigo_invitacion || '-'}</code></p>
                            <p class="small text-muted"><strong>Alumnos Inscriptos:</strong> ${c.alumnos ? c.alumnos[0].count : 0}</p>
                        </div>
                        <button class="btn btn-outline-primary btn-sm w-100 fw-bold mt-3 btn-ver-curso" 
                                data-id="${c.id}" 
                                data-nombre="${c.nombre}" 
                                data-escuela="${c.escuela || ''}">
                            Ver Curso & Evaluaciones
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.btn-ver-curso').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                verDetalleCurso(
                    target.dataset.id,
                    target.dataset.nombre,
                    target.dataset.escuela
                );
            });
        });

    } catch (err) {
        contenedorCursos.innerHTML = `<div class="col-12 alert alert-danger">Error al cargar cursos: ${err.message}</div>`;
    }
}

const formCrearCurso = document.getElementById('formCrearCurso');
if (formCrearCurso) {
    formCrearCurso.addEventListener('submit', async (e) => {
        e.preventDefault();

        const institucion = document.getElementById('cursoInstitucion').value;
        const anioDivision = document.getElementById('cursoAnioDivision').value;
        const modalidad = document.getElementById('cursoModalidad').value;
        const rawText = document.getElementById('nominaRaw').value;

        const nombreCurso = `${anioDivision} - ${modalidad}`;

        try {
            const codigoInvitacion = Math.random().toString(36).substring(2, 8).toUpperCase();

            const { data: curso, error: errCurso } = await supabase
                .from('cursos')
                .insert([{
                    nombre: nombreCurso,
                    escuela: institucion,
                    codigo_invitacion: codigoInvitacion
                }])
                .select()
                .single();

            if (errCurso) throw errCurso;

            const lineas = rawText.split('\n').filter(linea => linea.trim() !== '');
            const alumnos = lineas.map(parsearLineaAlumno);

            if (alumnos.length > 0) {
                await guardarNominaCurso(curso.id, alumnos);
            }

            alert('¡Curso y nómina de alumnos guardados con éxito!');

            const modalElement = document.getElementById('modalCrearCurso');
            if (modalElement) {
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) modalInstance.hide();
            }

            formCrearCurso.reset();
            const { data: { session } } = await supabase.auth.getSession();
            cargarCursos(session ? session.user.id : null);

        } catch (err) {
            alert('Error al crear el curso: ' + err.message);
        }
    });
}

// =========================================================================
// DETALLE DEL CURSO Y NÓMINA DE ALUMNOS
// =========================================================================
if (btnVolverCursos) {
    btnVolverCursos.addEventListener('click', () => {
        cursoActualId = null;
        cursoActualInfo = null;
        if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');
        if (seccionDashboard) seccionDashboard.classList.remove('d-none');
    });
}

async function verDetalleCurso(cursoId, nombre, escuela) {
    cursoActualId = cursoId;
    cursoActualInfo = { nombre, escuela };

    if (seccionDashboard) seccionDashboard.classList.add('d-none');
    if (seccionDetalleCurso) seccionDetalleCurso.classList.remove('d-none');

    if (detalleTituloCurso) detalleTituloCurso.textContent = nombre;
    if (detalleSubtituloCurso) detalleSubtituloCurso.textContent = escuela ? `Escuela: ${escuela}` : '';

    await cargarAlumnosCurso(cursoId);
    await cargarTPsAsignadosCurso(cursoId);
}

async function cargarAlumnosCurso(cursoId) {
    if (!tablaAlumnosBody) return;
    tablaAlumnosBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Cargando alumnos...</td></tr>`;

    try {
        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select('*')
            .eq('curso_id', cursoId)
            .order('nombre', { ascending: true });

        if (error) throw error;

        if (!alumnos || alumnos.length === 0) {
            tablaAlumnosBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay alumnos inscriptos en este curso.</td></tr>`;
            return;
        }

        tablaAlumnosBody.innerHTML = alumnos.map((al, index) => {
            const partes = al.nombre ? al.nombre.split(',') : ['', ''];
            const apellido = partes[0] ? partes[0].trim() : al.nombre;
            const nombre = partes[1] ? partes[1].trim() : '-';

            return `
                <tr>
                    <td class="fw-bold">${index + 1}</td>
                    <td>${apellido}</td>
                    <td>${nombre}</td>
                    <td>${al.email ? `<span class="badge bg-light text-dark border">${al.email}</span>` : '<span class="text-muted small">Sin email</span>'}</td>
                    <td><code class="fs-6">Sin PIN</code></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger btn-eliminar-alumno" data-id="${al.id}" data-nombre="${al.nombre}" title="Eliminar Alumno">
                            🗑️ Quitar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        document.querySelectorAll('.btn-eliminar-alumno').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget;
                const id = target.dataset.id;
                const nombreCompleto = target.dataset.nombre;

                if (confirm(`¿Estás seguro de que querés eliminar a ${nombreCompleto}?`)) {
                    try {
                        const { error } = await supabase.from('alumnos').delete().eq('id', id);
                        if (error) throw error;
                        alert('Alumno eliminado.');
                        cargarAlumnosCurso(cursoId);
                    } catch (err) {
                        alert('Error al eliminar alumno: ' + err.message);
                    }
                }
            });
        });

    } catch (err) {
        if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="6" class="text-danger">Error al cargar alumnos: ${err.message}</td></tr>`;
    }
}

const formAgregarAlumnos = document.getElementById('formAgregarAlumnos');
if (formAgregarAlumnos) {
    formAgregarAlumnos.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!cursoActualId) return alert('Error: no hay un curso seleccionado.');

        const rawText = document.getElementById('nominaEditarRaw').value;

        try {
            const lineas = rawText.split('\n').filter(linea => linea.trim() !== '');
            const alumnos = lineas.map(parsearLineaAlumno);

            if (alumnos.length === 0) return alert('Por favor, ingresá al menos un alumno.');

            await guardarNominaCurso(cursoActualId, alumnos);
            alert('¡Alumnos cargados con éxito!');

            const modalElement = document.getElementById('modalInscribirAlumnos');
            if (modalElement) {
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) modalInstance.hide();
            }

            formAgregarAlumnos.reset();
            cargarAlumnosCurso(cursoActualId);

        } catch (err) {
            alert('Error al agregar alumnos: ' + err.message);
        }
    });
}

// =========================================================================
// ASIGNACIÓN DE TRABAJOS PRÁCTICOS (BANCO GLOBAL Y TAXONOMÍA DE BLOOM)
// =========================================================================
async function cargarTPsAsignadosCurso(cursoId) {
    if (!tablaTPsAsignadosBody) return;
    tablaTPsAsignadosBody.innerHTML = '<tr><td colspan="4" class="text-center py-3">Cargando TPs asignados...</td></tr>';

    try {
        const { data: asignaciones, error } = await supabase
            .from('curso_evaluaciones')
            .select('*')
            .eq('curso_id', cursoId);

        if (error) throw error;

        if (!asignaciones || asignaciones.length === 0) {
            tablaTPsAsignadosBody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">No hay Trabajos Prácticos asignados a este curso.</td></tr>';
            return;
        }

        tablaTPsAsignadosBody.innerHTML = '';
        for (const asig of asignaciones) {
            const { data: preg } = await supabase
                .from('banco_preguntas')
                .select('titulo_humano, nivel_bloom')
                .eq('cod_tp', asig.cod_tp)
                .limit(1);

            const item = (preg && preg.length > 0) ? preg[0] : null;
            const titulo = item ? item.titulo_humano : 'TP en Banco Global';
            const bloom = item ? item.nivel_bloom : 'Comprender';

            tablaTPsAsignadosBody.innerHTML += `
                <tr>
                    <td class="fw-bold"><code>${asig.cod_tp}</code></td>
                    <td>${titulo}</td>
                    <td><span class="badge bg-info text-dark">${bloom}</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger btn-desasignar-tp" data-id="${asig.id}">Quitar</button>
                    </td>
                </tr>
            `;
        }

        document.querySelectorAll('.btn-desasignar-tp').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const asigId = e.currentTarget.dataset.id;
                if (!confirm('¿Desasignar este TP de la comisión?')) return;

                try {
                    const { error } = await supabase.from('curso_evaluaciones').delete().eq('id', asigId);
                    if (error) throw error;
                    cargarTPsAsignadosCurso(cursoId);
                } catch (err) {
                    alert('Error al desasignar TP: ' + err.message);
                }
            });
        });

    } catch (err) {
        tablaTPsAsignadosBody.innerHTML = `<tr><td colspan="4" class="text-center text-danger py-3">Error: ${err.message}</td></tr>`;
    }
}

// Cargar catálogo de TPs únicos desde Supabase al abrir el Modal
async function cargarBancoGlobal() {
    const contenedor = document.getElementById('listaBancoTPs');
    if (!contenedor) return;

    contenedor.innerHTML = `<div class="list-group-item text-center text-muted py-3 small">Cargando catálogo del Banco Global...</div>`;

    try {
        const { data, error } = await supabase
            .from('banco_preguntas')
            .select('cod_tp, titulo_humano, nivel_bloom')
            .order('cod_tp');

        if (error) throw error;

        // Filtrar duplicados por cod_tp para tener la lista de TPs únicos
        const vistos = new Set();
        bancoTPsMemoria = (data || []).filter(item => {
            if (item.cod_tp && !vistos.has(item.cod_tp)) {
                vistos.add(item.cod_tp);
                return true;
            }
            return false;
        });

        renderizarBancoTPs(bancoTPsMemoria);

    } catch (err) {
        contenedor.innerHTML = `<div class="list-group-item text-center text-danger py-3 small">Error al obtener el Banco Global: ${err.message}</div>`;
    }
}

// Renderizar filas de TPs en el modal
function renderizarBancoTPs(lista) {
    const contenedor = document.getElementById('listaBancoTPs');
    const contador = document.getElementById('cantTPsEncontrados');
    if (!contenedor) return;

    if (contador) contador.textContent = `${lista.length} disponibles`;

    if (lista.length === 0) {
        contenedor.innerHTML = `<div class="list-group-item text-center text-muted py-4 small">No se encontraron TPs con los criterios ingresados.</div>`;
        return;
    }

    contenedor.innerHTML = lista.map(tp => `
        <div class="list-group-item d-flex justify-content-between align-items-center py-3">
            <div>
                <div class="fw-bold text-dark mb-1">
                    ${tp.titulo_humano || 'Sin Título'}
                    <span class="badge bg-primary text-white ms-2">${tp.nivel_bloom || 'Sin nivel'}</span>
                </div>
                <div class="small text-muted">
                    Código: <code>${tp.cod_tp}</code>
                </div>
            </div>
            <button type="button" class="btn btn-sm btn-primary fw-bold btn-seleccionar-tp" data-cod="${tp.cod_tp}">
                + Asignar a este Curso
            </button>
        </div>
    `).join('');

    // Eventos de asignación en 1 clic
    document.querySelectorAll('.btn-seleccionar-tp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const codTp = e.currentTarget.dataset.cod;
            ejecutarAsignacionTP(codTp);
        });
    });
}

// Aplicar filtros manuales (Buscador y Nivel de Bloom)
function aplicarFiltrosBanco() {
    const filtroTexto = (document.getElementById('filtroTextoTP')?.value || '').toLowerCase();
    const filtroBloom = document.getElementById('filtroBloomTP')?.value || '';

    const resultado = bancoTPsMemoria.filter(tp => {
        const coincideTexto = (tp.titulo_humano || '').toLowerCase().includes(filtroTexto) || 
                              (tp.cod_tp || '').toLowerCase().includes(filtroTexto);
        const coincideBloom = !filtroBloom || tp.nivel_bloom === filtroBloom;

        return coincideTexto && coincideBloom;
    });

    renderizarBancoTPs(resultado);
}

// Motor de Sugerencias por Temario / Programa
function analizarProgramaDocente() {
    const textoPrograma = (document.getElementById('inputProgramaDocente')?.value || '').toLowerCase().trim();
    if (!textoPrograma) {
        renderizarBancoTPs(bancoTPsMemoria);
        return;
    }

    const palabrasClave = textoPrograma.split(/\s+/).filter(p => p.length > 3);

    const sugerencias = bancoTPsMemoria.filter(tp => {
        const titulo = (tp.titulo_humano || '').toLowerCase();
        const cod = (tp.cod_tp || '').toLowerCase();

        return palabrasClave.some(palabra => titulo.includes(palabra) || cod.includes(palabra));
    });

    renderizarBancoTPs(sugerencias.length > 0 ? sugerencias : bancoTPsMemoria);
}

// Ejecutar el guardado en Supabase al hacer clic en "Asignar a este Curso"
async function ejecutarAsignacionTP(codTp) {
    if (!cursoActualId) {
        alert('Error: No hay un curso seleccionado.');
        return;
    }

    try {
        const { error } = await supabase
            .from('curso_evaluaciones')
            .insert([{
                curso_id: cursoActualId,
                cod_tp: codTp
            }]);

        if (error) throw error;

        // Ocultar modal de Bootstrap
        const modalEl = document.getElementById('modalAsignarTP');
        if (modalEl) {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        }

        alert(`¡TP "${codTp}" asignado correctamente al curso!`);
        cargarTPsAsignadosCurso(cursoActualId);

    } catch (err) {
        alert('Error al asignar el TP: ' + err.message);
    }
}

// Escuchadores de eventos para los controles del Modal
const modalAsignarTP = document.getElementById('modalAsignarTP');
if (modalAsignarTP) {
    modalAsignarTP.addEventListener('show.bs.modal', () => {
        cargarBancoGlobal();
    });
}

document.getElementById('filtroTextoTP')?.addEventListener('input', aplicarFiltrosBanco);
document.getElementById('filtroBloomTP')?.addEventListener('change', aplicarFiltrosBanco);
document.getElementById('filtroAnioTP')?.addEventListener('change', aplicarFiltrosBanco);
document.getElementById('btnAnalizarPrograma')?.addEventListener('click', analizarProgramaDocente);
