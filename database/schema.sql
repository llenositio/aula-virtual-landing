-- 1. TABLA PROFESORES
CREATE TABLE public.profesores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    institucion_default VARCHAR(150),
    estado_suscripcion VARCHAR(20) DEFAULT 'activa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA CURSOS
CREATE TABLE public.cursos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profesor_id UUID REFERENCES public.profesores(id) ON DELETE CASCADE,
    institucion VARCHAR(150) NOT NULL,
    modalidad VARCHAR(50) NOT NULL,
    anio_division VARCHAR(20) NOT NULL,
    usar_pin BOOLEAN DEFAULT FALSE,
    notificar_padres BOOLEAN DEFAULT FALSE,
    codigo_ref VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABLA ALUMNOS
CREATE TABLE public.alumnos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
    apellido VARCHAR(100) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    pin VARCHAR(10) DEFAULT NULL,
    email_tutor VARCHAR(150) DEFAULT NULL,
    telefono_tutor VARCHAR(30) DEFAULT NULL
);

-- 4. TABLA EVALUACIONES RESULTADOS
CREATE TABLE public.evaluaciones_resultados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alumno_id UUID REFERENCES public.alumnos(id) ON DELETE CASCADE,
    curso_id UUID REFERENCES public.cursos(id) ON DELETE CASCADE,
    tp_codigo VARCHAR(50) NOT NULL,
    nota DECIMAL(4,2) NOT NULL,
    nivel_bloom VARCHAR(50) NOT NULL,
    tiempo_segundos INT NOT NULL,
    foco_perdido INT DEFAULT 0,
    detalle_respuestas JSONB DEFAULT NULL,
    notificado_tutor BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SEGURIDAD (RLS)
ALTER TABLE public.cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluaciones_resultados ENABLE ROW LEVEL SECURITY;
