import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Configuración de conexión a Supabase
const SUPABASE_URL = 'https://bpwxxodhiswltefhqbol.supabase.co';
const SUPABASE_ANON_KEY = 'AQUI_PEGAS_LA_CLAVE_QUE_SUBRAYASTE_EN_AMARILLO';

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
 * Guarda un lote de alumnos asociados a un curso.
 */
export async function guardarNominaCurso(cursoId, listaAlumnos) {
    const alumnosNormalizados = listaAlumnos.map(al => {
        const { apellido, nombre } = normalizarAlumno(al.apellido, al.nombre);
        return {
            curso_id: cursoId,
            apellido: apellido,
            nombre: nombre,
            pin: al.pin || null,
            email_tutor: al.email_tutor || null,
            telefono_tutor: al.telefono_tutor || null
        };
    });

    const { data, error } = await supabase
        .from('alumnos')
        .insert(alumnosNormalizados);

    if (error) throw new Error("Error al guardar la nómina: " + error.message);
    return data;
}
