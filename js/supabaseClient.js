import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Configuración de conexión a Supabase
const SUPABASE_URL = 'https://bpwxxodhiswltefhqbol.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJwd3h4b2RoaXN3bHRlZmhxYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwMzc3NjQsImV4cCI6MjEwNjYxMzc2NH0.tVs4JpCyJFAcakyIHMCV49xiuzNgNr2SeG1S5iUeF48';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Normaliza nombres de alumnos según los estándares del proyecto:
 * Apellidos en MAYÚSCULAS y Nombres en Title Case.
 */
export function normalizarAlumno(apellido, nombre) {
    const apLimpio = apellido.trim().toUpperCase();
    const nomLimpio = nombre.trim().toLowerCase().replace(/(^\w|\s\w)/g, m => m.toUpperCase());
    return { apellido: apLimpio, nombre: nomLimpio };
}

/**
 * Genera un PIN aleatorio de 6 dígitos que no exista actualmente en el curso.
 */
async function generarPinUnicoCurso(cursoId) {
    let pinValido = false;
    let pin = '';

    while (!pinValido) {
        pin = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Verificamos si ya existe ese PIN en este curso
        const { data } = await supabase
            .from('alumnos')
            .select('id')
            .eq('curso_id', cursoId)
            .eq('pin', pin)
            .maybeSingle();

        if (!data) {
            pinValido = true;
        }
    }
    return pin;
}

/**
 * Guarda un lote de alumnos asociados a un curso, asignando un PIN único a cada uno.
 */
export async function guardarNominaCurso(cursoId, alumnos) {
    const filas = [];

    for (const al of alumnos) {
        const pin = await generarPinUnicoCurso(cursoId);
        filas.push({
            curso_id: cursoId,
            apellido: al.apellido,
            nombre: al.nombre,
            email_alumno: al.emailAlumno || null,
            email_tutor: al.emailTutor || null,
            pin: pin
        });
    }

    const { data, error } = await supabase
        .from('alumnos')
        .insert(filas)
        .select();

    if (error) {
        throw new Error("Error al guardar la nómina: " + error.message);
    }

    return data;
}

/**
 * Genera y actualiza un PIN único para un alumno individual.
 */
export async function generarPinAlumno(alumnoId) {
    const { data: alumno, error: errAlumno } = await supabase
        .from('alumnos')
        .select('curso_id')
        .eq('id', alumnoId)
        .single();

    if (errAlumno || !alumno) {
        throw new Error("No se encontró el alumno especificado.");
    }

    const nuevoPin = await generarPinUnicoCurso(alumno.curso_id);

    const { data, error } = await supabase
        .from('alumnos')
        .update({ pin: nuevoPin })
        .eq('id', alumnoId)
        .select()
        .single();

    if (error) throw new Error("Error al actualizar el PIN: " + error.message);
    return nuevoPin;
}
