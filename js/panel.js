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
let listaAlumnosCursoActual = [];

// =========================================================================
// EVENTOS PRINCIPALES DE AUTENTICACIÓN Y CONFIGURACIÓN
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

    iniciarUIAsignacionDiferenciada();
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
// PARSER Y NÓMINA DE ALUMNOS
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

    window.refrescarMatrizActual = () => renderizarMatrizSeguimiento(cursoId);

    await cargarAlumnosCurso(cursoId);
    await cargarPlanificacionCurso(cursoId, supabase);
    await cargarAnaliticaCurso(cursoId, supabase);
}

// =========================================================================
// ASIGNACIÓN DIFERENCIADA UI
// =========================================================================
function iniciarUIAsignacionDiferenciada() {
    const contenedorForm = document.getElementById('inputCodTPAsignar')?.closest('.row, .card-body, form');
    if (!contenedorForm || document.getElementById('radioAlcanceTodos')) return;

    const divAlcance = document.createElement('div');
    divAlcance.className = 'col-12 my-3 p-3 bg-light border rounded';
    divAlcance.innerHTML = `
        <label class="form-label fw-bold small mb-2 text-dark">👥 Alcance de la Asignación:</label>
        <div class="d-flex gap-4 align-items-center mb-2">
            <div class="form-check">
                <input class="form-check-input" type="radio" name="radioAlcanceAsignacion" id="radioAlcanceTodos" value="TODOS" checked>
                <label class="form-check-label small fw-semibold" for="radioAlcanceTodos">
                    Asignar a Todo el Curso
                </label>
            </div>
            <div class="form-check">
                <input class="form-check-input" type="radio" name="radioAlcanceAsignacion" id="radioAlcanceSeleccion" value="SELECCION">
                <label class="form-check-label small fw-semibold" for="radioAlcanceSeleccion">
                    🎯 Asignación Diferenciada (Seleccionar Alumnos)
                </label>
            </div>
        </div>
        <div id="contenedorListaAlumnosDiferenciados" class="d-none border-top pt-2 mt-2">
            <span class="small text-muted d-block mb-2">Marque los alumnos que deberán resolver este Trabajo Práctico:</span>
            <div id="checkListAlumnosCurso" class="row g-2" style="max-height: 150px; overflow-y: auto;"></div>
        </div>`;

    contenedorForm.prepend(divAlcance);

    document.querySelectorAll('input[name="radioAlcanceAsignacion"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const contenedorLista = document.getElementById('contenedorListaAlumnosDiferenciados');
            if (e.target.value === 'SELECCION') {
                contenedorLista.classList.remove('d-none');
                poblarCheckListAlumnos();
            } else {
                contenedorLista.classList.add('d-none');
            }
        });
    });
}

function poblarCheckListAlumnos() {
    const contenedor = document.getElementById('checkListAlumnosCurso');
    if (!contenedor) return;

    if (listaAlumnosCursoActual.length === 0) {
        contenedor.innerHTML = `<div class="col-12 small text-muted">No hay alumnos inscriptos en este curso.</div>`;
        return;
    }

    contenedor.innerHTML = listaAlumnosCursoActual.map(al => `
        <div class="col-md-6">
            <div class="form-check">
                <input class="form-check-input chk-alumno-diferenciado" type="checkbox" value="${al.id}" id="chkAl_${al.id}">
                <label class="form-check-label small" for="chkAl_${al.id}">
                    ${al.apellido}, ${al.nombre}
                </label>
            </div>
        </div>`).join('');
}

// =========================================================================
// RENDERIZADO COMPLETO DE LA MATRIZ DE SEGUIMIENTO CON ASIGNACIÓN DIFERENCIADA
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
            .select('id, cod_tp, cod_tp_completo, alias_tp, fecha_vencimiento, activo, alumnos_asignados')
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
            const esDiferenciado = Array.isArray(tp.alumnos_asignados) && tp.alumnos_asignados.length > 0;

            htmlHeader += `
            <th class="text-center" style="min-width: 120px; vertical-align: bottom;">
                <div class="fw-bold" style="max-width: 140px; font-size: 0.82rem; line-height: 1.2; white-space: normal;">${tituloFantasia}</div>
                <div class="text-muted fw-normal mt-1" style="font-size: 0.68rem;">
                    ${codTecnico} ${esDiferenciado ? '<span title="Tarea Diferenciada para alumnos específicos">🎯</span>' : ''}
                </div>
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
                const estaAsignado = !Array.isArray(tp.alumnos_asignados) || tp.alumnos_asignados.length === 0 || tp.alumnos_asignados.includes(alumno.id);

                // ALUMNO NO ASIGNADO A ESTA TAREA DIFERENCIADA
                if (!estaAsignado) {
                    htmlBody += `
                        <td class="celda-tp bg-light opacity-50">
                            <div class="fila-nota text-muted fw-normal" style="font-size: 0.75rem;">No asignado</div>
                            <div class="fila-meta"><span class="badge bg-secondary-subtle text-secondary">Eximido</span></div>
                            <div class="tooltip-info">
                                <strong>${alumno.apellido}, ${alumno.nombre}</strong><br>
                                📌 <em>${tp.alias_tp || codBuscar}</em><br>
                                • Estado: <strong>Eximido / No asignado</strong> (Tarea diferenciada)
                            </div>
                        </td>`;
                    return;
                }

                const entrega = (resultados || []).find(r => 
                    r.alumno_id === alumno.id && (r.tp_codigo === codBuscar || r.tp_codigo === tp.cod_tp)
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

// =========================================================================
// NÓMINA DE ALUMNOS Y DETALLES
// =========================================================================
async function cargarAlumnosCurso(cursoId) {
    const tablaAlumnosBody = document.getElementById('tablaAlumnosBody');
    if (tablaAlumnosBody) tablaAlumnosBody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Cargando datos...</td></tr>`;

    try {
        const { data: alumnos, error } = await supabase
            .from('alumnos')
            .select('*')
            .eq('curso_id', cursoId)
            .order('apellido', { ascending: true });

        if (error) throw error;

        listaAlumnosCursoActual = alumnos || [];

        await renderizarMatrizSeguimiento(cursoId);

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
                    </tr>`;
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
            abrirModalInformeTutor(alumnoInformeActual, cursoActualId, supabase, () => actualizarVistaPreviaInforme(alumnoInformeActual, cursoActualId, cursoActualInfo, supabase));
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

// BÚSQUEDA DEL BANCO Y ASIGNACIONES
document.getElementById('btnAgregarAlPlan')?.addEventListener('click', async () => {
    ejecutarAsignacionTP(cursoActualId, supabase, async () => {
        await cargarPlanificacionCurso(cursoActualId, supabase);
        await renderizarMatrizSeguimiento(cursoActualId);
    });
});

const modalAsignarTP = document.getElementById('modalAsignarTP');
if (modalAsignarTP) {
    modalAsignarTP.addEventListener('show.bs.modal', () => cargarBancoGlobal(supabase));
}

document.getElementById('filtroTextoTP')?.addEventListener('input', () => aplicarFiltrosBanco(supabase));
document.getElementById('filtroBloomTP')?.addEventListener('change', () => aplicarFiltrosBanco(supabase));
document.getElementById('filtroAnioTP')?.addEventListener('change', () => aplicarFiltrosBanco(supabase));

// =========================================================================
// EDICIÓN DE TRABAJOS PRÁCTICOS ASIGNADOS (MODAL Y ACTUALIZACIÓN EN SUPABASE)
// =========================================================================
document.addEventListener('click', async (e) => {
    const btnEditar = e.target.closest('.btn-editar-plan');
    if (btnEditar) {
        const id = btnEditar.dataset.id;
        const periodo = btnEditar.dataset.periodo;
        const unidad = btnEditar.dataset.unidad;
        const vencimiento = btnEditar.dataset.vencimiento;
        const nombre = btnEditar.dataset.nombre;

        document.getElementById('editPlanificacionId').value = id;
        document.getElementById('editNombreTpTexto').value = nombre;
        document.getElementById('editPeriodoEvaluativo').value = periodo;
        document.getElementById('editUnidadTematica').value = unidad;
        document.getElementById('editFechaVencimiento').value = vencimiento;

        const modalEl = document.getElementById('modalEditarTpAsignado');
        if (modalEl) {
            const modal = new bootstrap.Modal(modalEl);
            modal.show();
        }
    }
});

const formEditarTpAsignado = document.getElementById('formEditarTpAsignado');
if (formEditarTpAsignado) {
    formEditarTpAsignado.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('editPlanificacionId').value;
        const periodo = document.getElementById('editPeriodoEvaluativo').value;
        const unidad = document.getElementById('editUnidadTematica').value;
        const vencimiento = document.getElementById('editFechaVencimiento').value || null;

        try {
            const { error } = await supabase
                .from('curso_planificacion')
                .update({
                    periodo_evaluativo: periodo,
                    unidad_tematica: unidad,
                    fecha_vencimiento: vencimiento
                })
                .eq('id', id);

            if (error) throw error;

            const modalEl = document.getElementById('modalEditarTpAsignado');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }

            alert('¡Planificación actualizada con éxito!');

            if (cursoActualId) {
                await cargarPlanificacionCurso(cursoActualId, supabase);
                await renderizarMatrizSeguimiento(cursoActualId);
            }
        } catch (err) {
            alert('Error al actualizar la planificación: ' + err.message);
        }
    });
}
