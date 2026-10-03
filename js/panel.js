import { supabase, guardarNominaCurso } from './db.js';

// ELEMENTOS DEL DOM
const seccionAuth = document.getElementById('seccionAuth');
const seccionDashboard = document.getElementById('seccionDashboard');
const contenedorCursos = document.getElementById('contenedorCursos');
const seccionDetalleCurso = document.getElementById('seccionDetalleCurso');
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

// CAMBIAR ENTRE LOGIN Y REGISTRO
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

// MANEJAR LOGIN Y REGISTRO CON SUPABASE
formAuth.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = authEmail.value;
    const password = authPassword.value;

    try {
        if (esModoRegistro) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre: authNombre.value,
                        apellido: authApellido.value
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

// CERRAR SESIÓN
btnCerrarSesion.addEventListener('click', async () => {
    await supabase.auth.signOut();
    actualizarInterfaz(null);
});

// VOLVER A LA LISTA DE CURSOS
if (btnVolverCursos) {
    btnVolverCursos.addEventListener('click', () => {
        if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');
        if (seccionDashboard) seccionDashboard.classList.remove('d-none');
    });
}

// VER DETALLE DE UN CURSO Y SUS ALUMNOS
async function verDetalleCurso(cursoId, institucion, anioDivision, modalidad) {
    if (seccionDashboard) seccionDashboard.classList.add('d-none');
    if (seccionDetalleCurso) seccionDetalleCurso.classList.remove('d-none');

    if (detalleTituloCurso) detalleTituloCurso.textContent = `${institucion} - ${anioDivision}`;
    if (detalleSubtituloCurso) detalleSubtituloCurso.textContent = `Modalidad: ${modalidad}`;
    if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">Cargando alumnos...</td></tr>`;

    try {
        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select('*')
            .eq('curso_id', cursoId)
            .order('apellido', { ascending: true });

        if (error) throw error;

        if (!alumnos || alumnos.length === 0) {
            tablaAlumnosBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted">No hay alumnos inscriptos en este curso.</td></tr>`;
            return;
        }

        tablaAlumnosBody.innerHTML = alumnos.map((al, index) => `
            <tr>
                <td class="fw-bold">${index + 1}</td>
                <td>${al.apellido}</td>
                <td>${al.nombre}</td>
                <td><code>${al.pin || 'Sin PIN'}</code></td>
            </tr>
        `).join('');

    } catch (err) {
        tablaAlumnosBody.innerHTML = `<tr><td colspan="4" class="text-danger">Error al cargar alumnos: ${err.message}</td></tr>`;
    }
}

// CARGAR LISTA DE CURSOS DESDE SUPABASE
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

        // ASIGNAR EVENTO CLICK A CADA BOTÓN DE CURSO
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

// CONTROL DE INTERFAZ SEGÚN ESTADO DE SESIÓN
function actualizarInterfaz(usuario) {
    if (usuario) {
        if (seccionAuth) seccionAuth.classList.add('d-none');
        if (seccionDashboard) seccionDashboard.classList.remove('d-none');
        if (btnCerrarSesion) btnCerrarSesion.classList.remove('d-none');
        cargarCursos(usuario.id);
    } else {
        if (seccionAuth) seccionAuth.classList.remove('d-none');
        if (seccionDashboard) seccionDashboard.classList.add('d-none');
        if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');
        if (btnCerrarSesion) btnCerrarSesion.classList.add('d-none');
    }
}

// COMPROBAR SESIÓN AL CARGAR PÁGINA
async function chequearSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    actualizarInterfaz(session ? session.user : null);
}

chequearSesion();

// MANEJO DE CREACIÓN DE CURSO Y NÓMINA
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
            const alumnos = lineas.map(linea => {
                let partes = linea.includes(',') ? linea.split(',') : linea.split(' ');
                let apellido = partes[0] || 'SIN APELLIDO';
                let nombre = partes.slice(1).join(' ') || 'SIN NOMBRE';
                return { apellido, nombre };
            });

            if (alumnos.length > 0) {
                await guardarNominaCurso(curso.id, alumnos);
            }

            alert('¡Curso y nómina de alumnos guardados con éxito!');
            location.reload();

        } catch (err) {
            alert('Error al crear el curso: ' + err.message);
        }
    });
}
