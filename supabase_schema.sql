-- =====================================================
-- ONE+ GYM — SCHEMA SUPABASE (PostgreSQL)
-- Ejecutar este script en el SQL Editor de tu proyecto Supabase
-- =====================================================

-- 1. TABLA: SOCIOS
CREATE TABLE IF NOT EXISTS socios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    dni VARCHAR(20) NOT NULL UNIQUE,
    telefono VARCHAR(50),
    plan VARCHAR(100) NOT NULL,
    cuota INTEGER NOT NULL DEFAULT 0,
    estado VARCHAR(30) NOT NULL DEFAULT 'Al día',
    vencimiento VARCHAR(10) NOT NULL,          -- Formato DD/MM/YYYY
    clases_semanales VARCHAR(20) DEFAULT 'Ilimitadas',
    clases_restantes VARCHAR(20) DEFAULT 'Ilimitadas',
    asistencias_totales INTEGER DEFAULT 0,
    asistencias_semana INTEGER DEFAULT 0,
    ultima_asistencia VARCHAR(25)               -- Formato DD/MM/YYYY HH:MM
);

CREATE INDEX IF NOT EXISTS idx_socios_dni ON socios(dni);
CREATE INDEX IF NOT EXISTS idx_socios_estado ON socios(estado);

-- 2. TABLA: STOCK (Tienda y Suplementos)
CREATE TABLE IF NOT EXISTS stock (
    id SERIAL PRIMARY KEY,
    producto VARCHAR(150) NOT NULL,
    categoria VARCHAR(80) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    precio INTEGER NOT NULL DEFAULT 0,
    minimo INTEGER NOT NULL DEFAULT 5
);

-- 3. TABLA: MAQUINAS (Equipamiento y Mantenimiento)
CREATE TABLE IF NOT EXISTS maquinas (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    zona VARCHAR(80) NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'Operativa',
    revision VARCHAR(10) NOT NULL             -- Formato DD/MM/YYYY
);

-- 4. TABLA: FINANZAS MOVIMIENTOS
CREATE TABLE IF NOT EXISTS finanzas_movimientos (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(20) NOT NULL,                 -- 'Ingreso' o 'Egreso'
    concepto VARCHAR(200) NOT NULL,
    monto NUMERIC(12, 2) NOT NULL DEFAULT 0,
    fecha VARCHAR(10) NOT NULL                 -- Formato DD/MM/YYYY
);

-- 5. TABLA: CHECKINS LOG (Historial de Asistencias)
CREATE TABLE IF NOT EXISTS checkins_log (
    id SERIAL PRIMARY KEY,
    socio_id INTEGER REFERENCES socios(id) ON DELETE SET NULL,
    nombre VARCHAR(150) NOT NULL,
    dni VARCHAR(20) NOT NULL,
    dia VARCHAR(20) NOT NULL,                  -- 'lunes', 'martes', etc.
    hora_bucket VARCHAR(10) NOT NULL,          -- '18:00', '19:00', etc.
    hora_exacta VARCHAR(10) NOT NULL,          -- '18:32', etc.
    fecha VARCHAR(10) NOT NULL,                -- Formato DD/MM/YYYY
    fecha_completa VARCHAR(25) NOT NULL,       -- Formato DD/MM/YYYY HH:MM
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checkins_fecha ON checkins_log(fecha);
CREATE INDEX IF NOT EXISTS idx_checkins_socio ON checkins_log(socio_id);

-- 6. TABLA: FLUJO DE ASISTENCIA (Buckets horarios por día)
CREATE TABLE IF NOT EXISTS flujo_asistencia (
    dia VARCHAR(20) PRIMARY KEY,               -- 'promedio', 'lunes', 'martes', etc.
    datos JSONB NOT NULL DEFAULT '{}'::jsonb   -- {"08:00": 5, "09:00": 8, ...}
);

-- 7. TABLA: MENSAJES (Muro de opiniones y comunidad)
CREATE TABLE IF NOT EXISTS mensajes (
    id VARCHAR(50) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    texto TEXT NOT NULL,
    fecha VARCHAR(25) NOT NULL,                -- Formato DD/MM/YYYY HH:MM
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- POLÍTICAS DE ACCESO (Row Level Security - RLS)
-- Permitir lectura y escritura con la clave anónima de Supabase
ALTER TABLE socios ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE finanzas_movimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE flujo_asistencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso público lectura socios" ON socios FOR SELECT USING (true);
CREATE POLICY "Acceso público modificación socios" ON socios FOR ALL USING (true);

CREATE POLICY "Acceso público lectura stock" ON stock FOR SELECT USING (true);
CREATE POLICY "Acceso público modificación stock" ON stock FOR ALL USING (true);

CREATE POLICY "Acceso público lectura maquinas" ON maquinas FOR SELECT USING (true);
CREATE POLICY "Acceso público modificación maquinas" ON maquinas FOR ALL USING (true);

CREATE POLICY "Acceso público lectura finanzas" ON finanzas_movimientos FOR SELECT USING (true);
CREATE POLICY "Acceso público modificación finanzas" ON finanzas_movimientos FOR ALL USING (true);

CREATE POLICY "Acceso público lectura checkins" ON checkins_log FOR SELECT USING (true);
CREATE POLICY "Acceso público insercion checkins" ON checkins_log FOR ALL USING (true);

CREATE POLICY "Acceso público lectura flujo" ON flujo_asistencia FOR SELECT USING (true);
CREATE POLICY "Acceso público modificación flujo" ON flujo_asistencia FOR ALL USING (true);

CREATE POLICY "Acceso público lectura mensajes" ON mensajes FOR SELECT USING (true);
CREATE POLICY "Acceso público modificación mensajes" ON mensajes FOR ALL USING (true);

-- PERMISOS DE ESQUEMA Y TABLAS
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

