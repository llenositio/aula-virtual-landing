import { supabase } from './supabaseClient.js';

// ELEMENTOS DOM
const seccionAuthAlumno = document.getElementById('seccionAuthAlumno');
const seccionDashboardAlumno = document.getElementById('seccionDashboardAlumno');
const navbarAlumno = document.getElementById('navbarAlumno');

const btnGoogleLogin = document.getElementById('btnGoogleLogin');
const formAlumnoAlt = document.getElementById('formAlumnoAlt');
const inputCorreo = document.getElementById('inputCorreo');
const inputClavePin = document.getElementById('inputClavePin');
const alertaError = document.getElementById('alertaError');

const alumnoNombreVista = document.getElementById('alumnoNombreVista');
const alumnoCursoVista = document.getElementById('alumnoCursoVista');
const tablaEvaluacionesAlumnoBody = document.getElementById('tablaEvaluacionesAlumnoBody');
const btnCerrarSesionAlumno = document.getElementById('btnCerrarSesionAlumno');

let alumnoActual = null;

// UTILS
function mostrarError(msj) {
    if (alertaError) {
        alertaError.innerText = msj;
        alertaError.classList.remove('d-none');
    }
}

function ocultarError() {
    if (alertaError) {
        alertaError.innerText = '';
        alertaError.classList.add('d-none');
    }
}

// 1. INGRESO POR GOOGLE OAUTH
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

// Escuchar evento de retorno de Google Auth
supabase.auth.onAuthStateChange(async (event, session) => {
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && session.user) {
        await cargarAlumnoPorEmail(session.user.email);
    }
});

// 2. INGRESO POR EMAIL Y PIN / CONTRASEÑA
if (formAlumnoAlt) {
    formAlumnoAlt.addEventListener('submit', async (e) => {
        e.preventDefault();
        ocultarError();

        const mailVal = inputCorreo.value.trim().toLowerCase();
        const pinVal = inputClavePin.value.trim();

        try {
            const { data: alumnos, error } = await supabase
                .from('alumnos')
                .select('*, cursos(*)')
                .or(`email_alumno.eq.${mailVal},email.eq.${mailVal}`)
                .eq('pin_acceso', pinVal);

            if (error) throw error;

            if (!alumnos || alumnos.length === 0) {
                mostrarError('Credenciales incorrectas. Verificá tu correo y PIN asignado.');
                return;
            }

            alumnoActual = alumnos[0];
            localStorage.setItem('alumnoSesion', JSON.stringify(alumnoActual));
            mostrarDashboard();
        } catch (err) {
            mostrarError('Error al ingresar: ' + err.message);
        }
    });
}

// 3. CERRAR SESIÓN
if (btnCerrarSesionAlumno) {
    btnCerrarSesionAlumno.addEventListener('click', async () => {
        localStorage.removeItem('alumnoSesion');
        await supabase.auth.signOut();
        alumnoActual = null;
        mostrarAuth();
    });
}

// 4. COMPROBAR SESIÓN AUTOMÁTICA
async function verificarSesionExistente() {
    // Si viene la respuesta con el token de Google en la URL (#access_token), onAuthStateChange se encarga
    if (window.location.hash.includes('access_token')) {
        return;
    }

    // A. Prioridad a la sesión guardada localmente por su ID único
    const sesionLocal = localStorage.getItem('alumnoSesion');
    if (sesionLocal) {
        const temp = JSON.parse(sesionLocal);
        if (temp && temp.id) {
            await refrescarYMostrarAlumnoPorId(temp.id);
            return;
        }
    }

    // B. Si no hay sesión local, consultar sesión activa en Supabase Auth
    const { data: { session } } = await supabase.auth.getSession();
    if (session && session.user) {
        await cargarAlumnoPorEmail(session.user.email);
    } else {
        mostrarAuth();
    }
}

async function cargarAlumnoPorEmail(email) {
    try {
        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select('*, cursos(*)')
            .or(`email_alumno.eq.${email},email.eq.${email}`);

        if (error || !alumnos || alumnos.length === 0) {
            mostrarError(`Tu correo (${email}) no está registrado en ningún curso activo.`);
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

// Refresca la sesión usando siempre la PK (id) indiscutible
async function refrescarYMostrarAlumnoPorId(alumnoId) {
    try {
        const { data: alumnoBD, error } = await supabase
            .from('alumnos')
            .select('*, cursos(*)')
            .eq('id', alumnoId)
            .single();

        if (error || !alumnoBD) {
            localStorage.removeItem('alumnoSesion');
            mostrarAuth();
            return;
        }

        alumnoActual = alumnoBD;
        localStorage.setItem('alumnoSesion', JSON.stringify(alumnoActual));
        mostrarDashboard();
    } catch (err) {
        console.error('Error al refrescar alumno por ID:', err);
        mostrarAuth();
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
        if (alumnoNombreVista) {
            alumnoNombreVista.innerText = `Hola, ${alumnoActual.nombre || 'Estudiante'} 👋`;
        }

        if (alumnoCursoVista) {
            const cursoNombre = (alumnoActual.cursos && alumnoActual.cursos.nombre) ? alumnoActual.cursos.nombre : 'Sin Curso';
            const escuelaNombre = (alumnoActual.cursos && alumnoActual.cursos.escuela && alumnoActual.cursos.escuela !== 'S/E') 
                ? ` (${alumnoActual.cursos.escuela})` 
                : '';
            alumnoCursoVista.innerText = `Comisión: ${cursoNombre}${escuelaNombre}`;
        }

        // Consultar TPs e intentos usando IDs estrictos
        cargarEvaluacionesAsignadas(alumnoActual.curso_id, alumnoActual.id);
    }
}

// 6. CARGA DE EVALUACIONES E INTENTOS BASADA EN IDs RELACIONALES
async function cargarEvaluacionesAsignadas(cursoId, alumnoId) {
    if (!tablaEvaluacionesAlumnoBody) return;
    tablaEvaluacionesAlumnoBody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Cargando evaluaciones asignadas...</td></tr>';

    if (!cursoId) {
        tablaEvaluacionesAlumnoBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">El estudiante no está asignado a ningún curso activo.</td></tr>';
        return;
    }

    try {
        // A. Obtener asignaciones del curso por curso_id
        const { data: asignaciones, error: errAsig } = await supabase
            .from('curso_evaluaciones')
            .select('*')
            .eq('curso_id', cursoId);

        if (errAsig) throw errAsig;

        if (!asignaciones || asignaciones.length === 0) {
            tablaEvaluacionesAlumnoBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No tenés evaluaciones asignadas en este momento. ¡Buen trabajo! 🎉</td></tr>';
            return;
        }

        // B. Obtener intentos por alumno_id (PK)
        const { data: resultados, error: errRes } = await supabase
            .from('evaluaciones_resultados')
            .select('*')
            .eq('alumno_id', alumnoId);

        if (errRes) console.warn('Aviso sobre resultados:', errRes.message);

        // C. Mapear la nota máxima y cantidad de intentos por cod_tp
        const mapaIntentos = {};
        if (resultados) {
            resultados.forEach(res => {
                const notaActual = (res.nota !== undefined && res.nota !== null) ? Number(res.nota) : 0;
                if (!mapaIntentos[res.cod_tp]) {
                    mapaIntentos[res.cod_tp] = { maxNota: notaActual, cantIntentos: 1 };
                } else {
                    mapaIntentos[res.cod_tp].cantIntentos++;
                    if (notaActual > mapaIntentos[res.cod_tp].maxNota) {
                        mapaIntentos[res.cod_tp].maxNota = notaActual;
                    }
                }
            });
        }

        tablaEvaluacionesAlumnoBody.innerHTML = '';

        // D. Renderizar la tabla de evaluaciones
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

            const infoIntento = mapaIntentos[asig.cod_tp];
            
            let estadoHtml = '<span class="badge bg-warning text-dark">Pendiente</span>';
            let notaHtml = '<span class="text-muted">-</span>';
            let accionHtml = `<a href="aula.html?tp=${asig.cod_tp}" class="btn btn-sm btn-primary fw-bold">Resolver &rarr;</a>`;

            if (infoIntento) {
                const notaMax = infoIntento.maxNota;
                const esAprobado = notaMax >= 6;
                const colorNota = esAprobado ? 'text-success' : 'text-danger';

                estadoHtml = `<span class="badge bg-success">Completado (${infoIntento.cantIntentos} ${infoIntento.cantIntentos === 1 ? 'intento' : 'intentos'})</span>`;
                notaHtml = `<strong class="fs-6 ${colorNota}">${notaMax} / 10</strong>`;
                accionHtml = `<a href="aula.html?tp=${asig.cod_tp}" class="btn btn-sm btn-outline-primary fw-bold">Rehacer TP 🔄</a>`;
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

// INICIALIZACIÓN
verificarSesionExistente();
