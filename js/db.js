import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

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
 * Genera un PIN numérico de 4 dígitos de forma aleatoria (ej: "4829")
 */
function generarPinRandom() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Guarda un lote de alumnos asociados a un curso, asignando un PIN automático a cada uno.
 */
export async function guardarNominaCurso(cursoId, alumnos) {
    const filas = alumnos.map(al => {
        // Genera un PIN aleatorio de 6 dígitos
        const pin = Math.floor(100000 + Math.random() * 900000).toString();
        
        return {
            curso_id: cursoId,
            apellido: al.apellido,
            nombre: al.nombre,
            email_tutor: al.emailTutor || null,
            pin: pin
        };
    });

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
 * Genera y actualiza el PIN de un alumno individual en la base de datos.
 */
export async function generarPinAlumno(alumnoId) {
    const nuevoPin = generarPinRandom();
    const { data, error } = await supabase
        .from('alumnos')
        .update({ pin: nuevoPin })
        .eq('id', alumnoId)
        .select()
        .single();

    if (error) throw new Error("Error al actualizar el PIN: " + error.message);
    return nuevoPin;
}
