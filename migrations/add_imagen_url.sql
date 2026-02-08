-- Migration: Agregar columna imagen_url a la tabla noticia
-- Fecha: 2026-02-08

-- Agregar columna para URL de imagen de la noticia
ALTER TABLE noticia 
ADD COLUMN IF NOT EXISTS imagen_url TEXT;

-- Crear índice para búsquedas por imagen (opcional, útil para filtrar noticias con/sin imagen)
CREATE INDEX IF NOT EXISTS idx_noticia_imagen ON noticia(imagen_url) WHERE imagen_url IS NOT NULL;

-- Comentario sobre el campo
COMMENT ON COLUMN noticia.imagen_url IS 'URL de la imagen principal de la noticia extraída desde JSON-LD o meta tags';
