# AdminYAAA — sitio web

Página de una sola pantalla larga (landing) con la estética de la tarjeta de la marca (azul marino y verde brillante), en HTML + CSS + JavaScript simples. **No necesita instalar nada ni compilar.**

**Estado: borrador para revisión.** Tiene `noindex, nofollow`, así que Google no la indexa todavía.

## Cómo verla
Abrí `index.html` con doble clic. La carpeta `assets/` tiene que quedar junto al archivo.

## Qué hay en cada carpeta
```
index.html              ← TODO el contenido (textos, datos de contacto, FAQ, SEO)
assets/css/styles.css   ← diseño. Los colores están en las variables de arriba (:root)
assets/js/main.js       ← menú y barra fija de WhatsApp
assets/img/             ← logo (versión clara para fondo oscuro), íconos y la imagen para compartir el link
assets/fonts/           ← tipografía Poppins (alojada acá, no se pide a Google)
docs/                   ← estrategia y auditoría
```

## Cómo editar
- **Textos:** buscá el texto en `index.html` y cambialo. Cada sección tiene un comentario con su nombre.
- **Teléfonos y correo:** están repetidos en varios lugares. Buscá `5491125604901` / `11 2560-4901` (y el otro número) y reemplazá **todas** las apariciones.
- **Colores:** `assets/css/styles.css`, bloque `:root` al principio.
- **Preguntas frecuentes:** si cambiás una respuesta, cambiala también en el bloque `FAQPage` del `<head>` (tiene que ser idéntica).
- **Servicios ("¿Qué necesitás resolver?"):** cada tarjeta es un bloque `<article class="need">` en `index.html`.
- **Datos pendientes:** están marcados como `[DATO A COMPLETAR]`. Para verlos todos:
  ```bash
  grep -n "DATO A COMPLETAR" index.html
  ```

## Antes de publicar (lista de control)
1. [ ] **Validar el contenido** con el negocio: los 3 pasos de "Cómo trabajamos" y el detalle de cada servicio.
2. [ ] **Cargar los horarios** (hoy dice "consultanos por WhatsApp"). Actualizar el texto "Consultanos por WhatsApp para conocer los horarios" (sección Contacto), sumar la pregunta de horarios al FAQ (y a su versión en el `<head>`) y agregar `openingHours` al schema.
3. [x] **Dominio definido: `https://adminya.com.ar/`** (el `www` redirige a esa dirección). Ya están cargados en `index.html` el `canonical`, `og:url`, `og:image` absoluta y `url`/`logo`/`image` del schema. *Pendiente solo si cambia el dominio: buscar `adminya.com.ar` en `index.html` y reemplazar.*
4. [ ] **Borrar la línea `<meta name="robots" content="noindex, nofollow">`** (la última acción, cuando todo esté listo).
5. [x] **Hosting: Netlify** (con el dominio conectado por Netlify DNS). Para publicar cambios, hay que actualizar el sitio en Netlify (ver *Cómo actualizar la web publicada*, abajo).
6. [ ] Agregar `robots.txt` y `sitemap.xml` (una sola URL).
7. [ ] **Google Business Profile:** agregar la dirección web a la ficha y completar horarios, servicios, descripción y fotos.
8. [ ] Probar en **al menos un iPhone y un Android reales**: que los dos botones de WhatsApp abran el chat con el mensaje.
9. [ ] Pasar la URL por PageSpeed Insights y por la prueba de resultados enriquecidos de Google.

## Cómo actualizar la web publicada
La web de `adminya.com.ar` está alojada en **Netlify**. Los archivos de esta carpeta **no se publican solos**:
- Si el sitio de Netlify está **conectado al repositorio de GitHub**: al subir archivos a GitHub (rama `main`), Netlify publica solo en un minuto o dos.
- Si **no** está conectado: en Netlify, entrar al sitio → **Deploys** → arrastrar la carpeta `Adminyaaa` entera a la zona que dice *"Drag and drop your site output folder here"*.

Para saber cuál es el caso: en Netlify, **Site configuration → Build & deploy → Continuous deployment**. Si dice *"Linked repository"* con el repositorio de GitHub, es automático.

## Desarrollo
`.claude/launch.json` es solo una configuración para previsualizar desde Claude Code (`python3 -m http.server`). No hace falta para publicar.
