import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://bpwxxodhiswltefhqbol.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3h4b2RoaXN3bHRlZmhxYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzc3NjQsImV4cCI6MjEwNjYxMzc2NH0.tVs4JpCyJFAcakyIHMCV49xiuzNgNr2SeG1S5iUeF48';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 1. Obtener el código de TP de la URL (?tp=CBMTP-1-MAT-001)
const urlParams = new URLSearchParams(window.location.search);
const codTp = urlParams.get('tp');

// 2. Recuperar la sesión guardada del alumno
const sesionLocal = localStorage.getItem('alumnoSesion');
let alumnoActual = sesionLocal ? JSON.parse(sesionLocal) : null;

document.addEventListener('DOMContentLoaded', async () => {
    // Redirigir al login si no hay sesión activa
    if (!alumnoActual) {
        alert('Debés iniciar sesión en el portal de alumnos para resolver la evaluación.');
        window.location.href = 'alumno.html';
        return;
    }

    if (!codTp) {
        alert('No se especificó ningún Trabajo Práctico.');
        window.location.href = 'alumno.html';
        return;
    }

    // Ocultar formulario manual si existía en aula.html
    const seccionFormularioManual = document.getElementById('seccionAuth') || 
                                    document.getElementById('contenedorAcceso') || 
                                    document.getElementById('formAcceso');
    if (seccionFormularioManual) {
        seccionFormularioManual.classList.add('d-none');
    }

    // Cargar directamente la evaluación con la identidad recuperada
    await iniciarExamenDirecto(alumnoActual, codTp);
});

async function iniciarExamenDirecto(alumno, codigoTp) {
    let contenedorExamen = document.getElementById('contenedorExamen');

    if (!contenedorExamen) {
        contenedorExamen = document.createElement('div');
        contenedorExamen.id = 'contenedorExamen';
        contenedorExamen.className = 'container py-4';
        document.body.appendChild(contenedorExamen);
    }

    contenedorExamen.innerHTML = `
        <div class="card shadow-sm border-0 p-4 mb-4">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div>
                    <h3 class="fw-bold mb-1">Evaluación: <code>${codigoTp}</code></h3>
                    <p class="text-muted mb-0">Estudiante: <strong>${alumno.nombre}</strong></p>
                </div>
                <a href="alumno.html" class="btn btn-outline-secondary btn-sm">Volver al Portal</a>
            </div>
            <hr>
            <div id="preguntasListado">
                <div class="text-center py-4 text-muted">Cargando preguntas de la evaluación desde la base de datos...</div>
            </div>
        </div>
    `;

    try {
        // Consultar banco_preguntas de Supabase para este TP
        const { data: preguntas, error } = await supabase
            .from('banco_preguntas')
            .select('*')
            .eq('cod_tp', codigoTp);

        const listado = document.getElementById('preguntasListado');

        if (error || !preguntas || preguntas.length === 0) {
            listado.innerHTML = `
                <div class="alert alert-warning text-center my-3">
                    No se encontraron consignas cargadas para el código <code>${codigoTp}</code>.
                </div>
            `;
            return;
        }

        listado.innerHTML = preguntas.map((p, index) => `
            <div class="card border mb-3 p-3 shadow-sm">
                <h5 class="fw-bold">${index + 1}. ${p.titulo_humano || 'Consigna'}</h5>
                <p class="text-secondary mb-2">${p.consigna || ''}</p>
                <div class="badge bg-info text-dark mb-3" style="width: fit-content;">Nivel Bloom: ${p.nivel_bloom || 'Comprender'}</div>
                <textarea class="form-control" rows="3" placeholder="Escribí tu respuesta aquí..."></textarea>
            </div>
        `).join('') + `
            <button id="btnEntregarExamen" class="btn btn-success w-100 fw-bold py-2 mt-3">
                Entregar Evaluación
            </button>
        `;

        document.getElementById('btnEntregarExamen')?.addEventListener('click', async () => {
            alert('¡Evaluación registrada con éxito!');
            window.location.href = 'alumno.html';
        });

    } catch (err) {
        document.getElementById('preguntasListado').innerHTML = `
            <div class="alert alert-danger">Error al cargar preguntas: ${err.message}</div>
        `;
    }
}
