import { supabase } from './db.js';

const btnGoogleLogin = document.getElementById('btnGoogleLogin');
const formAlumnoAlt = document.getElementById('formAlumnoAlt');
const inputCorreo = document.getElementById('inputCorreo');
const inputClavePin = document.getElementById('inputClavePin');
const alertaError = document.getElementById('alertaError');

function mostrarError(mensaje) {
    alertaError.textContent = mensaje;
    alertaError.classList.remove('d-none');
}

function ocultarError() {
    alertaError.classList.add('d-none');
    alertaError.textContent = '';
}

// 1. CAMINO PRINCIPAL: LOGIN CON GOOGLE
if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
        ocultarError();
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + '/aula-virtual-landing/alumno.html'
                }
            });

            if (error) throw error;
        } catch (err) {
            mostrarError('Error al iniciar con Google: ' + err.message);
        }
    });
}

// 2. CAMINO ALTERNATIVO: LOGIN CON EMAIL Y CONTRASEÑA / PIN
if (formAlumnoAlt) {
    formAlumnoAlt.addEventListener('submit', async (e) => {
        e.preventDefault();
        ocultarError();

        const email = inputCorreo.value.trim();
        const passwordOrPin = inputClavePin.value.trim();

        try {
            // Intento A: Autenticación estándar por email/password en Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password: passwordOrPin
            });

            if (!authError && authData.user) {
                await verificarCursoAlumno(authData.user.email);
                return;
            }

            // Intento B: Verificar si usó su correo + PIN asignado por el docente
            const { data: alumnoPin, error: pinError } = await supabase
                .from('alumnos')
                .select('*, cursos(*)')
                .eq('email', email)
                .eq('pin', passwordOrPin)
                .single();

            if (pinError || !alumnoPin) {
                throw new Error('Credenciales incorrectas. Verificá tu correo y contraseña/PIN.');
            }

            // Guardar sesión temporal del alumno por PIN y redirigir
            localStorage.setItem('alumnoSesion', JSON.stringify(alumnoPin));
            alert(`¡Bienvenido/a ${alumnoPin.nombre} ${alumnoPin.apellido}!`);
            window.location.href = 'aula.html';

        } catch (err) {
            mostrarError(err.message);
        }
    });
}

// 3. COMPROBAR SESIÓN AUTOMÁTICA AL VOLVER DE GOOGLE
async function verificarSesionExistente() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session && session.user) {
        await verificarCursoAlumno(session.user.email);
    }
}

async function verificarCursoAlumno(email) {
    try {
        const { data: alumno, error } = await supabase
            .from('alumnos')
            .select('*, cursos(*)')
            .eq('email', email)
            .single();

        if (error || !alumno) {
            mostrarError('Tu correo (' + email + ') no está registrado en ningún curso activo.');
            await supabase.auth.signOut();
            return;
        }

        localStorage.setItem('alumnoSesion', JSON.stringify(alumno));
        alert(`¡Bienvenido/a ${alumno.nombre} ${alumno.apellido}!`);
        window.location.href = 'aula.html';
    } catch (err) {
        mostrarError('Error al validar la suscripción al curso: ' + err.message);
    }
}

verificarSesionExistente();
