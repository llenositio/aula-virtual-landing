import { supabase, guardarNominaCurso, generarPinAlumno } from './db.js';

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
const btnGoogleAuth = document.getElementById('btnGoogleAuth');

let esModoRegistro = false;
let cursoActualId = null;
let cursoActualInfo = null;

// CAMBIAR ENTRE LOGIN Y REGISTRO
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

// AUTENTICACIÓN CON GOOGLE (OAuth)
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

// MANEJAR LOGIN Y REGISTRO
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

// CERRAR SESIÓN
if (btnCerrarSesion) {
    btnCerrarSesion.addEventListener('click', async () => {
        await supabase.auth.signOut();
        actualizarInterfaz(null);
    });
}

// VOLVER A LA LISTA DE CURSOS
if (btnVolverCursos) {
    btnVolverCursos.addEventListener('click', () => {
        cursoActualId = null;
        cursoActualInfo = null;
        if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');
        if (seccionDashboard) seccionDashboard.classList.remove('d-none');
    });
}

// PARSER INTELIGENTE DE LÍNEAS DE ALUMNOS (Extrae apellido, nombre y email del tutor)
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

// VER DETALLE DE UN CURSO Y SUS ALUMNOS
async function verDetalleCurso(cursoId, institucion, anioDivision, modalidad) {
    cursoActualId = cursoId;
    cursoActualInfo = { institucion, anioDivision, modalidad };

    if (seccionDashboard) seccionDashboard.classList.add('d-none');
    if (seccionDetalleCurso) seccionDetalleCurso.classList.remove('d-none');

    if (detalleTituloCurso) detalleTituloCurso.textContent = `${institucion} - ${anioDivision}`;
    if (detalleSubtituloCurso) detalleSubtituloCurso.textContent = `Modalidad: ${modalidad}`;
    if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Cargando alumnos...</td></tr>`;

    try {
        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select('*')
            .eq('curso_id', cursoId)
            .order('apellido', { ascending: true });

        if (error) throw error;

        if (!alumnos || alumnos.length === 0) {
            tablaAlumnosBody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">No hay alumnos inscriptos en este curso.</td></tr>`;
            return;
        }

        tablaAlumnosBody.innerHTML = alumnos.map((al, index) => `
            <tr>
                <td class="fw-bold">${index + 1}</td>
                <td>${al.apellido}</td>
                <td>${al.nombre}</td>
                <td>${al.email_tutor ? `<span class="badge bg-light text-dark border">${al.email_tutor}</span>` : '<span class="text-muted small">Sin email</span>'}</td>
                <td><code class="fs-6">${al.pin ? al.pin : 'Sin PIN'}</code></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-secondary btn-generar-pin me-1" data-id="${al.id}" title="Regenerar PIN">
                        ${al.pin ? '🔄 PIN' : '🔑 Crear PIN'}
                    </button>
                    <button class="btn btn-sm btn-outline-primary btn-editar-alumno me-1" data-id="${al.id}" data-apellido="${al.apellido}" data-nombre="${al.nombre}" data-email="${al.email_tutor || ''}" title="Editar Alumno">
                        ✏️
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-eliminar-alumno" data-id="${al.id}" data-nombre="${al.apellido}, ${al.nombre}" title="Eliminar Alumno">
                        🗑️
                    </button>
                </td>
            </tr>
        `).join('');

        // EVENTOS DE LA TABLA
        document.querySelectorAll('.btn-generar-pin').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const alumnoId = e.currentTarget.dataset.id;
                try {
                    const nuevoPin = await generarPinAlumno(alumnoId);
                    alert(`Nuevo PIN generado con éxito: ${nuevoPin}`);
                    verDetalleCurso(cursoId, institucion, anioDivision, modalidad);
                } catch (err) {
                    alert('Error al generar PIN: ' + err.message);
                }
            });
        });

        document.querySelectorAll('.btn-editar-alumno').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.currentTarget;
                const id = target.dataset.id;
                const apellidoActual = target.dataset.apellido;
                const nombreActual = target.dataset.nombre;
                const emailActual = target.dataset.email;

                const nuevoApellido = prompt("Apellido:", apellidoActual);
                if (nuevoApellido === null) return;

                const nuevoNombre = prompt("Nombre:", nombreActual);
                if (nuevoNombre === null) return;

                const nuevoEmail = prompt("Email del Tutor (opcional):", emailActual);
                if (nuevoEmail === null) return;

                try {
                    const { error } = await supabase
                        .from('alumnos')
                        .update({
                            apellido: nuevoApellido.trim().toUpperCase(),
                            nombre: nuevoNombre.trim(),
                            email_tutor: nuevoEmail.trim() || null
                        })
                        .eq('id', id);

                    if (error) throw error;
                    alert('Alumno actualizado correctamente.');
                    verDetalleCurso(cursoId, institucion, anioDivision, modalidad);
                } catch (err) {
                    alert('Error al actualizar alumno: ' + err.message);
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
                        const { error } = await supabase
                            .from('alumnos')
                            .delete()
                            .eq('id', id);

                        if (error) throw error;
                        alert('Alumno eliminado.');
                        verDetalleCurso(cursoId, institucion, anioDivision, modalidad);
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

// CARGAR LISTA DE CURSOS
async function cargarCursos(profesorId) {
    if (!contenedorCursos) return;

    try {
        const { data: cursos, error } = await supabase
            .from('cursos')
            .select('*, alumnos(count)')
            .eq('profesor_id', profesorId)
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
                            <span class="badge bg-primary mb-2">${c.modalidad}</span>
                            <h4 class="card-title fw-bold text-dark mb-1">${c.institucion}</h4>
                            <p class="text-secondary fw-semibold mb-3">Año / División: ${c.anio_division}</p>
                            <p class="small text-muted mb-1"><strong>Código Ref:</strong> <code>${c.codigo_ref}</code></p>
                            <p class="small text-muted"><strong>Alumnos Inscriptos:</strong> ${c.alumnos ? c.alumnos[0].count : 0}</p>
                        </div>
                        <button class="btn btn-outline-primary btn-sm w-100 fw-bold mt-3 btn-ver-curso" 
                                data-id="${c.id}" 
                                data-inst="${c.institucion}" 
                                data-anio="${c.anio_division}" 
                                data-mod="${c.modalidad}">
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
                    target.dataset.inst,
                    target.dataset.anio,
                    target.dataset.mod
                );
            });
        });

    } catch (err) {
        contenedorCursos.innerHTML = `<div class="col-12 alert alert-danger">Error al cargar cursos: ${err.message}</div>`;
    }
}

// CONTROL DE INTERFAZ SEGÚN SESIÓN
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

// INICIALIZAR SESIÓN
async function inicializarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    actualizarInterfaz(session ? session.user : null);

    supabase.auth.onAuthStateChange((_event, session) => {
        actualizarInterfaz(session ? session.user : null);
    });
}

inicializarSesion();

// CREAR NUEVO CURSO CON NÓMINA INICIAL
const formCrearCurso = document.getElementById('formCrearCurso');

if (formCrearCurso) {
    formCrearCurso.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return alert("Debés estar autenticado.");

        const institucion = document.getElementById('cursoInstitucion').value;
        const anioDivision = document.getElementById('cursoAnioDivision').value;
        const modalidad = document.getElementById('cursoModalidad').value;
        const rawText = document.getElementById('nominaRaw').value;

        try {
            const codigoRef = 'CURSO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const { data: curso, error: errCurso } = await supabase
                .from('cursos')
                .insert([{
                    profesor_id: session.user.id,
                    institucion: institucion,
                    modalidad: modalidad,
                    anio_division: anioDivision,
                    codigo_ref: codigoRef
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
            cargarCursos(session.user.id);

        } catch (err) {
            alert('Error al crear el curso: ' + err.message);
        }
    });
}

// AGREGAR ALUMNOS A CURSO EXISTENTE
const formAgregarAlumnos = document.getElementById('formAgregarAlumnos');

if (formAgregarAlumnos) {
    formAgregarAlumnos.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!cursoActualId) {
            return alert('Error: no hay un curso seleccionado.');
        }

        const rawText = document.getElementById('nominaEditarRaw').value;

        try {
            const lineas = rawText.split('\n').filter(linea => linea.trim() !== '');
            const alumnos = lineas.map(parsearLineaAlumno);

            if (alumnos.length === 0) {
                return alert('Por favor, ingresá al menos un alumno.');
            }

            await guardarNominaCurso(cursoActualId, alumnos);

            alert('¡Alumnos cargados con éxito!');

            const modalElement = document.getElementById('modalInscribirAlumnos');
            if (modalElement) {
                const modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) modalInstance.hide();
            }

            formAgregarAlumnos.reset();

            if (cursoActualInfo) {
                verDetalleCurso(
                    cursoActualId,
                    cursoActualInfo.institucion,
                    cursoActualInfo.anioDivision,
                    cursoActualInfo.modalidad
                );
            }

        } catch (err) {
            alert('Error al agregar alumnos: ' + err.message);
        }
    });
}
