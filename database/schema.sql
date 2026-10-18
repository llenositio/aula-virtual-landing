-- 1. TABLA PROFESORES
CREATE TABLE IF NOT EXISTS public.profesores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    institucion_default VARCHAR(150),
    estado_suscripcion VARCHAR(20) DEFAULT 'activa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA CURSOS
CREATE TABLE IF NOT EXISTS public.cursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profesor_id UUID REFERENCES public.profesores(id) ON DELETE SET NULL,
    institucion VARCHAR(150),
    modalidad VARCHAR(50),
    anio_division VARCHAR(20) NOT NULL,
    usar_pin BOOLEAN DEFAULT FALSE,
    notificar_padres BOOLEAN DEFAULT FALSE,
    codigo_ref VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA ALUMNOS
CREATE TABLE IF NOT EXISTS public.alumnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
    apellido VARCHAR(100) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    pin VARCHAR(10) DEFAULT NULL,
    email_alumno VARCHAR(150) DEFAULT NULL,
    email_tutor VARCHAR(150) DEFAULT NULL,
    telefono_tutor VARCHAR(30) DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLA EVALUACIONES RESULTADOS
CREATE TABLE IF NOT EXISTS public.evaluaciones_resultados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
    tp_codigo VARCHAR(50) NOT NULL,
    nota DECIMAL(4,2) NOT NULL,
    nivel_bloom VARCHAR(50),
    tiempo_segundos INT DEFAULT 0,
    foco_perdido INT DEFAULT 0,
    detalle_respuestas JSONB DEFAULT NULL,
    notificado_tutor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLA BANCO PREGUNTAS
CREATE TABLE IF NOT EXISTS public.banco_preguntas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cod_tp VARCHAR(50) NOT NULL,
    materia VARCHAR(100),
    consigna TEXT NOT NULL,
    opciones JSONB,
    respuesta_correcta TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. TABLA CURSO EVALUACIONES
CREATE TABLE IF NOT EXISTS public.curso_evaluaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
    cod_tp VARCHAR(50) NOT NULL,
    estado VARCHAR(20) DEFAULT 'activo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEGURIDAD (RLS) + POLÍTICAS DE PERMISO HABILITADAS
ALTER TABLE public.profesores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluaciones_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banco_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curso_evaluaciones ENABLE ROW LEVEL SECURITY;

-- Limpieza e inserción de políticas funcionales
DROP POLICY IF EXISTS "Permiso_profesores" ON public.profesores;
DROP POLICY IF EXISTS "Permiso_cursos" ON public.cursos;
DROP POLICY IF EXISTS "Permiso_alumnos" ON public.alumnos;
DROP POLICY IF EXISTS "Permiso_evaluaciones_resultados" ON public.evaluaciones_resultados;
DROP POLICY IF EXISTS "Permiso_banco_preguntas" ON public.banco_preguntas;
DROP POLICY IF EXISTS "Permiso_curso_evaluaciones" ON public.curso_evaluaciones;

CREATE POLICY "Permiso_profesores" ON public.profesores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso_cursos" ON public.cursos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso_alumnos" ON public.alumnos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso_evaluaciones_resultados" ON public.evaluaciones_resultados FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso_banco_preguntas" ON public.banco_preguntas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permiso_curso_evaluaciones" ON public.curso_evaluaciones FOR ALL USING (true) WITH CHECK (true);
