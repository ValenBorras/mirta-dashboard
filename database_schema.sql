-- ============================================
-- SCHEMA ACTUALIZADO - Dashboard de Noticias
-- ============================================
-- Adaptado a la estructura JSON de noticias existente

-- ============================================
-- Tabla: USUARIO (Legisladores)
-- ============================================
CREATE TABLE usuario (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    cargo VARCHAR(100),
    provincia VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: NOTICIERO
-- ============================================
CREATE TABLE noticiero (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    url_rss TEXT,
    tipo VARCHAR(50), -- 'nacional', 'provincial', 'digital'
    fuente_base VARCHAR(255), -- Dominio base: 'www.clarin.com', 'www.lanacion.com.ar'
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: AGENTE_CAMPO
-- ============================================
CREATE TABLE agente_campo (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    telefono VARCHAR(20) UNIQUE NOT NULL, -- Whitelist de WhatsApp
    provincia VARCHAR(100),
    ciudad VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- Tabla: NOTICIA (Actualizada)
-- ============================================
CREATE TABLE noticia (
    id SERIAL PRIMARY KEY,
    
    -- Campos del JSON original
    titulo VARCHAR(500) NOT NULL,
    descripcion TEXT, -- Resumen/descripción de la noticia
    autor VARCHAR(255),
    fuente VARCHAR(255), -- Nombre de la fuente: 'Clarín', 'La Nación'
    fecha_publicacion TIMESTAMP NOT NULL,
    link TEXT, -- URL original
    cuerpo TEXT, -- Contenido completo
    fuente_base VARCHAR(255), -- Dominio: 'www.clarin.com'
    extraido_en TIMESTAMP, -- Cuando fue scrapeada
    
    -- Campos procesados por LLM
    categoria VARCHAR(100), -- 'Economía', 'Seguridad', 'Salud', 'Agricultura'
    resumen TEXT,
    urgencia VARCHAR(20) DEFAULT 'media', -- 'alta', 'media', 'baja'
    sentimiento VARCHAR(20), -- 'positivo', 'neutral', 'negativo'
    ubicacion_geografica VARCHAR(200),
    nivel_geografico VARCHAR(20), -- 'internacional', 'nacional', 'provincial', 'municipal'
    palabras_clave JSON, -- Array de keywords
    impacto_legislativo TEXT, -- Descripción del impacto potencial
    requiere_accion BOOLEAN DEFAULT false,
    procesado_llm BOOLEAN DEFAULT false,
    
    -- Clasificación de fuente
    tipo_fuente VARCHAR(20) NOT NULL, -- 'noticiero' o 'agente'
    noticiero_id INTEGER,
    agente_id INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Keys
    CONSTRAINT fk_noticiero 
        FOREIGN KEY (noticiero_id) 
        REFERENCES noticiero(id) 
        ON DELETE SET NULL,
    
    CONSTRAINT fk_agente 
        FOREIGN KEY (agente_id) 
        REFERENCES agente_campo(id) 
        ON DELETE SET NULL,
    
    -- Check: solo uno de los dos puede estar poblado
    CONSTRAINT chk_fuente 
        CHECK (
            (tipo_fuente = 'noticiero' AND noticiero_id IS NOT NULL AND agente_id IS NULL) OR
            (tipo_fuente = 'agente' AND agente_id IS NOT NULL AND noticiero_id IS NULL)
        )
);

-- ============================================
-- ÍNDICES para mejorar performance
-- ============================================

-- Índices en NOTICIA
CREATE INDEX idx_noticia_fecha_pub ON noticia(fecha_publicacion DESC);
CREATE INDEX idx_noticia_extraido ON noticia(extraido_en DESC);
CREATE INDEX idx_noticia_urgencia ON noticia(urgencia);
CREATE INDEX idx_noticia_categoria ON noticia(categoria);
CREATE INDEX idx_noticia_nivel_geo ON noticia(nivel_geografico);
CREATE INDEX idx_noticia_tipo_fuente ON noticia(tipo_fuente);
CREATE INDEX idx_noticia_procesado ON noticia(procesado_llm);
CREATE INDEX idx_noticia_noticiero ON noticia(noticiero_id);
CREATE INDEX idx_noticia_agente ON noticia(agente_id);
CREATE INDEX idx_noticia_fuente_base ON noticia(fuente_base);

-- Índice en USUARIO
CREATE INDEX idx_usuario_email ON usuario(email);
CREATE INDEX idx_usuario_activo ON usuario(activo);

-- Índice en AGENTE_CAMPO
CREATE INDEX idx_agente_telefono ON agente_campo(telefono);
CREATE INDEX idx_agente_activo ON agente_campo(activo);

-- Índice en NOTICIERO
CREATE INDEX idx_noticiero_activo ON noticiero(activo);
CREATE INDEX idx_noticiero_fuente_base ON noticiero(fuente_base);