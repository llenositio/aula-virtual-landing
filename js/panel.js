import { supabase } from './db.js';

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
            // REGISTRO
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
            // LOGIN
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

// CONTROL DE INTERFAZ SEGÚN ESTADO DE SESIÓN
function actualizarInterfaz(usuario) {
    if (usuario) {
        seccionAuth.classList.add('d-none');
        seccionDashboard.classList.remove('d-none');
        btnCerrarSesion.classList.remove('d-none');
    } else {
        seccionAuth.classList.remove('d-none');
        seccionDashboard.classList.add('d-none');
        btnCerrarSesion.classList.add('d-none');
    }
}

// COMPROBAR SESIÓN AL CARGAR LA PÁGINA
async function chequearSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    actualizarInterfaz(session ? session.user : null);
}

chequearSesion();
