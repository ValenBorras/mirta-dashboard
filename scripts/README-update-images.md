# Actualización de Imágenes en Noticias

## Descripción
Este script actualiza las noticias existentes en la base de datos que no tienen imagen, extrayéndolas de sus URLs originales.

## Prerequisitos

1. **Configurar variables de entorno:**
   
   Crea un archivo `.env.local` en la raíz del proyecto con tus credenciales:
   ```bash
   cp .env.example .env.local
   ```
   
   Edita `.env.local` y agrega tus credenciales de Supabase:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_SECRET_DEFAULT_KEY=tu-service-role-key
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Aplicar la migración de base de datos:**
   
   Ve a Supabase SQL Editor y ejecuta:
   ```sql
   ALTER TABLE noticia 
   ADD COLUMN IF NOT EXISTS imagen_url TEXT;

   CREATE INDEX IF NOT EXISTS idx_noticia_imagen 
   ON noticia(imagen_url) WHERE imagen_url IS NOT NULL;

   COMMENT ON COLUMN noticia.imagen_url IS 
   'URL de la imagen principal de la noticia extraída desde JSON-LD o meta tags';
   ```

## Uso

### Actualizar las últimas 100 noticias (default)
```bash
npm run update-images
```

### Actualizar las últimas 50 noticias
```bash
npm run update-images:50
```

### Actualizar un número personalizado
```bash
npx tsx scripts/update-news-images.ts 200
```

## Cómo funciona

1. **Busca noticias sin imagen:** Obtiene las últimas N noticias que no tienen `imagen_url`
2. **Extrae imágenes:** Para cada noticia, visita la URL original y extrae la imagen de:
   - JSON-LD (campo `image`)
   - Meta tags (`og:image`, `twitter:image`)
   - Primera imagen del artículo (fallback)
3. **Actualiza la base de datos:** Guarda la URL de la imagen encontrada
4. **Respeta rate limits:** Espera 500ms entre cada petición para no saturar servidores

## Salida del Script

El script muestra:
- ✅ Imágenes actualizadas exitosamente
- ⚠️ Noticias sin imagen encontrada
- ❌ Errores durante el proceso

Al finalizar, muestra un resumen:
```
========================================================
✨ Actualización completada:
   - Total procesadas: 100
   - Actualizadas con imagen: 78
   - Sin imagen encontrada: 18
   - Errores: 4
========================================================
```

## Visualización en el Dashboard

Las imágenes se muestran automáticamente en:

1. **Lista de noticias:** Miniatura 80x80px (desktop) o 64x64px (mobile)
2. **Modal de noticia:** Imagen completa con opción de expandir a pantalla completa
3. **Click en imagen:** Abre visor en pantalla completa

## Notas

- Las imágenes que fallan al cargar se ocultan automáticamente
- El script se puede ejecutar múltiples veces de forma segura
- Solo procesa noticias que tienen un `link` válido
- Soporta sitios con JSON-LD y sitios solo con HTML (como El Once)
