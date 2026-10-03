import { supabase, guardarNominaCurso } from './db.js';

// ELEMENTOS DEL DOM
const seccionAuth = document.getElementById('seccionAuth');
const seccionDashboard = document.getElementById('seccionDashboard');
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
const contenedorCursos = document.getElementById('contenedorCursos');

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

        if (cursos.length === 0) {
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
                        <button class="btn btn-outline-primary btn-sm w-100 fw-bold mt-3">Ver Curso & Evaluaciones</button>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        contenedorCursos.innerHTML = `<div class="col-12 alert alert-danger">Error al cargar cursos: ${err.message}</div>`;
    }
}

// CONTROL DE INTERFAZ SEGÚN ESTADO DE SESIÓN
function actualizarInterfaz(usuario) {
    if (usuario) {
        seccionAuth.classList.add('d-none');
        seccionDashboard.classList.remove('d-none');
        btnCerrarSesion.classList.remove('d-none');
        cargarCursos(usuario.id);
    } else {
        seccionAuth.classList.remove('d-none');
        seccionDashboard.classList.add('d-none');
        btnCerrarSesion.classList.add('d-none');
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
