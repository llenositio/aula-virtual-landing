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
let alumnoInformeActual = null;

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

    inicializarEventosInformeTutor();
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

// =========================================================================
// RENDERIZADO DE LA MATRIZ DE SEGUIMIENTO (PROCESAMIENTO DE GRID & CELDAS)
// =========================================================================
async function renderizarMatrizSeguimiento(cursoId) {
    const headerRow = document.getElementById('tablaMatrizHeader');
    const bodyContainer = document.getElementById('tablaMatrizBody');

    if (!headerRow || !bodyContainer) return;

    try {
        const { data: alumnos, error: errAlumnos } = await supabase
            .from('alumnos')
            .select('id, apellido, nombre, email_tutor')
            .eq('curso_id', cursoId)
            .order('apellido', { ascending: true });

        if (errAlumnos) throw errAlumnos;

        const { data: tps, error: errTPs } = await supabase
            .from('curso_planificacion')
            .select('id, cod_tp, cod_tp_completo, alias_tp, fecha_vencimiento, activo')
            .eq('curso_id', cursoId)
            .eq('activo', true)
            .order('created_at', { ascending: true });

        if (errTPs) throw errTPs;

        const { data: resultados, error: errRes } = await supabase
            .from('evaluaciones_resultados')
            .select('alumno_id, tp_codigo, nota, tiempo_segundos, foco_perdido, created_at')
            .eq('curso_id', cursoId);

        if (errRes) throw errRes;

        if (!tps || tps.length === 0) {
            headerRow.innerHTML = `<th class="text-start sticky-col">Alumno</th><th class="text-center text-muted">Sin TPs asignados</th>`;
            bodyContainer.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-muted">Aún no hay Trabajos Prácticos cargados en la planificación.</td></tr>`;
            return;
        }

        let htmlHeader = `<th class="text-start sticky-col">Alumno</th>`;
        tps.forEach(tp => {
            const tituloFantasia = tp.alias_tp || tp.cod_tp_completo || tp.cod_tp;
            const codTecnico = tp.cod_tp_completo || tp.cod_tp;
            htmlHeader += `
            <th class="text-center" style="min-width: 120px; vertical-align: bottom;">
            <div class="fw-bold" style="max-width: 140px; font-size: 0.82rem; line-height: 1.2; white-space: normal;">${tituloFantasia}</div>
            <div class="text-muted fw-normal mt-1" style="font-size: 0.68rem;">${codTecnico}</div>
    </th>`;
        });
        headerRow.innerHTML = htmlHeader;

        if (!alumnos || alumnos.length === 0) {
            bodyContainer.innerHTML = `<tr><td colspan="${tps.length + 1}" class="text-center py-4 text-muted">No hay alumnos registrados en esta comisión.</td></tr>`;
            return;
        }

        let htmlBody = '';
        const ahora = new Date();

        alumnos.forEach(alumno => {
            htmlBody += `<tr>`;
            htmlBody += `<td class="sticky-col fw-semibold">${alumno.apellido || 'SIN APELLIDO'}, ${alumno.nombre || 'SIN NOMBRE'}</td>`;

            tps.forEach(tp => {
                const codBuscar = tp.cod_tp_completo || tp.cod_tp;
                
                const entrega = (resultados || []).find(r => 
                r.alumno_id === alumno.id && 
                (r.tp_codigo === codBuscar || r.tp_codigo === tp.cod_tp)
                );
                const fechaVenc = tp.fecha_vencimiento ? new Date(tp.fecha_vencimiento) : null;
                const estaVencido = fechaVenc && ahora > fechaVenc;

                if (entrega) {
                    const nota = parseFloat(entrega.nota || 0);
                    const fugas = entrega.foco_perdido || 0;
                    const mins = Math.floor((entrega.tiempo_segundos || 0) / 60);
                    const segs = (entrega.tiempo_segundos || 0) % 60;
                    const tiempoTexto = `${mins}m ${segs}s`;

                    let tagAtraso = '';
                    let esTardio = false;
                    if (fechaVenc && new Date(entrega.created_at) > fechaVenc) {
                        const diffDias = Math.ceil((new Date(entrega.created_at) - fechaVenc) / (1000 * 60 * 60 * 24));
                        tagAtraso = ` | <span class="text-danger fw-bold">+${diffDias}d</span>`;
                        esTardio = true;
                    }

                    let claseDiag = '';
                    let iconoDiag = '';
                    let descDiag = '';

                    if (nota >= 6 && fugas <= 1) {
                        claseDiag = 'diag-fluido'; iconoDiag = '🟢';
                        descDiag = 'Aprobado con alta autonomía y foco continuo.';
                    } else if (nota >= 6 && fugas > 1) {
                        claseDiag = 'diag-busqueda'; iconoDiag = '🟡';
                        descDiag = 'Aprobado con fugas de pantalla (foco inconstante / consulta de material).';
                    } else if (nota < 6 && fugas <= 1) {
                        claseDiag = 'diag-dificultad'; iconoDiag = '🟠';
                        descDiag = 'Reprobado a pesar de mantener la concentración. Dificultad conceptual real.';
                    } else {
                        claseDiag = 'diag-frustrado'; iconoDiag = '🔴';
                        descDiag = 'Reprobado con múltiples fugas de pantalla. Señal de frustración o abandono temporal.';
                    }

                    htmlBody += `
                        <td class="celda-tp">
                            <div class="fila-nota ${claseDiag}">${nota} ${iconoDiag}</div>
                            <div class="fila-meta"><span>${fugas} fugas</span>${tagAtraso}</div>
                            <div class="tooltip-info">
                                <strong>${alumno.apellido}, ${alumno.nombre}</strong><br>
                                📌 <em>${tp.alias_tp || codBuscar}</em><br>
                                • Calificación: <strong>${nota}/10</strong><br>
                                • Interrupciones: <strong>${fugas} fugas</strong><br>
                                • Tiempo dedicado: <strong>${tiempoTexto}</strong><br>
                                ${esTardio ? '• Estado: <span style="color:#f87171;">Entregado fuera de término</span><br>' : '• Estado: Entregado a tiempo<br>'}
                                💡 <em>${descDiag}</em>
                            </div>
                        </td>`;
                } 
                else if (estaVencido) {
                    htmlBody += `
                        <td class="celda-tp">
                            <div class="fila-nota estado-sin-hacer">Sin Hacer</div>
                            <div class="fila-meta"><span class="text-danger fw-semibold">Vencido</span></div>
                            <div class="tooltip-info">
                                <strong>${alumno.apellido}, ${alumno.nombre}</strong><br>
                                📌 <em>${tp.alias_tp || codBuscar}</em><br>
                                • Estado: <strong>Vencido sin entregar</strong><br>
                                • Fecha Límite: ${fechaVenc.toLocaleDateString()}
                            </div>
                        </td>`;
                } 
                else {
                    htmlBody += `
                        <td class="celda-tp">
                            <div class="fila-nota estado-no-asignado">Pendiente</div>
                            <div class="fila-meta"><span class="text-muted">A tiempo</span></div>
                            <div class="tooltip-info">
                                <strong>${alumno.apellido}, ${alumno.nombre}</strong><br>
                                📌 <em>${tp.alias_tp || codBuscar}</em><br>
                                • Estado: <strong>En curso (Aún no entregado)</strong><br>
                                ${fechaVenc ? '• Vence el: ' + fechaVenc.toLocaleDateString() : '• Sin fecha límite definida'}
                            </div>
                        </td>`;
                }
            });

            htmlBody += `</tr>`;
        });

        bodyContainer.innerHTML = htmlBody;

    } catch (err) {
        console.error("Error al renderizar la matriz de seguimiento:", err);
        bodyContainer.innerHTML = `<tr><td colspan="100%" class="text-center py-4 text-danger">Error al cargar la matriz de seguimiento: ${err.message}</td></tr>`;
    }
}

async function cargarAlumnosCurso(cursoId) {
    const tablaAlumnosBody = document.getElementById('tablaAlumnosBody');
    if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Cargando datos...</td></tr>`;

    try {
        await renderizarMatrizSeguimiento(cursoId);

        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select('*')
            .eq('curso_id', cursoId)
            .order('apellido', { ascending: true });

        if (error) throw error;

        if (!alumnos || alumnos.length === 0) {
            if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">No hay alumnos inscriptos en este curso.</td></tr>`;
            return;
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
                            <button class="btn btn-sm btn-outline-info me-1 btn-ver-detalle-alumno" 
                                    data-id="${al.id}" 
                                    data-nombre="${apellido}, ${nombre}" 
                                    title="Ver Seguimiento Detallado del Alumno">
                                📊 Detalle
                            </button>
                            <button class="btn btn-sm btn-outline-dark me-1 btn-informe-tutor" 
                                    data-id="${al.id}" 
                                    data-apellido="${apellido}" 
                                    data-nombre="${nombre}" 
                                    data-emailtutor="${al.email_tutor || ''}" 
                                    title="Generar Informe Pedagógico para Tutor">
                                📄 Informe Tutor
                            </button>
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
            vincularEventosDetalleAlumno(cursoId);
        }

    } catch (err) {
        console.error('Error al cargar la nómina de alumnos:', err);
        if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-danger py-3">Error: ${err.message}</td></tr>`;
    }
}

function vincularEventosAlumnos(cursoId) {
    document.querySelectorAll('.btn-informe-tutor').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ds = e.currentTarget.dataset;
            alumnoInformeActual = {
                id: ds.id,
                apellido: ds.apellido,
                nombre: ds.nombre,
                emailTutor: ds.emailtutor
            };
            abrirModalInformeTutor();
        });
    });

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
                    const codigoTecnico = tp.cod_tp_completo || tp.cod_tp;
                    const aliasActual = tp.alias_tp || codigoTecnico;
                    const switchChecked = tp.activo ? 'checked' : '';
                    const badgeEstado = tp.activo 
                        ? '<span class="badge bg-success ms-2">Visible</span>' 
                        : '<span class="badge bg-secondary ms-2">Oculto</span>';

                    html += `
                        <tr>
                            <td><code>${codigoTecnico}</code></td>
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
            else {
                alert('✅ Alias guardado correctamente.');
                renderizarMatrizSeguimiento(cursoId);
            }
        });
    });

    document.querySelectorAll('.switch-visibilidad-tp').forEach(sw => {
        sw.addEventListener('change', async (e) => {
            const id = e.currentTarget.dataset.id;
            const activo = e.currentTarget.checked;
            const { error } = await supabase.from('curso_planificacion').update({ activo }).eq('id', id);
            if (error) { alert('Error: ' + error.message); e.currentTarget.checked = !activo; }
            else {
                cargarPlanificacionCurso(cursoId);
                renderizarMatrizSeguimiento(cursoId);
            }
        });
    });

    document.querySelectorAll('.btn-eliminar-tp-plan').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('¿Seguro que querés quitar este TP de la planificación?')) return;
            const id = e.currentTarget.dataset.id;
            const { error } = await supabase.from('curso_planificacion').delete().eq('id', id);
            if (error) alert('Error: ' + error.message);
            else {
                cargarPlanificacionCurso(cursoId);
                renderizarMatrizSeguimiento(cursoId);
            }
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
        let codCompletoReal = codTp;

        const { data: preg } = await supabase
            .from('banco_preguntas')
            .select('titulo_humano, cod_tp_completo')
            .or(`cod_tp_completo.eq.${codTp},cod_tp.eq.${codTp}`)
            .limit(1);

        if (preg && preg.length > 0) {
            if (preg[0].titulo_humano) tituloHumanoDefecto = preg[0].titulo_humano;
            if (preg[0].cod_tp_completo) codCompletoReal = preg[0].cod_tp_completo;
        }

        const { error } = await supabase.from('curso_planificacion').insert([{
            curso_id: cursoActualId,
            cod_tp: codCompletoReal,
            cod_tp_completo: codCompletoReal,
            periodo_evaluativo: periodo,
            unidad_tematica: unidad,
            alias_tp: tituloHumanoDefecto,
            activo: true
        }]);

        if (error) throw error;

        document.getElementById('inputCodTPAsignar').value = '';
        document.getElementById('inputCodTPAsignarTexto').value = '';
        cargarPlanificacionCurso(cursoActualId);
        renderizarMatrizSeguimiento(cursoActualId);

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

        const selectFiltroEstructura = document.getElementById('filtroAnaliticaEstructura');
        if (selectFiltroEstructura) {
            const periodos = [...new Set(plan.map(p => p.periodo_evaluativo).filter(Boolean))];
            
            if (selectFiltroEstructura.options.length <= 1) {
                selectFiltroEstructura.innerHTML = '<option value="TODOS">Todos los Períodos</option>' +
                    periodos.map(p => `<option value="${p}">Período: ${p}</option>`).join('');
            }
        }

        const periodoFiltro = selectFiltroEstructura ? selectFiltroEstructura.value : 'TODOS';

        const planFiltrado = (periodoFiltro && periodoFiltro !== 'TODOS')
            ? plan.filter(p => p.periodo_evaluativo === periodoFiltro)
            : plan;

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
                
                const perteneceAlPlan = planFiltrado.some(p => (p.cod_tp_completo || p.cod_tp) === cod);
                if (!perteneceAlPlan) return;

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
        const labelsTP = planFiltrado.map(p => {
            const alias = p.alias_tp || p.cod_tp_completo || p.cod_tp;
            return alias.length > 20 ? alias.substring(0, 18) + '...' : alias;
        });

        const aprobadosData = planFiltrado.map(p => (notasPorTp[p.cod_tp_completo || p.cod_tp] || []).filter(n => n >= 6).length);
        const reprobadosData = planFiltrado.map(p => (notasPorTp[p.cod_tp_completo || p.cod_tp] || []).filter(n => n < 6).length);

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

        // --- GRÁFICO 4: Diagnóstico por Pregunta ---
        const selectDiag = document.getElementById('selectTpDiagnostico');
        if (selectDiag) {
            selectDiag.innerHTML = '<option value="">Seleccionar TP para diagnosticar...</option>' +
                planFiltrado.map(p => {
                    const cod = p.cod_tp_completo || p.cod_tp;
                    return `<option value="${cod}">${p.alias_tp || cod}</option>`;
                }).join('');

            if (planFiltrado.length > 0) {
                selectDiag.value = planFiltrado[0].cod_tp_completo || planFiltrado[0].cod_tp;
            }

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

                let listaItemsEvaluados = [];

                respsTp[0].forEach((preg, idxPreg) => {
                    let respObj = preg.respuesta;
                    
                    if (typeof respObj === 'string' && respObj.trim().startsWith('{')) {
                        try { respObj = JSON.parse(respObj); } catch(e){}
                    }

                    if (respObj && typeof respObj === 'object' && !Array.isArray(respObj)) {
                        Object.keys(respObj).forEach((subKey) => {
                            const numFila = parseInt(subKey) + 1;
                            listaItemsEvaluados.push({
                                label: `P${idxPreg + 1} - Ítem ${numFila}`,
                                esSubItem: true,
                                idxPreg: idxPreg,
                                subKey: subKey
                            });
                        });
                    } 
                    else {
                        listaItemsEvaluados.push({
                            label: `Pregunta ${idxPreg + 1}`,
                            esSubItem: false,
                            idxPreg: idxPreg
                        });
                    }
                });

                const porcentajesAcierto = listaItemsEvaluados.map(itemSpec => {
                    const aciertos = respsTp.filter(r => {
                        const preg = r[itemSpec.idxPreg];
                        if (!preg) return false;

                        if (itemSpec.esSubItem) {
                            let respAlumno = preg.respuesta;
                            if (typeof respAlumno === 'string' && respAlumno.trim().startsWith('{')) {
                                try { respAlumno = JSON.parse(respAlumno); } catch(e){}
                            }
                            
                            let respCorrecta = preg.correcta;
                            if (typeof respCorrecta === 'string' && respCorrecta.trim().startsWith('{')) {
                                try { respCorrecta = JSON.parse(respCorrecta); } catch(e){}
                            }

                            if (respAlumno && respCorrecta && respAlumno[itemSpec.subKey] !== undefined) {
                                return String(respAlumno[itemSpec.subKey]).trim().toUpperCase() === 
                                       String(respCorrecta[itemSpec.subKey]).trim().toUpperCase();
                            }
                            return false;
                        } else {
                            if (preg.esCorrecta === true || preg.correcta === true || preg.es_correcta === true) return true;
                            if (preg.opcionSeleccionada !== undefined && preg.opcionCorrecta !== undefined) {
                                return preg.opcionSeleccionada === preg.opcionCorrecta;
                            }
                            return false;
                        }
                    }).length;

                    return Math.round((aciertos / respsTp.length) * 100);
                });

                const labelsGrafico = listaItemsEvaluados.map(i => i.label);

                renderizarGrafico('chartDiagnosticoPreguntas', 'bar', {
                    labels: labelsGrafico,
                    datasets: [{
                        label: '% Acierto por Ítem / Afirmación',
                        data: porcentajesAcierto,
                        backgroundColor: porcentajesAcierto.map(val => val < 60 ? '#dc3545' : '#0d6efd')
                    }]
                }, { 
                    scales: { y: { min: 0, max: 100, ticks: { callback: v => v + '%' } } } 
                });
            };

            selectDiag.onchange = (e) => actualizarGraficoDiagnostico(e.target.value);
            if (selectDiag.value) actualizarGraficoDiagnostico(selectDiag.value);
        }

        if (selectFiltroEstructura) {
            selectFiltroEstructura.onchange = () => cargarAnaliticaCurso(cursoId);
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
            .select('cod_tp, cod_tp_completo, titulo_humano, anio, nivel_bloom')
            .order('cod_tp_completo');

        if (error || !data || data.length === 0) {
            const resFallback = await supabase
                .from('tps_matematica')
                .select('cod_tp, cod_tp_completo, titulo_humano, anio, nivel_bloom')
                .order('cod_tp');

            if (!resFallback.error && resFallback.data && resFallback.data.length > 0) {
                data = resFallback.data;
                error = null;
            }
        }

        if (error) throw error;

        const mapaTPs = new Map();
        (data || []).forEach(item => {
            const codigoFinal = item.cod_tp_completo || item.cod_tp;
            if (codigoFinal && !mapaTPs.has(codigoFinal)) {
                mapaTPs.set(codigoFinal, {
                    cod_tp: codigoFinal,
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

            <div class="mt-3 p-3 bg-light rounded border" id="preview-${encodeURIComponent(tp.cod_tp)}" style="display: none;">
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
            const containerPreview = document.getElementById(`preview-${encodeURIComponent(codTp)}`);

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
                    .select('titulo_humano, consigna, nivel_bloom, especialidad_nivel, N_de_orden_pregunta, tipo, opciones')
                    .or(`cod_tp_completo.eq.${codTp},cod_tp.eq.${codTp}`)
                    .order('N_de_orden_pregunta', { ascending: true });

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

                    const esTablaVF = p.tipo === 'VF' || 
                                      p.tipo === 'matriz_vf' || 
                                      (typeof p.opciones === 'string' && p.opciones.includes(',,,'));

                    if (esTablaVF) {
                        let filas = [];
                        if (Array.isArray(p.opciones)) {
                            filas = p.opciones;
                        } else if (typeof p.opciones === 'string') {
                            filas = p.opciones.split(',,,');
                        }

                        let filasTablaHTML = filas.map(f => `
                            <tr>
                                <td style="padding: 4px 8px; border-bottom: 1px solid #e2e8f0; text-align: left;">${f.trim()}</td>
                                <td style="padding: 4px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; width: 40px; font-weight: bold; color: #2563eb;">V</td>
                                <td style="padding: 4px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; width: 40px; font-weight: bold; color: #dc2626;">F</td>
                            </tr>
                        `).join('');

                        resenaHTML += `
                            <li class="mb-3">
                                <strong>Ejercicio ${idx + 1}:</strong> ${textoConsigna}
                                <span class="badge bg-light text-dark border ms-1">${nivelMostrar}</span>
                                <table style="width: 100%; border-collapse: collapse; margin-top: 8px; background: #fff; font-size: 0.85rem; border: 1px solid #e2e8f0;">
                                    <thead>
                                        <tr style="background: #f1f5f9; color: #334155;">
                                            <th style="padding: 4px 8px; text-align: left;">Concepto / Afirmación</th>
                                            <th style="padding: 4px 8px; text-align: center; width: 40px;">V</th>
                                            <th style="padding: 4px 8px; text-align: center; width: 40px;">F</th>
                                        </tr>
                                    </thead>
                                    <tbody>${filasTablaHTML}</tbody>
                                </table>
                            </li>`;
                    } else {
                        resenaHTML += `
                            <li class="mb-2">
                                <strong>Ejercicio ${idx + 1}:</strong> "${textoConsigna}"
                                <span class="badge bg-light text-dark border ms-1">${nivelMostrar}</span>
                            </li>`;
                    }
                });

                resenaHTML += `</ul></div>`;

                containerPreview.innerHTML = resenaHTML;
                containerPreview.dataset.cargado = 'true';
                if (window.MathJax && window.MathJax.typesetPromise) { MathJax.typesetPromise(); }

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

// =========================================================================
// INFORME DETALLADO ALUMNO POR ALUMNO
// =========================================================================
function vincularEventosDetalleAlumno(cursoId) {
    document.querySelectorAll('.btn-ver-detalle-alumno').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const alumnoId = e.currentTarget.dataset.id;
            const nombreAlumno = e.currentTarget.dataset.nombre;

            try {
                const { data: entregas, error } = await supabase
                    .from('evaluaciones_resultados')
                    .select('*')
                    .eq('alumno_id', alumnoId);

                let modalEl = document.getElementById('modalDetalleAlumno');
                if (!modalEl) {
                    const div = document.createElement('div');
                    div.innerHTML = `
                        <div class="modal fade" id="modalDetalleAlumno" tabindex="-1">
                            <div class="modal-dialog modal-lg modal-dialog-scrollable">
                                <div class="modal-content">
                                    <div class="modal-header bg-primary text-white">
                                        <h5 class="modal-title fw-bold" id="modalDetalleAlumnoTitulo">Seguimiento Individual</h5>
                                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                    </div>
                                    <div class="modal-body" id="modalDetalleAlumnoBody"></div>
                                </div>
                            </div>
                        </div>`;
                    document.body.appendChild(div);
                    modalEl = document.getElementById('modalDetalleAlumno');
                }

                document.getElementById('modalDetalleAlumnoTitulo').textContent = `📊 Informe Pedagógico: ${nombreAlumno}`;
                const containerBody = document.getElementById('modalDetalleAlumnoBody');

                if (error || !entregas || entregas.length === 0) {
                    containerBody.innerHTML = `
                        <div class="alert alert-info text-center my-4 py-4">
                            <h5>Sin entregas registradas</h5>
                            <p class="text-muted small mb-0">El alumno no ha realizado evaluaciones hasta el momento.</p>
                        </div>`;
                } else {
                    let html = '<div class="accordion" id="accordionDetalleTPs">';
                    entregas.forEach((ent, idx) => {
                        const tpCodigo = ent.tp_codigo || ent.cod_tp || 'TP';
                        const nota = Number(ent.nota) || 0;
                        const resps = ent.detalle_respuestas || [];

                        html += `
                            <div class="accordion-item mb-3 border rounded shadow-sm">
                                <h2 class="accordion-header">
                                    <button class="accordion-button ${idx !== 0 ? 'collapsed' : ''}" type="button" data-bs-toggle="collapse" data-bs-target="#tpCollapse${idx}">
                                        <div class="d-flex justify-content-between align-items-center w-100 me-3">
                                            <span class="fw-bold text-dark">${tpCodigo}</span>
                                            <div>
                                                <span class="badge ${nota >= 6 ? 'bg-success' : 'bg-danger'} fs-6 me-2">Nota: ${nota.toFixed(1)} / 10</span>
                                                <small class="text-muted">${ent.created_at ? new Date(ent.created_at).toLocaleDateString() : ''}</small>
                                            </div>
                                        </div>
                                    </button>
                                </h2>
                                <div id="tpCollapse${idx}" class="accordion-collapse collapse ${idx === 0 ? 'show' : ''}">
                                    <div class="accordion-body">
                                        <h6 class="fw-bold text-secondary mb-3">Respuesta por Respuesta:</h6>
                                        <ul class="list-group list-group-flush">`;

                        if (Array.isArray(resps)) {
                            resps.forEach((p, pIdx) => {
                                const esOk = p.esCorrecta === true || p.correcta === true || p.es_correcta === true;
                                
                                let respMostrar = p.respuesta || '';
                                try {
                                    if (typeof respMostrar === 'string' && respMostrar.startsWith('{')) {
                                        const parsedObj = JSON.parse(respMostrar);
                                        respMostrar = Object.entries(parsedObj)
                                            .map(([fila, val]) => `Fila ${parseInt(fila) + 1}: ${val}`)
                                            .join(' | ');
                                    }
                                } catch (e) {}

                                html += `
                                    <li class="list-group-item py-2">
                                        <div class="d-flex justify-content-between align-items-center">
                                            <div>
                                                <span class="fw-bold me-2">Pregunta ${pIdx + 1}:</span>
                                                <span class="small text-dark">${p.consigna || 'Consigna evaluada'}</span>
                                            </div>
                                            <div>
                                                ${esOk 
                                                    ? '<span class="badge bg-success-subtle text-success border border-success px-2 py-1">✓ Correcta</span>' 
                                                    : '<span class="badge bg-danger-subtle text-danger border border-danger px-2 py-1">X Incorrecta</span>'}
                                            </div>
                                        </div>
                                        ${respMostrar ? `<div class="small text-muted mt-1"><strong>Respuesta del alumno:</strong> ${respMostrar}</div>` : ''}
                                    </li>`;
                            });
                        }

                        html += `</ul></div></div></div>`;
                    });

                    html += '</div>';
                    containerBody.innerHTML = html;
                }

                const modal = new bootstrap.Modal(modalEl);
                modal.show();

            } catch (err) {
                console.error('Error al mostrar detalle:', err);
            }
        });
    });
}

// =========================================================================
// MÓDULO DE INFORME PEDAGÓGICO PARA TUTORES (PDF & EMAIL)
// =========================================================================
async function abrirModalInformeTutor() {
    if (!alumnoInformeActual || !cursoActualId) return;

    const modalEl = document.getElementById('modalInformeTutor');
    if (!modalEl) return;

    document.getElementById('textoEmailTutorDestino').textContent = alumnoInformeActual.emailTutor || 'Sin email registrado';
    document.getElementById('reporteAlumnoId').value = alumnoInformeActual.id;

    const { data: tps } = await supabase
        .from('curso_planificacion')
        .select('id, cod_tp, cod_tp_completo, alias_tp')
        .eq('curso_id', cursoActualId)
        .eq('activo', true)
        .order('created_at', { ascending: true });

    const selectDesde = document.getElementById('informeTpDesde');
    const selectHasta = document.getElementById('informeTpHasta');

    if (tps && tps.length > 0) {
        const opciones = tps.map(tp => {
            const alias = tp.alias_tp || tp.cod_tp_completo || tp.cod_tp;
            const cod = tp.cod_tp_completo || tp.cod_tp;
            return `<option value="${cod}">${alias}</option>`;
        }).join('');

        if (selectDesde) selectDesde.innerHTML = opciones;
        if (selectHasta) selectHasta.innerHTML = opciones;

        if (selectHasta && tps.length > 1) {
            selectHasta.selectedIndex = tps.length - 1;
        }
    } else {
        if (selectDesde) selectDesde.innerHTML = '<option value="">Sin TPs en la planificación</option>';
        if (selectHasta) selectHasta.innerHTML = '<option value="">Sin TPs en la planificación</option>';
    }

    await actualizarVistaPreviaInforme();

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

async function actualizarVistaPreviaInforme() {
    if (!alumnoInformeActual || !cursoActualId) return;

    const contenedorPrevia = document.getElementById('hojaPrevisualizacionPDF');
    if (!contenedorPrevia) return;

    contenedorPrevia.innerHTML = '<div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Generando vista previa A4...</div>';

    try {
        const incluirFoco = document.getElementById('checkIncluirFoco')?.checked ?? true;
        const incluirSaberes = document.getElementById('checkIncluirSaberes')?.checked ?? true;
        const observacionDocente = document.getElementById('observacionDocenteInforme')?.value.trim() || '';

        const { data: resultados } = await supabase
            .from('evaluaciones_resultados')
            .select('*')
            .eq('curso_id', cursoActualId)
            .eq('alumno_id', alumnoInformeActual.id)
            .order('created_at', { ascending: true });

        const { data: plan } = await supabase
            .from('curso_planificacion')
            .select('cod_tp, cod_tp_completo, alias_tp')
            .eq('curso_id', cursoActualId);

        const mapaAlias = {};
        if (plan) {
            plan.forEach(p => {
                mapaAlias[p.cod_tp_completo || p.cod_tp] = p.alias_tp || p.cod_tp_completo || p.cod_tp;
            });
        }

        let listaTpsHtml = '';
        let sumaNotas = 0;
        let cantNotas = 0;
        let totalFugas = 0;

        if (resultados && resultados.length > 0) {
            resultados.forEach(r => {
                const cod = r.tp_codigo || r.cod_tp;
                const nombreFantasia = mapaAlias[cod] || cod;
                const nota = parseFloat(r.nota || 0);
                sumaNotas += nota;
                cantNotas++;
                totalFugas += (r.foco_perdido || 0);

                const fechaFormateada = new Date(r.created_at).toLocaleDateString();

                listaTpsHtml += `
                    <li style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding: 6px 0;">
                        <span>• <strong>${nombreFantasia}</strong> <small class="text-muted">(${fechaFormateada})</small></span>
                        <span><strong>Nota: ${nota}/10</strong></span>
                    </li>`;
            });
        } else {
            listaTpsHtml = `<li class="text-muted py-2 small">Aún no se registran calificaciones en el período seleccionado.</li>`;
        }

        const promedio = cantNotas > 0 ? (sumaNotas / cantNotas).toFixed(1) : 'S/D';

        let textoAutonomia = 'Presenta excelente concentración y resolución continua sin distracciones.';
        if (totalFugas > 5) {
            textoAutonomia = 'Muestra buena dedicación en tiempo, aunque se observan distracciones o interrupciones frecuentes durante las consignas.';
        } else if (totalFugas > 2) {
            textoAutonomia = 'Resolución constante con mínimas interrupciones o consultas externas puntualizadas.';
        }

        const fechaEmision = new Date().toLocaleDateString();
        const nombreEscuela = cursoActualInfo?.escuela || 'INSTITUCIÓN EDUCATIVA';
        const nombreCurso = cursoActualInfo?.nombre || 'Curso de Educación Secundaria';

        const htmlDocumento = `
            <div style="font-family: Arial, sans-serif; color: #1e293b; line-height: 1.4;">
                <div style="border-bottom: 2px solid #0d6efd; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-start;">
                    <div>
                        <h6 style="font-weight: bold; margin: 0; color: #0d6efd; text-transform: uppercase;">${nombreEscuela}</h6>
                        <small style="color: #64748b;">${nombreCurso}</small>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-size: 0.75rem; font-weight: bold; background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">INFORME PEDAGÓGICO</span><br>
                        <small style="font-size: 0.7rem; color: #64748b;">Emisión: ${fechaEmision}</small>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 15px; font-size: 0.8rem;">
                    <div><strong>Estudiante:</strong> ${alumnoInformeActual.apellido}, ${alumnoInformeActual.nombre}</div>
                    <div><strong>Tutor Responsable:</strong> ${alumnoInformeActual.emailTutor || 'No registrado'}</div>
                </div>

                <div style="margin-bottom: 15px;">
                    <div style="font-weight: bold; font-size: 0.85rem; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; mb-2;">
                        📋 RESUMEN DE ACTIVIDADES Y EVALUACIONES
                    </div>
                    <ul style="list-style: none; padding-left: 0; margin-top: 6px; font-size: 0.8rem;">
                        ${listaTpsHtml}
                    </ul>
                </div>

                ${incluirFoco ? `
                <div style="margin-bottom: 15px; background: #fff; border-left: 3px solid #0d6efd; padding: 8px 12px; font-size: 0.8rem;">
                    <strong style="color: #0d6efd;">💡 Autonomía y Promedio General:</strong>
                    <div style="margin-top: 4px;">• Promedio de Aprobación: <strong>${promedio} / 10</strong></div>
                    <div style="margin-top: 2px;">• Hábitos de Foco: ${textoAutonomia}</div>
                </div>` : ''}

                ${incluirSaberes ? `
                <div style="margin-bottom: 15px; font-size: 0.8rem;">
                    <div style="font-weight: bold; font-size: 0.85rem; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-bottom: 6px;">
                        🎯 FORTALEZAS Y CONTENIDOS A REFORZAR
                    </div>
                    <div>🟢 <strong>Fortalezas:</strong> Cumplimiento de entregas y comprensión general de consignas básicas.</div>
                    <div style="margin-top: 4px;">🔴 <strong>A reforzar en casa:</strong> Repasar ejercicios prácticos de razonamiento y ejercitación autónoma antes de las instancias sumativas.</div>
                </div>` : ''}

                ${observacionDocente ? `
                <div style="background: #f1f5f9; border-radius: 6px; padding: 10px; font-size: 0.8rem; margin-top: 15px;">
                    <strong>✍️ Observación Personalizada del Profesor:</strong>
                    <p style="margin: 4px 0 0 0; font-style: italic; color: #334155;">"${observacionDocente}"</p>
                </div>` : ''}
            </div>
        `;

        contenedorPrevia.innerHTML = htmlDocumento;

        // Maquetación de la Pestaña 2: Vista Previa del Email
        const contenedorEmail = document.getElementById('vistaPreviaEmailContainer');
        if (contenedorEmail) {
            const htmlEmail = `
                <div style="font-family: Arial, sans-serif; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
                    <div style="background: #212529; color: #ffffff; padding: 12px 16px; font-size: 0.82rem;">
                        <div style="margin-bottom: 4px;"><strong>De:</strong> Equipo Docente &lt;notificaciones@aulavirtual.edu.ar&gt;</div>
                        <div style="margin-bottom: 4px;"><strong>Para:</strong> ${alumnoInformeActual.emailTutor || 'Sin correo registrado'}</div>
                        <div><strong>Asunto:</strong> 📊 Informe Pedagógico de Seguimiento: ${alumnoInformeActual.apellido}, ${alumnoInformeActual.nombre}</div>
                    </div>

                    <div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 8px 16px; font-size: 0.78rem; color: #475569; display: flex; align-items: center; gap: 8px;">
                        <span>📎 <strong>Adjunto:</strong></span>
                        <span style="background: #e2e8f0; padding: 2px 8px; border-radius: 4px; font-family: monospace;">Informe_Pedagogico_${alumnoInformeActual.apellido}_${alumnoInformeActual.nombre}.pdf</span>
                    </div>

                    <div style="padding: 20px; color: #1e293b; font-size: 0.85rem; line-height: 1.5;">
                        <p>Estimado/a tutor/a de <strong>${alumnoInformeActual.nombre} ${alumnoInformeActual.apellido}</strong>,</p>

                        <p>Le hacemos llegar el Informe Pedagógico de Seguimiento correspondiente a la materia <strong>${nombreCurso}</strong> (${nombreEscuela}).</p>

                        <div style="background: #f1f5f9; border-left: 4px solid #0d6efd; padding: 10px 14px; margin: 15px 0; border-radius: 0 6px 6px 0;">
                            <strong>📌 Resumen Ejecutivo de Evaluación:</strong>
                            <ul style="margin: 6px 0 0 0; padding-left: 18px;">
                                <li><strong>Promedio Académico:</strong> ${promedio} / 10</li>
                                <li><strong>Evaluaciones Registradas:</strong> ${cantNotas} TPs</li>
                                ${incluirFoco ? `<li><strong>Foco y Autonomía:</strong> ${textoAutonomia}</li>` : ''}
                            </ul>
                        </div>

                        ${observacionDocente ? `
                        <p><strong>Observación del Profesor:</strong><br>
                        <em style="color: #475569;">"${observacionDocente}"</em></p>
                        ` : ''}

                        <p>En el documento PDF adjunto a este correo encontrará el desglose pormenorizado de los Trabajos Prácticos, calificaciones e ítems conceptuales a reforzar.</p>

                        <p style="margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px; color: #64748b; font-size: 0.78rem;">
                            Atentamente,<br>
                            <strong>Equipo Docente de Matemática</strong><br>
                            ${nombreEscuela}
                        </p>
                    </div>
                </div>
            `;

            contenedorEmail.innerHTML = htmlEmail;
        }

    } catch (err) {
        console.error('Error al generar la vista previa del informe:', err);
        contenedorPrevia.innerHTML = `<div class="alert alert-danger p-3 small">Error al generar la vista previa: ${err.message}</div>`;
    }
}

function inicializarEventosInformeTutor() {
    const btnActualizar = document.getElementById('btnActualizarVistaPrevia');
    if (btnActualizar) {
        btnActualizar.addEventListener('click', () => actualizarVistaPreviaInforme());
    }

    const btnDescargar = document.getElementById('btnDescargarPDF');
    if (btnDescargar) {
        btnDescargar.addEventListener('click', () => {
            window.print();
        });
    }

    const btnEnviar = document.getElementById('btnEnviarEmailTutor');
    if (btnEnviar) {
        btnEnviar.addEventListener('click', async () => {
            if (!alumnoInformeActual || !alumnoInformeActual.emailTutor) {
                alert('El alumno no tiene registrado un correo electrónico de tutor válido.');
                return;
            }

            try {
                btnEnviar.disabled = true;
                btnEnviar.textContent = '⏳ Enviando...';

                await new Promise(resolve => setTimeout(resolve, 1500));

                alert(`¡Informe pedagógico enviado exitosamente al correo ${alumnoInformeActual.emailTutor}!`);

                const modalEl = document.getElementById('modalInformeTutor');
                if (modalEl) {
                    const modalInstance = bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) modalInstance.hide();
                }

            } catch (err) {
                alert('Error al enviar el correo: ' + err.message);
            } finally {
                btnEnviar.disabled = false;
                btnEnviar.textContent = '✉️ Enviar a Tutor';
            }
        });
    }

    const tipoRangoSelect = document.getElementById('tipoRangoInforme');
    if (tipoRangoSelect) {
        tipoRangoSelect.addEventListener('change', (e) => {
            const esPorTps = e.target.value === 'TPs';
            document.getElementById('selectorRangoTPs')?.classList.toggle('d-none', !esPorTps);
            document.getElementById('selectorRangoFechas')?.classList.toggle('d-none', esPorTps);
        });
    }
}
