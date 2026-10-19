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
let modalPerfilInstancia = null;

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

async function actualizarInterfaz(usuario) {
    if (usuario) {
        if (seccionAuth) seccionAuth.classList.add('d-none');
        if (btnCerrarSesion) btnCerrarSesion.classList.remove('d-none');

        try {
            // 1. Consultar si el profesor existe en la tabla pública por su ID de Auth
            const { data: prof, error } = await supabase
                .from('profesores')
                .select('*')
                .eq('id', usuario.id)
                .maybeSingle();

            // Si hay un error en la consulta o si no existe en la tabla 'profesores'
            if (error || !prof) {
                console.log('Profesor no registrado en la tabla pública. Ocultando panel y solicitando datos...');
                
                // Ocultar obligatoriamente el Dashboard y vistas de detalle
                if (seccionDashboard) seccionDashboard.classList.add('d-none');
                if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');

                // Sugerir el nombre si viene en los metadatos de Google
                const elemNombre = document.getElementById('perfilNombre');
                if (elemNombre && !elemNombre.value) {
                    elemNombre.value = usuario.user_metadata?.full_name || usuario.user_metadata?.name || usuario.user_metadata?.nombre || '';
                }

                // Desplegar el modal emergente para completar APELLIDO y Nombre
                const modalEl = document.getElementById('modalCompletarPerfil');
                if (modalEl) {
                    modalPerfilInstancia = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                    modalPerfilInstancia.show();
                }
                return; // Bloquea la ejecución para que NO se muestre el dashboard
            }

            // 2. Si el perfil está confirmado en la tabla, recién permitimos ver el Dashboard
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

// Handler para el Modal de Registro de Perfil
const formCompletarPerfil = document.getElementById('formCompletarPerfil');
if (formCompletarPerfil) {
    formCompletarPerfil.addEventListener('submit', async (e) => {
        e.preventDefault();

        const apellido = document.getElementById('perfilApellido').value.trim().toUpperCase();
        const nombre = document.getElementById('perfilNombre').value.trim();

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('No hay sesión activa.');

            // Insertar en la tabla profesores
            const { error } = await supabase.from('profesores').insert([{
                id: session.user.id,
                email: session.user.email,
                nombre: nombre,
                apellido: apellido,
                estado_suscripcion: 'activa'
            }]);

            if (error) throw error;

            // Ocultar modal y remover fondo gris de Bootstrap
            const modalEl = document.getElementById('modalCompletarPerfil');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl) || modalPerfilInstancia;
                if (modalInstance) modalInstance.hide();
            }

            // Limpieza manual de capas oscuras residuales
            document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
            document.body.classList.remove('modal-open');
            document.body.style.overflow = '';
            document.body.style.paddingRight = '';

            alert('¡Perfil completado con éxito!');
            
            // Refrescar interfaz
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
// NÓMINA DE ALUMNOS (PARSER Y GUARDADO CON DUAL-EMAIL Y PIN)
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
// DETALLE DEL CURSO Y NÓMINA DE ALUMNOS (CON AMBOS MAILS Y PIN)
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
    await cargarTPsAsignadosCurso(cursoId);
}

async function cargarAlumnosCurso(cursoId) {
    if (!tablaAlumnosBody) return;
    tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">Cargando alumnos...</td></tr>`;

    try {
        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select('*')
            .eq('curso_id', cursoId)
            .order('apellido', { ascending: true });

        if (error) throw error;

        if (!alumnos || alumnos.length === 0) {
            tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay alumnos inscriptos en este curso.</td></tr>`;
            return;
        }

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

    } catch (err) {
        if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-danger">Error al cargar alumnos: ${err.message}</td></tr>`;
    }
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
// ASIGNACIÓN DE TRABAJOS PRÁCTICOS
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
            let { data: preg } = await supabase
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

// =========================================================================
// BANCO GLOBAL DE TPS - RENDERIZADO CON VISTA PREVIA Y RESEÑA
// =========================================================================

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
                        + Asignar a este Curso
                    </button>
                </div>
            </div>

            <!-- Panel desplegable universal para la reseña y consignas modelo -->
            <div class="mt-3 p-3 bg-light rounded border" id="preview-${tp.cod_tp}" style="display: none;">
                <div class="spinner-border spinner-border-sm text-primary" role="status"></div> 
                <span class="small text-muted ms-2">Generando ficha pedagógica...</span>
            </div>
        </div>
    `).join('');

    // Listener para asignar TPs
    document.querySelectorAll('.btn-seleccionar-tp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const codTp = e.currentTarget.dataset.cod;
            ejecutarAsignacionTP(codTp);
        });
    });

    // Listener universal para generar la reseña automática de CUALQUIER TP
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
                // Consultar las preguntas del TP sin límite arbitrario para analizar su perfil completo
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

                // Extraer los distintos niveles de Bloom presentes en las preguntas del TP
                const nivelesBloomUnicos = Array.from(new Set(preguntas.map(p => p.nivel_bloom).filter(Boolean)));
                const listaBloom = nivelesBloomUnicos.map(b => `<span class="badge bg-info text-dark me-1">${b}</span>`).join('');

                // Generar síntesis pedagógica totalmente dinámica basada en la estructura del TP
                let resenaHTML = `
                    <div class="mb-3 p-2 bg-white rounded border-start border-primary border-3 shadow-sm">
                        <h6 class="fw-bold text-primary mb-1">📌 Ficha Pedagógica: ${tituloGeneral}</h6>
                        <p class="small text-dark mb-1">
                            Este trabajo práctico consta de <strong>${totalPreguntas} consignas de evaluación</strong> orientadas al nivel <strong>${especialidad}</strong>.
                        </p>
                        <div class="small text-muted mb-0">
                            🧠 <strong>Niveles de Habilidad Evaluados:</strong> ${listaBloom || '<span class="badge bg-secondary">Aplicar</span>'}
                        </div>
                    </div>
                    <div class="mb-1">
                        <h6 class="fw-bold text-secondary mb-2">📝 Muestra de Consignas Modelo (3 de ${totalPreguntas})</h6>
                        <ul class="small text-dark ps-3 mb-0">
                `;

                // Mostrar las primeras 3 consignas reales
                const muestra = preguntas.slice(0, 3);
                muestra.forEach((p, idx) => {
                    let textoConsigna = p.consigna || 'Consigna de evaluación';
                    if (textoConsigna.length > 140) {
                        textoConsigna = textoConsigna.substring(0, 140) + '...';
                    }

                    resenaHTML += `
                        <li class="mb-2">
                            <strong>Ejercicio ${idx + 1}:</strong> "${textoConsigna}" 
                            <span class="badge bg-light text-dark border ms-1">${p.nivel_bloom || 'Aplicar'}</span>
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
