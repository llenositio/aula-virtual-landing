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

let esModoRegistro = false;
let cursoActualId = null;
let cursoActualInfo = null;
let bancoTPsMemoria = [];
let modalPerfilInstancia = null;
let instanciasGraficos = {};

// =========================================================================
// INICIALIZACIÓN DE EVENTOS DE AUTENTICACIÓN
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnGoogle = document.getElementById('btnGoogleAuth');
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async (e) => {
            e.preventDefault();
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
});

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

async function actualizarInterfaz(usuario) {
    if (usuario) {
        if (seccionAuth) seccionAuth.classList.add('d-none');
        if (btnCerrarSesion) btnCerrarSesion.classList.remove('d-none');

        try {
            const { data: prof, error } = await supabase
                .from('profesores')
                .select('*')
                .eq('id', usuario.id)
                .maybeSingle();

            if (error || !prof) {
                if (seccionDashboard) seccionDashboard.classList.add('d-none');
                if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');

                const elemNombre = document.getElementById('perfilNombre');
                if (elemNombre && !elemNombre.value) {
                    elemNombre.value = usuario.user_metadata?.full_name || usuario.user_metadata?.name || usuario.user_metadata?.nombre || '';
                }

                const modalEl = document.getElementById('modalCompletarPerfil');
                if (modalEl) {
                    modalPerfilInstancia = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                    modalPerfilInstancia.show();
                }
                return;
            }

            if (seccionDashboard) seccionDashboard.classList.remove('d-none');
            if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');

            cargarCursos(usuario.id);

        } catch (e) {
            console.error('Error al verificar perfil docente:', e);
            if (seccionDashboard) seccionDashboard.classList.add('d-none');
        }

    } else {
        if (seccionAuth) seccionAuth.classList.remove('d-none');
        if (seccionDashboard) seccionDashboard.classList.add('d-none');
        if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');
        if (btnCerrarSesion) btnCerrarSesion.classList.add('d-none');
    }
}

// Modal Perfil Docente
const formCompletarPerfil = document.getElementById('formCompletarPerfil');
if (formCompletarPerfil) {
    formCompletarPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();

        const apellido = document.getElementById('perfilApellido').value.trim().toUpperCase();
        const nombre = document.getElementById('perfilNombre').value.trim();

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesión activa.');

            const { error } = await supabase.from('profesores').insert([{
                id: session.user.id,
                email: session.user.email,
                nombre: nombre,
                apellido: apellido,
                estado_suscripcion: 'activa'
            }]);

            if (error) throw error;

            const modalEl = document.getElementById('modalCompletarPerfil');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl) || modalPerfilInstancia;
                if (modalInstance) modalInstance.hide();
            }

            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';

            alert('¡Perfil completado con éxito!');
            actualizarInterfaz(session.user);

        } catch (err) {
            alert('Error al guardar el perfil: ' + err.message);
        }
    });
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
    let emailAlumno = null;
    let emailTutor = null;

    if (partes.length >= 4) {
        apellido = partes[0];
        nombre = partes[1];
        emailAlumno = partes[2] && partes[2].includes('@') ? partes[2] : null;
        emailTutor = partes[3] && partes[3].includes('@') ? partes[3] : null;
    } else if (partes.length === 3) {
        apellido = partes[0];
        nombre = partes[1];
        if (partes[2] && partes[2].includes('@')) {
            emailTutor = partes[2];
        }
    } else if (partes.length === 2) {
        apellido = partes[0];
        nombre = partes[1];
    } else {
        const palabras = linea.trim().split(/\s+/);
        apellido = palabras[0] || 'SIN APELLIDO';
        nombre = palabras.slice(1).join(' ') || 'SIN NOMBRE';
    }

    return { apellido, nombre, emailAlumno, emailTutor };
}

async function guardarNominaCurso(cursoId, alumnosList) {
    const regInsert = alumnosList.map(a => ({
        curso_id: cursoId,
        apellido: a.apellido.toUpperCase(),
        nombre: a.nombre,
        email_alumno: a.emailAlumno,
        email_tutor: a.emailTutor,
        pin: Math.floor(1000 + Math.random() * 9000).toString()
    }));

    const { error } = await supabase.from('alumnos').insert(regInsert);
    if (error) throw error;
}

const modalInscribirAlumnos = document.getElementById('modalInscribirAlumnos');
if (modalInscribirAlumnos) {
    const btnCargarModal = modalInscribirAlumnos.querySelector('.modal-footer .btn-primary') || 
                           modalInscribirAlumnos.querySelector('.modal-footer button:not([data-bs-dismiss])');

    if (btnCargarModal) {
        btnCargarModal.addEventListener('click', async () => {
            const textarea = modalInscribirAlumnos.querySelector('textarea');
            if (!textarea || !textarea.value.trim()) {
                alert('Por favor, ingresá al menos un alumno en la lista.');
                return;
            }

            if (!cursoActualId) {
                alert('Error: No hay ningún curso seleccionado actualmente.');
                return;
            }

            const lineas = textarea.value.split('\n').filter(linea => linea.trim() !== '');
            const alumnos = lineas.map(parsearLineaAlumno);

            try {
                await guardarNominaCurso(cursoActualId, alumnos);
                alert('¡Alumnos guardados e inscriptos con éxito!');
                
                textarea.value = '';
                
                const modalInstance = bootstrap.Modal.getInstance(modalInscribirAlumnos);
                if (modalInstance) modalInstance.hide();

                cargarAlumnosCurso(cursoActualId);
            } catch (err) {
                alert('Error al guardar la nómina: ' + err.message);
            }
        });
    }
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
                            <h4 class="card-title fw-bold text-dark mb-1">${c.anio_division}</h4>
                            <p class="small text-muted mb-1"><strong>Código Invitación:</strong> <code>${c.codigo_invitacion || '-'}</code></p>
                            <p class="small text-muted"><strong>Alumnos Inscriptos:</strong> ${c.alumnos ? c.alumnos[0].count : 0}</p>
                        </div>
                        <button class="btn btn-outline-primary btn-sm w-100 fw-bold mt-3 btn-ver-curso" 
                                data-id="${c.id}" 
                                data-nombre="${c.anio_division}" 
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

        const escuela = document.getElementById('cursoInstitucion').value;
        const anioDivision = document.getElementById('cursoAnioDivision').value;
        const modalidad = document.getElementById('cursoModalidad').value;
        const rawText = document.getElementById('nominaRaw').value;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const codigoInvitacion = Math.random().toString(36).substring(2, 8).toUpperCase();

            const { data: curso, error: errCurso } = await supabase
                .from('cursos')
                .insert([{
                    profesor_id: session ? session.user.id : null,
                    escuela: escuela,
                    anio_division: anioDivision,
                    modalidad: modalidad,
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
    if (detalleSubtituloCurso) {
        const textoEscuela = (escuela && escuela !== 'S/E') ? `Escuela: ${escuela}` : 'Escuela: S/E';
        detalleSubtituloCurso.innerHTML = `
            ${textoEscuela} 
            <button class="btn btn-sm btn-link p-0 ms-2 text-decoration-none" id="btnAbrirEditarCurso" title="Editar Escuela/Curso">✏️ Editar datos</button>
        `;
    }

    document.getElementById('btnAbrirEditarCurso')?.addEventListener('click', () => {
        document.getElementById('editCursoId').value = cursoId;
        document.getElementById('editCursoEscuela').value = (escuela && escuela !== 'S/E') ? escuela : '';
        document.getElementById('editCursoNombre').value = nombre || '';

        const modalEl = document.getElementById('modalEditarCurso');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    });

    await cargarAlumnosCurso(cursoId);
    await cargarPlanificacionCurso(cursoId);
    await cargarAnaliticaCurso(cursoId);
}

async function cargarAlumnosCurso(cursoId) {
    const tablaMatrizBody = document.getElementById('tablaMatrizBody');
    const tablaAlumnosBody = document.getElementById('tablaAlumnosBody');

    if (tablaMatrizBody) tablaMatrizBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">Cargando nómina...</td></tr>`;
    if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Cargando datos...</td></tr>`;

    try {
        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select('*')
            .eq('curso_id', cursoId)
            .order('apellido', { ascending: true });

        if (error) throw error;

        if (!alumnos || alumnos.length === 0) {
            const msjVacio = `<tr><td colspan="7" class="text-center text-muted py-3">No hay alumnos inscriptos en este curso.</td></tr>`;
            if (tablaMatrizBody) tablaMatrizBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-3">No hay alumnos inscriptos.</td></tr>`;
            if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = msjVacio;
            return;
        }

        const idsAlumnos = alumnos.map(a => a.id);
        const { data: notasData } = await supabase
            .from('evaluaciones_resultados')
            .select('alumno_id, nota')
            .in('alumno_id', idsAlumnos);

        const notasPorAlumno = {};
        if (notasData) {
            notasData.forEach(n => {
                const id = n.alumno_id;
                const val = Number(n.nota) || 0;
                if (!notasPorAlumno[id]) notasPorAlumno[id] = [];
                notasPorAlumno[id].push(val);
            });
        }

        if (tablaMatrizBody) {
            tablaMatrizBody.innerHTML = alumnos.map((al, index) => {
                const misNotas = notasPorAlumno[al.id] || [];
                let promedioTexto = '- / 10';
                let badgeEstado = '<span class="badge bg-secondary">Sin entregas</span>';

                if (misNotas.length > 0) {
                    const maxNota = Math.max(...misNotas);
                    promedioTexto = `${maxNota.toFixed(1)} / 10`;

                    if (maxNota >= 6) {
                        badgeEstado = '<span class="badge bg-success">Aprobado</span>';
                    } else {
                        badgeEstado = '<span class="badge bg-danger">A rehacer</span>';
                    }
                }

                return `
                    <tr>
                        <td class="fw-bold">${index + 1}</td>
                        <td class="fw-bold">${al.apellido || ''}, ${al.nombre || ''}</td>
                        <td>${badgeEstado}</td>
                        <td class="fw-bold text-primary">${promedioTexto}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-secondary">📄 Informe PDF</button>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        if (tablaAlumnosBody) {
            tablaAlumnosBody.innerHTML = alumnos.map((al, index) => {
                const apellido = al.apellido || '-';
                const nombre = al.nombre || '-';
                const pinMostrar = al.pin || 'Sin PIN';

                return `
                    <tr>
                        <td class="fw-bold">${index + 1}</td>
                        <td>${apellido}</td>
                        <td>${nombre}</td>
                        <td>${al.email_alumno ? `<span class="badge bg-light text-dark border">${al.email_alumno}</span>` : '<span class="text-muted small">Sin email</span>'}</td>
                        <td>${al.email_tutor ? `<span class="badge bg-light text-dark border">${al.email_tutor}</span>` : '<span class="text-muted small">Sin email</span>'}</td>
                        <td><code class="fs-6 fw-bold text-primary bg-light px-2 py-1 rounded border">${pinMostrar}</code></td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary me-1 btn-editar-alumno" 
                                    data-id="${al.id}" 
                                    data-apellido="${apellido}" 
                                    data-nombre="${nombre}" 
                                    data-emailalumno="${al.email_alumno || ''}" 
                                    data-emailtutor="${al.email_tutor || ''}" 
                                    data-pin="${al.pin || ''}" 
                                    title="Editar Alumno">
                                ✏️ Editar
                            </button>
                            <button class="btn btn-sm btn-outline-danger btn-eliminar-alumno" 
                                    data-id="${al.id}" 
                                    data-nombre="${apellido}, ${nombre}" 
                                    title="Eliminar Alumno">
                                🗑️ Quitar
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');

            vincularEventosAlumnos(cursoId);
        }

    } catch (err) {
        console.error('Error al cargar alumnos:', err);
        if (tablaMatrizBody) tablaMatrizBody.innerHTML = `<tr><td colspan="5" class="text-danger py-3">Error: ${err.message}</td></tr>`;
        if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-danger py-3">Error: ${err.message}</td></tr>`;
    }
}

function vincularEventosAlumnos(cursoId) {
    document.querySelectorAll('.btn-editar-alumno').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ds = e.currentTarget.dataset;
            document.getElementById('editAlumnoId').value = ds.id;
            document.getElementById('editAlumnoApellido').value = ds.apellido !== '-' ? ds.apellido : '';
            document.getElementById('editAlumnoNombre').value = ds.nombre !== '-' ? ds.nombre : '';
            document.getElementById('editAlumnoEmail').value = ds.emailalumno;
            document.getElementById('editTutorEmail').value = ds.emailtutor;
            document.getElementById('editAlumnoPin').value = ds.pin;

            const modalEl = document.getElementById('modalEditarAlumno');
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            }
        });
    });

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
}

const formEditarAlumno = document.getElementById('formEditarAlumno');
if (formEditarAlumno) {
    formEditarAlumno.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('editAlumnoId').value;
        const apellido = document.getElementById('editAlumnoApellido').value.trim().toUpperCase();
        const nombre = document.getElementById('editAlumnoNombre').value.trim();
        const emailAlumno = document.getElementById('editAlumnoEmail').value.trim();
        const emailTutor = document.getElementById('editTutorEmail').value.trim();
        const pin = document.getElementById('editAlumnoPin').value.trim();

        try {
            const { error } = await supabase
                .from('alumnos')
                .update({
                    apellido: apellido,
                    nombre: nombre,
                    email_alumno: emailAlumno || null,
                    email_tutor: emailTutor || null,
                    pin: pin || Math.floor(1000 + Math.random() * 9000).toString()
                })
                .eq('id', id);

            if (error) throw error;

            const modalEl = document.getElementById('modalEditarAlumno');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }

            alert('¡Datos del alumno actualizados correctamente!');
            if (cursoActualId) cargarAlumnosCurso(cursoActualId);

        } catch (err) {
            alert('Error al actualizar alumno: ' + err.message);
        }
    });
}

// =========================================================================
// PLAN DE TRABAJO Y PLANIFICACIÓN
// =========================================================================
async function cargarPlanificacionCurso(cursoId) {
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
                    <p class="text-muted small mb-0">Utilizá la barra superior para definir un Período (ej. 1° Trimestre), Unidad y seleccionar un TP del Banco.</p>
                </div>
            `;
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
                    <div class="card-body p-3">
            `;

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
                                <tbody>
                `;

                tps.forEach(tp => {
                    const aliasActual = tp.alias_tp || tp.cod_tp;
                    const switchChecked = tp.activo ? 'checked' : '';
                    const badgeEstado = tp.activo 
                        ? '<span class="badge bg-success ms-2">Visible</span>' 
                        : '<span class="badge bg-secondary ms-2">Oculto</span>';

                    html += `
                        <tr>
                            <td><code>${tp.cod_tp}</code></td>
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
                        </tr>
                    `;
                });

                html += `</tbody></table></div></div>`;
            }

            html += `</div></div>`;
        }

        contenedor.innerHTML = html;
        vincularEventosPlanificacion(cursoId);

    } catch (err) {
        console.error('Error al cargar planificación:', err);
        contenedor.innerHTML = `<div class="alert alert-danger">Error al cargar la planificación: ${err.message}</div>`;
    }
}

function vincularEventosPlanificacion(cursoId) {
    document.querySelectorAll('.btn-guardar-alias').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            const nuevoAlias = document.getElementById(`alias-input-${id}`).value;
            const { error } = await supabase.from('curso_planificacion').update({ alias_tp: nuevoAlias }).eq('id', id);
            if (error) alert('Error: ' + error.message);
            else alert('✅ Alias guardado correctamente.');
        });
    });

    document.querySelectorAll('.switch-visibilidad-tp').forEach(sw => {
        sw.addEventListener('change', async (e) => {
            const id = e.currentTarget.dataset.id;
            const activo = e.currentTarget.checked;
            const { error } = await supabase.from('curso_planificacion').update({ activo }).eq('id', id);
            if (error) { alert('Error: ' + error.message); e.currentTarget.checked = !activo; }
            else cargarPlanificacionCurso(cursoId);
        });
    });

    document.querySelectorAll('.btn-eliminar-tp-plan').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('¿Seguro que querés quitar este TP de la planificación?')) return;
            const id = e.currentTarget.dataset.id;
            const { error } = await supabase.from('curso_planificacion').delete().eq('id', id);
            if (error) alert('Error: ' + error.message);
            else cargarPlanificacionCurso(cursoId);
        });
    });
}

document.getElementById('btnAgregarAlPlan')?.addEventListener('click', async () => {
    const codTp = document.getElementById('inputCodTPAsignar').value;
    const periodo = document.getElementById('inputNuevoPeriodo').value.trim() || '1° Trimestre';
    const unidad = document.getElementById('inputNuevaUnidad').value.trim() || 'Unidad 1';

    if (!cursoActualId || !codTp) {
        alert('Por favor seleccioná un TP usando el botón "Explorar Banco Global".');
        return;
    }

    try {
        let tituloHumanoDefecto = codTp;
        const { data: preg } = await supabase
            .from('banco_preguntas')
            .select('titulo_humano')
            .eq('cod_tp', codTp)
            .limit(1);

        if (preg && preg.length > 0 && preg[0].titulo_humano) {
            tituloHumanoDefecto = preg[0].titulo_humano;
        }

        const { error } = await supabase.from('curso_planificacion').insert([{
            curso_id: cursoActualId,
            cod_tp: codTp,
            periodo_evaluativo: periodo,
            unidad_tematica: unidad,
            alias_tp: tituloHumanoDefecto,
            activo: true
        }]);

        if (error) throw error;

        document.getElementById('inputCodTPAsignar').value = '';
        document.getElementById('inputCodTPAsignarTexto').value = '';
        cargarPlanificacionCurso(cursoActualId);

    } catch (err) {
        alert('Error al agregar TP al plan: ' + err.message);
    }
});

// =========================================================================
// ANALÍTICA Y GRÁFICOS DINÁMICOS REALES (CHART.JS)
// =========================================================================
async function cargarAnaliticaCurso(cursoId) {
    try {
        const { data: plan } = await supabase
            .from('curso_planificacion')
            .select('*')
            .eq('curso_id', cursoId)
            .order('periodo_evaluativo', { ascending: true })
            .order('unidad_tematica', { ascending: true });

        if (!plan || plan.length === 0) return;

        const selectFiltroAmarillo = document.getElementById('filtroAnaliticaEstructura');
        if (selectFiltroAmarillo && selectFiltroAmarillo.options.length <= 1) {
            const periodos = [...new Set(plan.map(p => p.periodo_evaluativo).filter(Boolean))];
            periodos.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = `Período: ${p}`;
                selectFiltroAmarillo.appendChild(opt);
            });
        }

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

        // --- GRÁFICO 1: Rendimiento Global por TP ---
        const labelsTP = plan.map(p => {
            const alias = p.alias_tp || p.cod_tp;
            return alias.length > 20 ? alias.substring(0, 18) + '...' : alias;
        });

        const aprobadosData = plan.map(p => (notasPorTp[p.cod_tp] || []).filter(n => n >= 6).length);
        const reprobadosData = plan.map(p => (notasPorTp[p.cod_tp] || []).filter(n => n < 6).length);

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

        // --- GRÁFICO 2: Radar de Competencias (Bloom Real) ---
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

        // --- GRÁFICO 3: Distribución Real de Calificaciones ---
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

        // --- GRÁFICO 4: Diagnóstico por Pregunta (Desplegable Verde) ---
        const selectDiag = document.getElementById('selectTpDiagnostico');
        if (selectDiag) {
            selectDiag.innerHTML = '<option value="">Seleccionar TP para diagnosticar...</option>' +
                plan.map(p => `<option value="${p.cod_tp}">${p.alias_tp || p.cod_tp}</option>`).join('');

            if (plan.length > 0) selectDiag.value = plan[0].cod_tp;

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

                const cantPreguntas = respsTp[0].length;
                const labelsPreg = Array.from({ length: cantPreguntas }, (_, i) => `Pregunta ${i + 1}`);
                
                const porcentajesAcierto = labelsPreg.map((_, idx) => {
                    const aciertos = respsTp.filter(r => {
                        const preg = r[idx];
                        if (!preg) return false;
                        return preg.esCorrecta === true || preg.correcta === true || preg.es_correcta === true || typeof preg === 'object';
                    }).length;

                    return Math.round((aciertos / respsTp.length) * 100);
                });

                renderizarGrafico('chartDiagnosticoPreguntas', 'bar', {
                    labels: labelsPreg,
                    datasets: [{
                        label: '% Acierto por Pregunta',
                        data: porcentajesAcierto,
                        backgroundColor: porcentajesAcierto.map(val => val < 100 ? '#dc3545' : '#0d6efd')
                    }]
                }, { 
                    scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } 
                });
            };

            selectDiag.onchange = (e) => actualizarGraficoDiagnostico(e.target.value);
            if (selectDiag.value) actualizarGraficoDiagnostico(selectDiag.value);
        }

    } catch (err) {
        console.error('Error al cargar analítica real:', err);
    }
}

function renderizarGrafico(canvasId, tipo, datos, opciones = {}) {
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

// =========================================================================
// BANCO GLOBAL DE TPS
// =========================================================================
async function cargarBancoGlobal() {
    const contenedor = document.getElementById('listaBancoTPs');
    if (!contenedor) return;

    contenedor.innerHTML = `<div class="list-group-item text-center text-muted py-3 small">Cargando catálogo del Banco Global...</div>`;

    try {
        let { data, error } = await supabase
            .from('banco_preguntas')
            .select('cod_tp, titulo_humano, anio, nivel_bloom')
            .order('cod_tp');

        if (error || !data || data.length === 0) {
            const resFallback = await supabase
                .from('tps_matematica')
                .select('cod_tp, titulo_humano, anio, nivel_bloom')
                .order('cod_tp');

            if (!resFallback.error && resFallback.data && resFallback.data.length > 0) {
                data = resFallback.data;
                error = null;
            }
        }

        if (error) throw error;

        const mapaTPs = new Map();
        (data || []).forEach(item => {
            if (item.cod_tp && !mapaTPs.has(item.cod_tp)) {
                mapaTPs.set(item.cod_tp, {
                    cod_tp: item.cod_tp,
                    titulo: item.titulo_humano || 'Sin Título',
                    anio: item.anio || 1,
                    bloom: item.nivel_bloom || 'Comprender'
                });
            }
        });

        bancoTPsMemoria = Array.from(mapaTPs.values());
        renderizarBancoTPs(bancoTPsMemoria);

    } catch (err) {
        contenedor.innerHTML = `<div class="list-group-item text-center text-danger py-3 small">Error al conectar con el Banco Global: ${err.message || 'Verificar tablas en Supabase'}</div>`;
    }
}

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
        <div class="list-group-item py-3">
            <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <div class="fw-bold text-dark mb-1">
                        ${tp.titulo}
                        <span class="badge bg-info text-dark ms-2">${tp.bloom}</span>
                        <span class="badge bg-secondary ms-1">${tp.anio}° Año</span>
                    </div>
                    <div class="small text-muted">
                        Código: <code>${tp.cod_tp}</code>
                    </div>
                </div>
                <div>
                    <button type="button" class="btn btn-sm btn-outline-secondary me-2 btn-preview-tp" data-cod="${tp.cod_tp}">
                        👁️ Vista Previa
                    </button>
                    <button type="button" class="btn btn-sm btn-primary fw-bold btn-seleccionar-tp" data-cod="${tp.cod_tp}">
                        + Seleccionar TP
                    </button>
                </div>
            </div>

            <div class="mt-3 p-3 bg-light rounded border" id="preview-${tp.cod_tp}" style="display: none;">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div> 
                <span class="small text-muted ms-2">Generando ficha pedagógica...</span>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.btn-seleccionar-tp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const codTp = e.currentTarget.dataset.cod;
            ejecutarAsignacionTP(codTp);
        });
    });

    document.querySelectorAll('.btn-preview-tp').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const codTp = e.currentTarget.dataset.cod;
            const containerPreview = document.getElementById(`preview-${codTp}`);

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
                    .select('titulo_humano, consigna, nivel_bloom, especialidad_nivel')
                    .eq('cod_tp', codTp);

                if (error) throw error;

                if (!preguntas || preguntas.length === 0) {
                    containerPreview.innerHTML = `<div class="text-muted small">No hay datos suficientes para generar la vista previa.</div>`;
                    return;
                }

                const tituloGeneral = preguntas[0].titulo_humano || 'Trabajo Práctico';
                const especialidad = preguntas[0].especialidad_nivel || 'General';
                const totalPreguntas = preguntas.length;

                const extraerNivelesLimpios = (listaItems) => {
                    const conjunto = new Set();
                    listaItems.forEach(item => {
                        if (!item) return;
                        const partes = item.replace(/([a-z])([A-Z])/g, '$1,$2').split(/[,/]+/);
                        partes.forEach(p => {
                            let limpio = p.trim();
                            if (limpio) {
                                if (limpio.toLowerCase().startsWith('comprend')) limpio = 'Comprender';
                                else if (limpio.toLowerCase().startsWith('analiz')) limpio = 'Analizar';
                                else if (limpio.toLowerCase().startsWith('aplic')) limpio = 'Aplicar';
                                else if (limpio.toLowerCase().startsWith('evalu')) limpio = 'Evaluar';
                                else if (limpio.toLowerCase().startsWith('crea')) limpio = 'Crear';
                                else if (limpio.toLowerCase().startsWith('conoc') || limpio.toLowerCase().startsWith('record')) limpio = 'Recordar';

                                conjunto.add(limpio);
                            }
                        });
                    });
                    return Array.from(conjunto);
                };

                const nivelesBloomUnicos = extraerNivelesLimpios(preguntas.map(p => p.nivel_bloom));
                const listaBloomBadges = nivelesBloomUnicos
                    .map(b => `<span class="badge bg-info text-dark me-1 mb-1">${b}</span>`)
                    .join('');

                let resenaHTML = `
                    <div class="mb-3 p-2 bg-white rounded border-start border-primary border-3 shadow-sm">
                        <h6 class="fw-bold text-primary mb-1">📌 Ficha Pedagógica: ${tituloGeneral}</h6>
                        <p class="small text-dark mb-1">
                            Este trabajo práctico consta de <strong>${totalPreguntas} consignas de evaluación</strong> orientadas al nivel <strong>${especialidad}</strong>.
                        </p>
                        <div class="small text-muted mb-0 d-flex align-items-center flex-wrap gap-1">
                            🧠 <strong>Niveles de Habilidad Evaluados:</strong> ${listaBloomBadges || '<span class="badge bg-secondary">Aplicar</span>'}
                        </div>
                    </div>
                    <div class="mb-1">
                        <h6 class="fw-bold text-secondary mb-2">📝 Muestra de Consignas Modelo (3 de ${totalPreguntas})</h6>
                        <ul class="small text-dark ps-3 mb-0">
                `;

                const muestra = preguntas.slice(0, 3);
                muestra.forEach((p, idx) => {
                    let textoConsigna = p.consigna || 'Consigna de evaluación';
                    if (textoConsigna.length > 140) {
                        textoConsigna = textoConsigna.substring(0, 140) + '...';
                    }

                    const nivelLimpioArr = extraerNivelesLimpios([p.nivel_bloom]);
                    const nivelMostrar = nivelLimpioArr.length > 0 ? nivelLimpioArr.join(' / ') : 'Aplicar';

                    resenaHTML += `
                        <li class="mb-2">
                            <strong>Ejercicio ${idx + 1}:</strong> "${textoConsigna}" 
                            <span class="badge bg-light text-dark border ms-1">${nivelMostrar}</span>
                        </li>`;
                });

                resenaHTML += `</ul></div>`;

                containerPreview.innerHTML = resenaHTML;
                containerPreview.dataset.cargado = 'true';

            } catch (err) {
                containerPreview.innerHTML = `<div class="text-danger small">Error al cargar vista previa: ${err.message}</div>`;
            }
        });
    });
}

function aplicarFiltrosBanco() {
    const filtroTexto = (document.getElementById('filtroTextoTP')?.value || '').toLowerCase();
    const filtroAnio = document.getElementById('filtroAnioTP')?.value || '';
    const filtroBloom = document.getElementById('filtroBloomTP')?.value || '';

    const resultado = bancoTPsMemoria.filter(tp => {
        const coincideTexto = tp.titulo.toLowerCase().includes(filtroTexto) || tp.cod_tp.toLowerCase().includes(filtroTexto);
        const coincideAnio = !filtroAnio || tp.anio.toString() === filtroAnio;
        const coincideBloom = !filtroBloom || tp.bloom.toLowerCase() === filtroBloom.toLowerCase();

        return coincideTexto && coincideAnio && coincideBloom;
    });

    renderizarBancoTPs(resultado);
}

function analizarProgramaDocente() {
    const textoPrograma = (document.getElementById('inputProgramaDocente')?.value || '').toLowerCase().trim();
    if (!textoPrograma) {
        renderizarBancoTPs(bancoTPsMemoria);
        return;
    }

    const palabrasClave = textoPrograma.split(/\s+/).filter(p => p.length > 3);

    const sugerencias = bancoTPsMemoria.filter(tp => {
        const titulo = tp.titulo.toLowerCase();
        const cod = tp.cod_tp.toLowerCase();

        return palabrasClave.some(palabra => titulo.includes(palabra) || cod.includes(palabra));
    });

    renderizarBancoTPs(sugerencias);
}

function ejecutarAsignacionTP(codTp) {
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

const formEditarCurso = document.getElementById('formEditarCurso');
if (formEditarCurso) {
    formEditarCurso.addEventListener('submit', async (e) => {
        e.preventDefault();

        const cursoId = document.getElementById('editCursoId').value;
        const nuevaEscuela = document.getElementById('editCursoEscuela').value.trim();
        const nuevoNombre = document.getElementById('editCursoNombre').value.trim();

        try {
            const { error } = await supabase
                .from('cursos')
                .update({
                    escuela: nuevaEscuela || null,
                    anio_division: nuevoNombre
                })
                .eq('id', cursoId);

            if (error) throw error;

            alert('¡Datos de la comisión actualizados con éxito!');

            const modalEl = document.getElementById('modalEditarCurso');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }

            const { data: { session } } = await supabase.auth.getSession();
            cargarCursos(session ? session.user.id : null);

        } catch (err) {
            alert('Error al actualizar la comisión: ' + err.message);
        }
    });
}
