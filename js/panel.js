// js/panel.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { abrirModalInformeTutor, actualizarVistaPreviaInforme, inicializarEventosInformeTutor } from './informes_tutor.js';
import { cargarAnaliticaCurso } from './analitica.js';
import { cargarPlanificacionCurso, cargarBancoGlobal, aplicarFiltrosBanco, ejecutarAsignacionTP } from './planificacion.js';

// =========================================================================
// CONFIGURACIÓN DE SUPABASE
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
const formAuth = document.getElementById('formAuth');
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
let modalPerfilInstancia = null;
let alumnoInformeActual = null;

// =========================================================================
// EVENTOS PRINCIPALES DE AUTENTICACIÓN
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    const btnGoogle = document.getElementById('btnGoogleAuth');
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: window.location.origin + window.location.pathname }
                });
                if (error) throw error;
            } catch (err) {
                alert('Error al iniciar sesión con Google: ' + err.message);
            }
        });
    }

    inicializarEventosInformeTutor(() => actualizarVistaPreviaInforme(alumnoInformeActual, cursoActualId, cursoActualInfo, supabase));

    const btnEnviarEmail = document.getElementById('btnEnviarEmailTutor');
    if (btnEnviarEmail) {
        btnEnviarEmail.addEventListener('click', async () => {
            if (!alumnoInformeActual || !alumnoInformeActual.emailTutor) {
                alert('El alumno no tiene registrado un correo electrónico de tutor válido.');
                return;
            }
            try {
                btnEnviarEmail.disabled = true;
                btnEnviarEmail.textContent = '⏳ Enviando...';
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
                btnEnviarEmail.disabled = false;
                btnEnviarEmail.textContent = '✉️ Enviar a Tutor';
            }
        });
    }
});

if (toggleAuthMode) {
    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        esModoRegistro = !esModoRegistro;

        if (esModoRegistro) {
            document.getElementById('authTitulo').textContent = 'Crear Cuenta Docente';
            btnAuthSubmit.textContent = 'Registrarse';
            camposRegistro.classList.remove('d-none');
            toggleAuthMode.textContent = '¿Ya tenés cuenta? Iniciá sesión acá';
        } else {
            document.getElementById('authTitulo').textContent = 'Iniciar Sesión';
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
                    options: { data: { nombre: authNombre ? authNombre.value : '', apellido: authApellido ? authApellido.value : '' } }
                });
                if (error) throw error;
                alert('¡Registro exitoso! Ya podés ingresar.');
                toggleAuthMode.click();
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
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
            const { data: prof, error } = await supabase.from('profesores').select('*').eq('id', usuario.id).maybeSingle();

            if (error || !prof) {
                if (seccionDashboard) seccionDashboard.classList.add('d-none');
                if (seccionDetalleCurso) seccionDetalleCurso.classList.add('d-none');

                const elemNombre = document.getElementById('perfilNombre');
                if (elemNombre && !elemNombre.value) {
                    elemNombre.value = usuario.user_metadata?.full_name || usuario.user_metadata?.nombre || '';
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

async function inicializarSesion() {
    const { data: { session } } = await supabase.auth.getSession();
    actualizarInterfaz(session ? session.user : null);
    supabase.auth.onAuthStateChange((_event, session) => {
        actualizarInterfaz(session ? session.user : null);
    });
}

inicializarSesion();

// =========================================================================
// GESTIÓN DE CURSOS Y ALUMNOS
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
            contenedorCursos.innerHTML = `<div class="col-12 text-center text-muted py-5"><p>No tenés cursos creados todavía. ¡Creá el primero!</p></div>`;
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
            </div>`).join('');

        document.querySelectorAll('.btn-ver-curso').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget;
                verDetalleCurso(target.dataset.id, target.dataset.nombre, target.dataset.escuela);
            });
        });
    } catch (err) {
        contenedorCursos.innerHTML = `<div class="col-12 alert alert-danger">Error al cargar cursos: ${err.message}</div>`;
    }
}

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
        detalleSubtituloCurso.innerHTML = `${textoEscuela} <button class="btn btn-sm btn-link p-0 ms-2 text-decoration-none" id="btnAbrirEditarCurso">✏️ Editar datos</button>`;
    }

    await cargarAlumnosCurso(cursoId);
    await cargarPlanificacionCurso(cursoId, supabase, renderizarMatrizSeguimiento);
    await cargarAnaliticaCurso(cursoId, supabase);
}

async function renderizarMatrizSeguimiento(cursoId) {
    const headerRow = document.getElementById('tablaMatrizHeader');
    const bodyContainer = document.getElementById('tablaMatrizBody');
    if (!headerRow || !bodyContainer) return;

    try {
        const { data: alumnos } = await supabase.from('alumnos').select('id, apellido, nombre, email_tutor').eq('curso_id', cursoId).order('apellido', { ascending: true });
        const { data: tps } = await supabase.from('curso_planificacion').select('id, cod_tp, cod_tp_completo, alias_tp, fecha_vencimiento, activo').eq('curso_id', cursoId).eq('activo', true);
        const { data: resultados } = await supabase.from('evaluaciones_resultados').select('alumno_id, tp_codigo, nota, tiempo_segundos, foco_perdido, created_at').eq('curso_id', cursoId);

        if (!tps || tps.length === 0) {
            headerRow.innerHTML = `<th class="text-start sticky-col">Alumno</th><th class="text-center text-muted">Sin TPs asignados</th>`;
            bodyContainer.innerHTML = `<tr><td colspan="2" class="text-center py-4 text-muted">Aún no hay Trabajos Prácticos cargados en la planificación.</td></tr>`;
            return;
        }

        let htmlHeader = `<th class="text-start sticky-col">Alumno</th>`;
        tps.forEach(tp => {
            const tituloFantasia = tp.alias_tp || tp.cod_tp_completo || tp.cod_tp;
            htmlHeader += `<th class="text-center"><div class="fw-bold">${tituloFantasia}</div></th>`;
        });
        headerRow.innerHTML = htmlHeader;

        if (!alumnos || alumnos.length === 0) {
            bodyContainer.innerHTML = `<tr><td colspan="${tps.length + 1}" class="text-center py-4 text-muted">No hay alumnos registrados.</td></tr>`;
            return;
        }

        let htmlBody = '';
        alumnos.forEach(alumno => {
            htmlBody += `<tr><td class="sticky-col fw-semibold">${alumno.apellido}, ${alumno.nombre}</td>`;
            tps.forEach(tp => {
                const codBuscar = tp.cod_tp_completo || tp.cod_tp;
                const entrega = (resultados || []).find(r => r.alumno_id === alumno.id && (r.tp_codigo === codBuscar || r.tp_codigo === tp.cod_tp));
                
                if (entrega) {
                    htmlBody += `<td class="celda-tp"><div class="fila-nota">${entrega.nota}</div></td>`;
                } else {
                    htmlBody += `<td class="celda-tp"><div class="fila-nota estado-no-asignado">Pendiente</div></td>`;
                }
            });
            htmlBody += `</tr>`;
        });
        bodyContainer.innerHTML = htmlBody;
    } catch (err) {
        console.error("Error al renderizar matriz:", err);
    }
}

async function cargarAlumnosCurso(cursoId) {
    const tablaAlumnosBody = document.getElementById('tablaAlumnosBody');
    if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Cargando datos...</td></tr>`;

    try {
        await renderizarMatrizSeguimiento(cursoId);
        const { data: alumnos, error } = await supabase.from('alumnos').select('*').eq('curso_id', cursoId).order('apellido', { ascending: true });

        if (error) throw error;
        if (!alumnos || alumnos.length === 0) {
            if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">No hay alumnos inscriptos.</td></tr>`;
            return;
        }

        if (tablaAlumnosBody) {
            tablaAlumnosBody.innerHTML = alumnos.map((al, index) => `
                <tr>
                    <td class="fw-bold">${index + 1}</td>
                    <td>${al.apellido || '-'}</td>
                    <td>${al.nombre || '-'}</td>
                    <td>${al.email_alumno || '-'}</td>
                    <td>${al.email_tutor || '-'}</td>
                    <td><code>${al.pin || '-'}</code></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-dark btn-informe-tutor" data-id="${al.id}" data-apellido="${al.apellido}" data-nombre="${al.nombre}" data-emailtutor="${al.email_tutor || ''}">📄 Informe Tutor</button>
                    </td>
                </tr>`).join('');

            document.querySelectorAll('.btn-informe-tutor').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const ds = e.currentTarget.dataset;
                    alumnoInformeActual = { id: ds.id, apellido: ds.apellido, nombre: ds.nombre, emailTutor: ds.emailtutor };
                    abrirModalInformeTutor(alumnoInformeActual, cursoActualId, supabase, () => actualizarVistaPreviaInforme(alumnoInformeActual, cursoActualId, cursoActualInfo, supabase));
                });
            });
        }
    } catch (err) {
        console.error('Error al cargar alumnos:', err);
    }
}

// Búsqueda del Banco y Asignaciones
document.getElementById('btnAgregarAlPlan')?.addEventListener('click', async () => {
    const codTp = document.getElementById('inputCodTPAsignar').value;
    const periodo = document.getElementById('inputNuevoPeriodo').value.trim() || '1° Trimestre';
    const unidad = document.getElementById('inputNuevaUnidad').value.trim() || 'Unidad 1';

    if (!cursoActualId || !codTp) {
        alert('Por favor seleccioná un TP.');
        return;
    }

    try {
        await supabase.from('curso_planificacion').insert([{ curso_id: cursoActualId, cod_tp: codTp, cod_tp_completo: codTp, periodo_evaluativo: periodo, unidad_tematica: unidad, alias_tp: codTp, activo: true }]);
        document.getElementById('inputCodTPAsignar').value = '';
        cargarPlanificacionCurso(cursoActualId, supabase, renderizarMatrizSeguimiento);
        renderizarMatrizSeguimiento(cursoActualId);
    } catch (err) {
        alert('Error: ' + err.message);
    }
});

const modalAsignarTP = document.getElementById('modalAsignarTP');
if (modalAsignarTP) {
    modalAsignarTP.addEventListener('show.bs.modal', () => cargarBancoGlobal(supabase));
}

document.getElementById('filtroTextoTP')?.addEventListener('input', () => aplicarFiltrosBanco(supabase));
document.getElementById('filtroBloomTP')?.addEventListener('change', () => aplicarFiltrosBanco(supabase));
document.getElementById('filtroAnioTP')?.addEventListener('change', () => aplicarFiltrosBanco(supabase));
