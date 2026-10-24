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
                .eq('email_alumno', mailVal)
                .eq('pin', pinVal);

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
    if (window.location.hash.includes('access_token')) {
        return;
    }

    const sesionLocal = localStorage.getItem('alumnoSesion');
    if (sesionLocal) {
        const temp = JSON.parse(sesionLocal);
        if (temp && temp.id) {
            await refrescarYMostrarAlumnoPorId(temp.id);
            return;
        }
    }

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
            .eq('email_alumno', email);

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
            const cursoNombre = (alumnoActual.cursos && alumnoActual.cursos.anio_division) ? alumnoActual.cursos.anio_division : 'Sin Curso';
            const escuelaNombre = (alumnoActual.cursos && alumnoActual.cursos.institucion) 
                ? ` (${alumnoActual.cursos.institucion})` 
                : '';
            alumnoCursoVista.innerText = `Comisión: ${cursoNombre}${escuelaNombre}`;
        }

        cargarEvaluacionesAsignadas(alumnoActual.curso_id, alumnoActual.id);
    }
}

// 6. CARGA DE EVALUACIONES RESPETANDO LA PLANIFICACIÓN Y VISIBILIDAD DIFERENCIADA
async function cargarEvaluacionesAsignadas(cursoId, alumnoId) {
    const tablaPendientes = document.getElementById('tablaPendientesBody');
    const tablaAprobados = document.getElementById('tablaAprobadosBody');
    
    const cantPendientesEl = document.getElementById('cantPendientes');
    const cantAprobadosEl = document.getElementById('cantAprobados');
    const promedioGeneralEl = document.getElementById('promedioGeneral');
    const badgeCantPendientes = document.getElementById('badgeCantPendientes');
    const badgeCantAprobados = document.getElementById('badgeCantAprobados');

    if (tablaPendientes) tablaPendientes.innerHTML = '<tr><td colspan="7" class="text-center py-4">Cargando evaluaciones asignadas...</td></tr>';
    if (tablaAprobados) tablaAprobados.innerHTML = '<tr><td colspan="7" class="text-center py-4">Cargando evaluaciones asignadas...</td></tr>';

    if (!cursoId) {
        if (tablaPendientes) tablaPendientes.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">El estudiante no está asignado a ningún curso activo.</td></tr>';
        return;
    }

    try {
        // 1. Consultar la PLANIFICACIÓN pedagógica del curso que esté ACTIVA (visible)
        const { data: planDocenteRaw, error: errPlan } = await supabase
            .from('curso_planificacion')
            .select('*')
            .eq('curso_id', cursoId)
            .eq('activo', true)
            .order('periodo_evaluativo', { ascending: true })
            .order('unidad_tematica', { ascending: true })
            .order('orden', { ascending: true });

        if (errPlan) throw errPlan;

        // FILTRADO DE ASIGNACIÓN DIFERENCIADA
        const planDocente = (planDocenteRaw || []).filter(itemPlan => {
            // Si alumnos_asignados es null o está vacío, el TP es para TODO EL CURSO
            if (!itemPlan.alumnos_asignados || itemPlan.alumnos_asignados.length === 0) {
                return true;
            }
            // Si es ASIGNACIÓN DIFERENCIADA, verificar si este alumno está explícitamente en la lista
            return itemPlan.alumnos_asignados.includes(alumnoId);
        });

        if (!planDocente || planDocente.length === 0) {
            const msjVacio = '<tr><td colspan="7" class="text-center text-muted py-4">No tenés evaluaciones asignadas en este momento. ¡Buen trabajo! 🎉</td></tr>';
            if (tablaPendientes) tablaPendientes.innerHTML = msjVacio;
            if (tablaAprobados) tablaAprobados.innerHTML = msjVacio;
            if (cantPendientesEl) cantPendientesEl.innerText = '0';
            if (cantAprobadosEl) cantAprobadosEl.innerText = '0';
            if (promedioGeneralEl) promedioGeneralEl.innerText = '-';
            return;
        }

        // 2. Obtener niveles de Bloom desde el banco para acompañar cada TP
        const listaCodigos = planDocente.map(p => p.cod_tp);
        const { data: bancoDatos } = await supabase
            .from('banco_preguntas')
            .select('cod_tp, nivel_bloom')
            .in('cod_tp', listaCodigos);

        const mapaBloom = {};
        if (bancoDatos) {
            bancoDatos.forEach(b => {
                if (!mapaBloom[b.cod_tp]) mapaBloom[b.cod_tp] = b.nivel_bloom || 'Aplicar';
            });
        }

        // 3. Obtener resultados del alumno
        const { data: resultados } = await supabase
            .from('evaluaciones_resultados')
            .select('*')
            .eq('alumno_id', alumnoId);

        const mapaIntentos = {};
        if (resultados) {
            resultados.forEach(res => {
                const codTp = res.tp_codigo || res.cod_tp;
                const notaActual = (res.nota !== undefined && res.nota !== null) ? Number(res.nota) : 0;
                if (!mapaIntentos[codTp]) {
                    mapaIntentos[codTp] = { maxNota: notaActual, cantIntentos: 1 };
                } else {
                    mapaIntentos[codTp].cantIntentos++;
                    if (notaActual > mapaIntentos[codTp].maxNota) {
                        mapaIntentos[codTp].maxNota = notaActual;
                    }
                }
            });
        }

        const sanitizarBloom = (texto) => {
            if (!texto) return 'Aplicar';
            const partes = texto.replace(/([a-z])([A-Z])/g, '$1,$2').split(/[,/]+/);
            const limpios = partes.map(p => {
                let l = p.trim().toLowerCase();
                if (l.startsWith('comprend')) return 'Comprender';
                if (l.startsWith('analiz')) return 'Analizar';
                if (l.startsWith('aplic')) return 'Aplicar';
                if (l.startsWith('evalu')) return 'Evaluar';
                if (l.startsWith('crea')) return 'Crear';
                if (l.startsWith('record') || l.startsWith('conoc')) return 'Recordar';
                return p.trim();
            });
            return Array.from(new Set(limpios)).join(' / ');
        };

        const listaPendientes = [];
        const listaAprobados = [];
        let sumaNotasAprobadas = 0;

        // 4. Clasificar respetando ALIAS, UNIDAD Y PERÍODO elegidos por el docente
        planDocente.forEach(itemPlan => {
            const codTp = itemPlan.cod_tp;
            const tituloLegible = itemPlan.alias_tp || codTp; 
            const bloom = sanitizarBloom(mapaBloom[codTp]);
            const periodoUnidad = `${itemPlan.periodo_evaluativo} - ${itemPlan.unidad_tematica}`;

            const infoIntento = mapaIntentos[codTp];

            if (infoIntento && infoIntento.maxNota >= 6) {
                sumaNotasAprobadas += infoIntento.maxNota;
                listaAprobados.push({
                    codTp,
                    titulo: tituloLegible,
                    periodoUnidad,
                    bloom,
                    nota: infoIntento.maxNota,
                    intentos: infoIntento.cantIntentos
                });
            } else {
                listaPendientes.push({
                    codTp,
                    titulo: tituloLegible,
                    periodoUnidad,
                    bloom,
                    nota: infoIntento ? infoIntento.maxNota : null,
                    intentos: infoIntento ? infoIntento.cantIntentos : 0
                });
            }
        });

        // 5. Renderizar Pestaña Pendientes
        if (tablaPendientes) {
            if (listaPendientes.length === 0) {
                tablaPendientes.innerHTML = '<tr><td colspan="7" class="text-center text-success fw-bold py-4">🎉 ¡Felicitaciones! No tenés trabajos prácticos pendientes.</td></tr>';
            } else {
                tablaPendientes.innerHTML = listaPendientes.map((item, idx) => {
                    const tieneIntentos = item.intentos > 0;
                    const estadoHtml = tieneIntentos 
                        ? `<span class="badge bg-warning text-dark">A Rehacer (${item.intentos} ${item.intentos === 1 ? 'intento' : 'intentos'})</span>`
                        : `<span class="badge bg-secondary">Sin realizar</span>`;
                    
                    const notaHtml = tieneIntentos 
                        ? `<strong class="text-danger">${item.nota} / 10</strong>` 
                        : `<span class="text-muted">-</span>`;

                    const btnTexto = tieneIntentos ? 'Rehacer TP 🔄' : 'Resolver &rarr;';
                    const btnClass = tieneIntentos ? 'btn-outline-warning text-dark' : 'btn-primary';

                    return `
                        <tr>
                            <td class="fw-bold">${idx + 1}</td>
                            <td><span class="badge bg-light text-dark border">${item.periodoUnidad}</span></td>
                            <td class="fw-bold text-dark">${item.titulo}</td>
                            <td><span class="badge bg-info text-dark">${item.bloom}</span></td>
                            <td>${estadoHtml}</td>
                            <td>${notaHtml}</td>
                            <td class="text-end">
                                <a href="aula.html?tp=${item.codTp}" class="btn btn-sm ${btnClass} fw-bold">${btnTexto}</a>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 6. Renderizar Pestaña Aprobados
        if (tablaAprobados) {
            if (listaAprobados.length === 0) {
                tablaAprobados.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Aún no aprobaste trabajos prácticos. ¡A practicar! 💪</td></tr>';
            } else {
                tablaAprobados.innerHTML = listaAprobados.map((item, idx) => `
                    <tr>
                        <td class="fw-bold">${idx + 1}</td>
                        <td><span class="badge bg-light text-dark border">${item.periodoUnidad}</span></td>
                        <td class="fw-bold text-dark">${item.titulo}</td>
                        <td><span class="badge bg-info text-dark">${item.bloom}</span></td>
                        <td><span class="badge bg-success">Aprobado (${item.intentos} ${item.intentos === 1 ? 'intento' : 'intentos'})</span></td>
                        <td><strong class="text-success fs-6">${item.nota} / 10</strong></td>
                        <td class="text-end">
                            <a href="aula.html?tp=${item.codTp}" class="btn btn-sm btn-outline-primary fw-bold">Repasar 🔄</a>
                        </td>
                    </tr>
                `).join('');
            }
        }

        // 7. Métricas superiores
        const cantPend = listaPendientes.length;
        const cantAprob = listaAprobados.length;
        const promedio = cantAprob > 0 ? (sumaNotasAprobadas / cantAprob).toFixed(1) : '-';

        if (cantPendientesEl) cantPendientesEl.innerText = cantPend;
        if (cantAprobadosEl) cantAprobadosEl.innerText = cantAprob;
        if (badgeCantPendientes) badgeCantPendientes.innerText = cantPend;
        if (badgeCantAprobados) badgeCantAprobados.innerText = cantAprob;
        if (promedioGeneralEl) promedioGeneralEl.innerText = promedio !== '-' ? `${promedio} / 10` : '-';

    } catch (err) {
        console.error('Error al cargar evaluaciones del alumno:', err);
        if (tablaPendientes) tablaPendientes.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error al cargar evaluaciones: ${err.message}</td></tr>`;
    }
}

// INICIALIZACIÓN
verificarSesionExistente();
