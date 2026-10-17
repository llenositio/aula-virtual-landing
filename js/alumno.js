import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// =========================================================================
// CONFIGURACIÓN DIRECTA DE SUPABASE
// =========================================================================
const SUPABASE_URL = 'https://bpwxxodhiswltefhqbol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3h4b2RoaXN3bHRlZmhxYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzc3NjQsImV4cCI6MjEwNjYxMzc2NH0.tVs4JpCyJFAcakyIHMCV49xiuzNgNr2SeG1S5iUeF48';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ELEMENTOS DEL DOM
const navbarAlumno = document.getElementById('navbarAlumno');
const seccionAuthAlumno = document.getElementById('seccionAuthAlumno');
const seccionDashboardAlumno = document.getElementById('seccionDashboardAlumno');
const btnGoogleLogin = document.getElementById('btnGoogleLogin');
const formAlumnoAlt = document.getElementById('formAlumnoAlt');
const inputCorreo = document.getElementById('inputCorreo');
const inputClavePin = document.getElementById('inputClavePin');
const alertaError = document.getElementById('alertaError');
const btnCerrarSesionAlumno = document.getElementById('btnCerrarSesionAlumno');
const alumnoNombreVista = document.getElementById('alumnoNombreVista');
const alumnoCursoVista = document.getElementById('alumnoCursoVista');
const tablaEvaluacionesAlumnoBody = document.getElementById('tablaEvaluacionesAlumnoBody');

let alumnoActual = null;

function mostrarError(mensaje) {
    if (alertaError) {
        alertaError.textContent = mensaje;
        alertaError.classList.remove('d-none');
    } else {
        alert(mensaje);
    }
}

function ocultarError() {
    if (alertaError) {
        alertaError.classList.add('d-none');
        alertaError.textContent = '';
    }
}

// 1. CAMINO PRINCIPAL: LOGIN CON GOOGLE
if (btnGoogleLogin) {
    btnGoogleLogin.addEventListener('click', async () => {
        ocultarError();
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: window.location.origin + window.location.pathname
                }
            });

            if (error) throw error;
        } catch (err) {
            mostrarError('Error al iniciar con Google: ' + err.message);
        }
    });
}

// 2. CAMINO ALTERNATIVO: LOGIN CON EMAIL / PIN (HÍBRIDO CORREGIDO)
if (formAlumnoAlt) {
    formAlumnoAlt.addEventListener('submit', async (e) => {
        e.preventDefault();
        ocultarError();

        const identificador = inputCorreo.value.trim().toLowerCase();
        const pinIngresado = inputClavePin.value.trim();

        try {
            // Intento A: Supabase Auth Estándar
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: identificador,
                password: pinIngresado
            });

            if (!authError && authData.user) {
                await cargarAlumnoYMostrarDashboard(authData.user.email);
                return;
            }

            // Intento B: Búsqueda flexible por PIN y Correo (Alumno o Tutor)
            const { data: alumnos, error: pinError } = await supabase
                .from('alumnos')
                .select('*, cursos(*)')
                .eq('pin', pinIngresado);

            if (pinError || !alumnos || alumnos.length === 0) {
                throw new Error('Credenciales incorrectas. Verificá tu correo y contraseña/PIN.');
            }

            // Validar que el identificador coincida con el nombre, email de alumno o email de tutor
            const alumnoCoincidente = alumnos.find(a => {
                const nombreL = (a.nombre || '').toLowerCase();
                const emailAL = (a.email_alumno || '').toLowerCase();
                const emailTL = (a.email || '').toLowerCase();

                return nombreL.includes(identificador) || emailAL === identificador || emailTL === identificador;
            }) || alumnos[0]; // Si coincide el PIN único dentro del curso, asigna

            alumnoActual = alumnoCoincidente;
            localStorage.setItem('alumnoSesion', JSON.stringify(alumnoCoincidente));
            mostrarDashboard();

        } catch (err) {
            mostrarError(err.message);
        }
    });
}

// 3. BOTÓN CERRAR SESIÓN
if (btnCerrarSesionAlumno) {
    btnCerrarSesionAlumno.addEventListener('click', () => {
        supabase.auth.signOut();
        localStorage.removeItem('alumnoSesion');
        alumnoActual = null;
        mostrarAuth();
    });
}

// 4. COMPROBAR SESIÓN AUTOMÁTICA
async function verificarSesionExistente() {
    const { data: { session } } = await supabase.auth.getSession();

    if (session && session.user) {
        await cargarAlumnoYMostrarDashboard(session.user.email);
    } else {
        const sesionLocal = localStorage.getItem('alumnoSesion');
        if (sesionLocal) {
            alumnoActual = JSON.parse(sesionLocal);
            mostrarDashboard();
        } else {
            mostrarAuth();
        }
    }
}

async function cargarAlumnoYMostrarDashboard(email) {
    try {
        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select('*, cursos(*)')
            .or(`email_alumno.eq.${email},email.eq.${email}`);

        if (error || !alumnos || alumnos.length === 0) {
            mostrarError('Tu correo (' + email + ') no está registrado en ningún curso activo.');
            await supabase.auth.signOut();
            return;
        }

        alumnoActual = alumnos[0];
        localStorage.setItem('alumnoSesion', JSON.stringify(alumnoActual));
        mostrarDashboard();
    } catch (err) {
        mostrarError('Error al validar el curso del alumno: ' + err.message);
    }
}

// 5. CONTROL DE VISTAS
function mostrarAuth() {
    if (navbarAlumno) navbarAlumno.classList.add('d-none');
    if (seccionDashboardAlumno) seccionDashboardAlumno.classList.add('d-none');
    if (seccionAuthAlumno) seccionAuthAlumno.classList.remove('d-none');
}

function mostrarDashboard() {
    if (seccionAuthAlumno) seccionAuthAlumno.classList.add('d-none');
    if (navbarAlumno) navbarAlumno.classList.remove('d-none');
    if (seccionDashboardAlumno) seccionDashboardAlumno.classList.remove('d-none');

    if (alumnoActual) {
        if (alumnoNombreVista) alumnoNombreVista.innerText = `Hola, ${alumnoActual.nombre || 'Estudiante'} 👋`;
        if (alumnoCursoVista) {
            const cursoNombre = alumnoActual.cursos ? alumnoActual.cursos.nombre : 'Sin Curso';
            const escuelaNombre = alumnoActual.cursos && alumnoActual.cursos.escuela ? ` (${alumnoActual.cursos.escuela})` : '';
            alumnoCursoVista.innerText = `Comisión: ${cursoNombre}${escuelaNombre}`;
        }

        cargarEvaluacionesAsignadas(alumnoActual.curso_id, alumnoActual.id);
    }
}

// 6. CARGA DE TRABAJOS PRÁCTICOS CON TAXONOMÍA DE BLOOM
async function cargarEvaluacionesAsignadas(cursoId, alumnoId) {
    if (!tablaEvaluacionesAlumnoBody) return;
    tablaEvaluacionesAlumnoBody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Cargando evaluaciones asignadas...</td></tr>';

    try {
        const { data: asignaciones, error: errAsig } = await supabase
            .from('curso_evaluaciones')
            .select('*')
            .eq('curso_id', cursoId);

        if (errAsig) throw errAsig;

        if (!asignaciones || asignaciones.length === 0) {
            tablaEvaluacionesAlumnoBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No tenés evaluaciones asignadas en este momento. ¡Buen trabajo! 🎉</td></tr>';
            return;
        }

        const { data: resultados } = await supabase
            .from('evaluaciones_resultados')
            .select('*')
            .eq('alumno_id', alumnoId);

        const mapaResultados = {};
        if (resultados) {
            resultados.forEach(res => { mapaResultados[res.cod_tp] = res; });
        }

        tablaEvaluacionesAlumnoBody.innerHTML = '';

        for (let i = 0; i < asignaciones.length; i++) {
            const asig = asignaciones[i];

            const { data: pregs } = await supabase
                .from('banco_preguntas')
                .select('titulo_humano, nivel_bloom')
                .eq('cod_tp', asig.cod_tp)
                .limit(1);

            const tpInfo = (pregs && pregs.length > 0) ? pregs[0] : null;
            const titulo = tpInfo ? tpInfo.titulo_humano : 'Trabajo Práctico';
            const bloom = tpInfo ? tpInfo.nivel_bloom : 'Comprender';

            const resultadoPrevio = mapaResultados[asig.cod_tp];
            
            let estadoHtml = '<span class="badge bg-warning text-dark">Pendiente</span>';
            let notaHtml = '<span class="text-muted">-</span>';
            let accionHtml = `<a href="aula.html?tp=${asig.cod_tp}" class="btn btn-sm btn-primary fw-bold">Resolver &rarr;</a>`;

            if (resultadoPrevio) {
                estadoHtml = '<span class="badge bg-success">Completado</span>';
                notaHtml = `<strong class="fs-6">${resultadoPrevio.nota || 10} / 10</strong>`;
                accionHtml = `<a href="aula.html?tp=${asig.cod_tp}" class="btn btn-sm btn-outline-secondary">Repasar</a>`;
            }

            tablaEvaluacionesAlumnoBody.innerHTML += `
                <tr>
                    <td class="fw-bold">${i + 1}</td>
                    <td><code>${asig.cod_tp}</code></td>
                    <td class="fw-bold">${titulo}</td>
                    <td><span class="badge bg-info text-dark badge-bloom">${bloom}</span></td>
                    <td>${estadoHtml}</td>
                    <td>${notaHtml}</td>
                    <td class="text-end">${accionHtml}</td>
                </tr>
            `;
        }

    } catch (err) {
        console.error('Error al cargar evaluaciones:', err);
        tablaEvaluacionesAlumnoBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error al cargar evaluaciones: ${err.message}</td></tr>`;
    }
}

verificarSesionExistente();
