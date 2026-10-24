// js/informes_tutor.js

// Función auxiliar para extraer el número del código del TP y ordenar de forma secuencial
function extraerNumeroCodigo(cod) {
    if (!cod) return 0;
    const match = String(cod).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
}

export function inicializarEventosInformeTutor(actualizarVistaPreviaFn) {
    const btnActualizar = document.getElementById('btnActualizarVistaPrevia');
    if (btnActualizar) {
        btnActualizar.addEventListener('click', () => actualizarVistaPreviaFn());
    }

    const btnDescargar = document.getElementById('btnDescargarPDF');
    if (btnDescargar) {
        btnDescargar.addEventListener('click', () => {
            window.print();
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

export async function abrirModalInformeTutor(alumnoInformeActual, cursoActualId, supabase, actualizarVistaPreviaFn) {
    if (!alumnoInformeActual || !cursoActualId) return;

    const modalEl = document.getElementById('modalInformeTutor');
    if (!modalEl) return;

    const elemEmailDestino = document.getElementById('textoEmailTutorDestino');
    if (elemEmailDestino) {
        elemEmailDestino.textContent = alumnoInformeActual.emailTutor || 'Sin email registrado';
    }

    const elemReporteId = document.getElementById('reporteAlumnoId');
    if (elemReporteId) {
        elemReporteId.value = alumnoInformeActual.id;
    }

    const { data: tps } = await supabase
        .from('curso_planificacion')
        .select('id, cod_tp, cod_tp_completo, alias_tp')
        .eq('curso_id', cursoActualId)
        .eq('activo', true);

    const selectDesde = document.getElementById('informeTpDesde');
    const selectHasta = document.getElementById('informeTpHasta');

    if (tps && tps.length > 0) {
        // Ordenar numéricamente por código de TP (001, 002, 003...)
        tps.sort((a, b) => {
            const codA = a.cod_tp_completo || a.cod_tp || '';
            const codB = b.cod_tp_completo || b.cod_tp || '';
            return extraerNumeroCodigo(codA) - extraerNumeroCodigo(codB);
        });

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

    await actualizarVistaPreviaFn();

    const modal = new bootstrap.Modal(modalEl);
    modal.show();
}

export async function actualizarVistaPreviaInforme(alumnoInformeActual, cursoActualId, cursoActualInfo, supabase) {
    if (!alumnoInformeActual || !cursoActualId) return;

    const contenedorPrevia = document.getElementById('hojaPrevisualizacionPDF');
    const contenedorEmail = document.getElementById('vistaPreviaEmailContainer');

    if (contenedorPrevia) {
        contenedorPrevia.innerHTML = '<div class="text-center py-5 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Generando vista previa...</div>';
    }

    try {
        const incluirFoco = document.getElementById('checkIncluirFoco')?.checked ?? true;
        const incluirSaberes = document.getElementById('checkIncluirSaberes')?.checked ?? true;
        const observacionDocente = document.getElementById('observacionDocenteInforme')?.value.trim() || '';

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

        const { data: resultados } = await supabase
            .from('evaluaciones_resultados')
            .select('*')
            .eq('curso_id', cursoActualId)
            .eq('alumno_id', alumnoInformeActual.id)
            .order('created_at', { ascending: false });

        const ultimasEntregas = {};
        if (resultados) {
            resultados.forEach(r => {
                const cod = r.tp_codigo || r.cod_tp;
                if (!ultimasEntregas[cod]) {
                    ultimasEntregas[cod] = r;
                }
            });
        }

        let listaTpsHtml = '';
        let sumaNotas = 0;
        let cantNotas = 0;
        let totalFugas = 0;

        const entregasUnicas = Object.values(ultimasEntregas);

        if (entregasUnicas.length > 0) {
            // Ordenar secuencialmente por número de TP
            entregasUnicas.sort((a, b) => {
                const codA = a.tp_codigo || a.cod_tp || '';
                const codB = b.tp_codigo || b.cod_tp || '';
                return extraerNumeroCodigo(codA) - extraerNumeroCodigo(codB);
            });

            entregasUnicas.forEach(r => {
                const cod = r.tp_codigo || r.cod_tp;
                const nombreFantasia = mapaAlias[cod] || cod;
                const nota = parseFloat(r.nota || 0);
                sumaNotas += nota;
                cantNotas++;
                totalFugas += (r.foco_perdido || 0);

                const fechaFormateada = new Date(r.created_at).toLocaleDateString();

                listaTpsHtml += `
                    <li style="display: flex; justify-content: space-between; border-bottom: 1px dashed #e2e8f0; padding: 6px 0;">
                        <span>• <strong>${nombreFantasia}</strong> <small style="color: #64748b;">(${fechaFormateada})</small></span>
                        <span><strong>Nota: ${nota}/10</strong></span>
                    </li>`;
            });
        } else {
            listaTpsHtml = `<li style="color: #64748b; padding: 8px 0; font-size: 0.8rem;">Aún no se registran calificaciones en el período seleccionado.</li>`;
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

        // Render A4
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
                    <div style="font-weight: bold; font-size: 0.85rem; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
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

        if (contenedorPrevia) contenedorPrevia.innerHTML = htmlDocumento;

        // Render Email
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
        console.error('Error al generar vista previa:', err);
        if (contenedorPrevia) {
            contenedorPrevia.innerHTML = `<div class="alert alert-danger p-3 small">Error al generar la vista previa: ${err.message}</div>`;
        }
    }
}
