-- ============================================
-- FIX: Eliminar noticieros duplicados
-- ============================================
-- Problema: la función getOrCreateNoticiero tenía una race condition
-- que creaba un noticiero nuevo por cada noticia procesada en paralelo.
-- Además, 'www.lapoliticaonline.com.ar' y 'www.lapoliticaonline.com'
-- se trataban como fuentes distintas.

BEGIN;

-- 1. Normalizar fuente_base: unificar .com.ar → .com
UPDATE noticiero
SET fuente_base = 'www.lapoliticaonline.com'
WHERE fuente_base = 'www.lapoliticaonline.com.ar';

UPDATE noticia
SET fuente_base = 'www.lapoliticaonline.com'
WHERE fuente_base = 'www.lapoliticaonline.com.ar';

-- 2. Para cada fuente_base, quedarnos con el noticiero de menor ID (el original)
--    y reasignar todas las noticias a ese ID.
UPDATE noticia n
SET noticiero_id = keeper.min_id
FROM (
    SELECT fuente_base, MIN(id) AS min_id
    FROM noticiero
    GROUP BY fuente_base
) keeper
JOIN noticiero nt ON nt.fuente_base = keeper.fuente_base
WHERE n.noticiero_id = nt.id
  AND nt.id != keeper.min_id;

-- 3. Eliminar los noticieros duplicados (todos excepto el de menor ID por fuente_base)
DELETE FROM noticiero
WHERE id NOT IN (
    SELECT MIN(id)
    FROM noticiero
    GROUP BY fuente_base
);

-- 4. Agregar constraint UNIQUE para prevenir duplicados futuros
ALTER TABLE noticiero
ADD CONSTRAINT uq_noticiero_fuente_base UNIQUE (fuente_base);

COMMIT;
