// js/informes_tutor.js

// Plantilla que genera la vista previa del CUERPO DEL EMAIL
export function generarCuerpoEmailHTML(datosAlumno, curso, notas) {
    return `
        <div style="font-family: Arial, sans-serif; padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
            <p style="margin-bottom: 12px;">Estimado/a tutor/a de <strong>${datosAlumno.nombre} ${datosAlumno.apellido}</strong>,</p>
            <p style="margin-bottom: 12px;">Le hacemos llegar el Informe Pedagógico de Seguimiento correspondiente a la materia <strong>${curso.nombre}</strong> (${curso.institucion}).</p>
            
            <div style="background-color: #f8fafc; padding: 12px; border-left: 4px solid #0d6efd; margin: 15px 0;">
                <p style="margin: 0; font-weight: bold; color: #0f172a;">📌 Resumen Ejecutivo de Evaluación:</p>
                <ul style="margin: 8px 0 0 20px; padding: 0;">
                    <li><strong>Promedio Académico:</strong> ${notas.promedio} / 10</li>
                    <li><strong>Evaluaciones Registradas:</strong> ${notas.cantidadTPs} TPs</li>
                </ul>
            </div>

            <p style="margin-bottom: 12px;">En el documento PDF adjunto a este correo encontrará el desglose pormenorizado de los Trabajos Prácticos y observaciones pedagógicas.</p>

            <p style="margin-top: 20px; color: #64748b; font-size: 0.9rem;">Atentamente,<br><strong>Equipo Docente</strong><br>${curso.institucion}</p>
        </div>
    `;
}
