# AdminYAAA — Auditoría y mejoras (versión 3)

## 0. Esta ronda: percepción del nombre y ejemplo ilustrativo

El dueño hizo dos pedidos sobre la versión 3 ya publicada:

1. **"El nombre me hace pensar en administración de edificios."** No se tocó el nombre real (logo, tarjeta, Instagram, ficha de Maps): es una decisión de marca que le corresponde al dueño, no algo para resolver dentro de un ajuste de la web. Se aplicó, en cambio, un cambio reversible y de bajo riesgo: un texto corto ("Para tu negocio") junto al logo en el encabezado, para que el primer vistazo ya aclare de qué se trata antes de que seguir leyendo lo confirme. **Sigue abierta** la pregunta de si el dueño quiere ir más a fondo (ver Sección 4 de la estrategia).
2. **Un ejemplo concreto ("tipo Juancito del kiosco")** para que una persona se imagine como cliente. Se agregó la sección "Un ejemplo", con un mini estado de cuenta ficticio ("Juan tiene un kiosco"), rotulado como "Ejemplo ilustrativo" y aclarado en el texto ("no es un cliente real"), siguiendo el mismo criterio que ya se usó en la versión 2 para el tablero de flujo de caja (que en esa versión se había sacado por otras razones de extensión, no por el criterio de etiquetarlo).

Con esto, la página pasó de ~610 a **~720 palabras** y de ~12 a **~13,5 pantallas en celular** (medido a 375×812); sigue siendo bastante más corta que la versión 2 (1.090 palabras). Peso de la carga inicial: **~92 KB** (antes ~86 KB).

## 0b. Dominio conectado (`adminya.com.ar`)

Verificado con consultas DNS y HTTP contra el sitio real (saltando el filtro de la red local, que muestra una página de bloqueo de Fortinet para dominios nuevos):
- **DNS:** delegado a Netlify (`dns1–dns4.p08.nsone.net`); `adminya.com.ar` y `www` resuelven a la misma dirección.
- **HTTPS:** certificado válido; `http` redirige a `https` (301) y `www` redirige a `https://adminya.com.ar/` (301).
- **Versión publicada:** la **versión 3 anterior**: no tiene las dos tarjetas nuevas de servicios, la etiqueta "Para tu negocio" ni el ejemplo del kiosco. Esos cambios están en la carpeta local y hay que publicarlos en Netlify.
- **Nombre del dominio:** `adminya`, no `adminyaaa`. Conviene que el dueño decida si es el nombre definitivo (ver Sección 4 de la estrategia).
- **Aviso de red:** en redes con filtro de contenido (como la de esta computadora) el dominio puede verse **bloqueado** por unos días, hasta que el filtro lo clasifique. Desde datos móviles u otra red abre normal.

## 1. Qué se probó y qué no

**Probado de verdad**
- **Página publicada (versión 2, en GitHub Pages):** los 12 recursos responden 200, sin errores de consola, todos los enlaces (WhatsApp, correo, Instagram, "Cómo llegar") apuntan bien, carga completa en ~0,5 s.
- **Versión 3 (esta):** sin desbordes horizontales en 320, 375, 500 y 1440 px; tablet y escritorio revisados con capturas en Chrome; contrastes calculados; recursos y anclas sin roturas; datos estructurados válidos y coincidentes con las 6 preguntas visibles; los dos WhatsApp con el mismo número de apariciones (6 y 6).
- **Cambios de esta ronda:** la etiqueta "Para tu negocio" no se superpone con el botón de menú en ningún ancho probado (320 a 1360 px; se oculta a propósito debajo de 360 px, donde no entraría cómoda); la tarjeta del ejemplo se lee bien y sin cortes en 320, 375 y 1360 px.

**NO probado (hay que hacerlo antes de publicar)**
- PageSpeed/Lighthouse, iPhone y Android reales, Safari y Firefox, lector de pantalla.
- Que WhatsApp abra el chat desde un celular con la app instalada.
- Vista previa al compartir el link (necesita dominio).

## 2. Qué se le criticó a la versión 2 y qué se hizo

| Crítica | Medición | En la versión 3 |
|---|---|---|
| Demasiado larga y repetitiva | 1.090 palabras · 13 pantallas (escritorio) · ~19 (celular) | **~720 palabras · ~13,5 pantallas en celular** (incluye los servicios nuevos y el ejemplo del kiosco) |
| Demasiados botones de WhatsApp | 12 enlaces, 14 botones verdes | Un llamado único y repetido: "Contanos qué necesitás resolver" |
| Formulario con 3 botones de envío | Confundía | **Eliminado** (para un público mayor, escribir directo es más simple) |
| Botón principal cortado en celular | Quedaba bajo el pliegue | **Visible en la primera pantalla** (medido a 375 px) |
| Tablero de ejemplo inventado | Podía leerse como un entregable real | **Eliminado** |
| Lectura larga sobre fondo oscuro | Cansa más, sobre todo a los mayores | **Zonas de lectura sobre fondo claro**; el azul queda para encabezado, portada, pasos, contacto y pie |
| Letra chica | 16 px base, 12–13 px en detalles | **18 px base, mínimo 15 px** |
| Enfoque solo en el servicio | No hablaba de la necesidad del cliente | **Tarjetas en primera persona** ("Necesito ordenar mis números", "Quiero vender online") |

Peso de la carga inicial: **~92 KB** (antes ~112 KB en la versión 2).

## 3. Comparación con la versión del dueño

Se compararon solo tres capturas (portada, servicios y contacto); no se vio el resto.

| Criterio | Versión del dueño | Versión 3 |
|---|---|---|
| ¿Qué hace AdminYAAA? (5 segundos) | Poco claro ("lo que tu negocio necesita resolver, lo vemos juntos") | **Claro** (administración: facturación, pagos, cobranzas, trámites) |
| Enfoque en el cliente | **Muy bueno** | Incorporado (tarjetas en primera persona, mismo llamado repetido) |
| Diferenciación | No menciona al contador | **"Junto a tu contador"** |
| Largo | Corta | Corta (~720 palabras, con un ejemplo concreto que la versión del dueño no tiene) |
| Estética | Fondo claro, logo original | Azul de la tarjeta con zonas claras para leer |
| Servicios "vender online", "análisis de mercado" y "sistemas a medida" | "Vender online" sí | **Los tres incorporados** (confirmados por el dueño) |

**Qué se tomó del dueño:** el llamado "Contanos qué necesitás resolver", las cuatro tarjetas y sus textos, los 3 pasos y "Empezamos por escucharte".
**Qué se conserva de la versión anterior:** el H1, la tarjeta Vos/Nosotros, la diferencia de "junto a tu contador", el FAQ, los datos estructurados y el mapa.

## 4. Auditoría de la versión 3

Leyenda: ✅ bien · ⚠️ mejorable · ❌ falta (por falta de datos)

| Área | Estado | Detalle |
|---|---|---|
| **UX** | ✅ | Un solo recorrido; cada sección responde una pregunta; pocas opciones por pantalla. |
| **UI** | ✅ | Estética de la tarjeta, sin degradados ni sombras pesadas. ⚠ Sin fotos ni personas (el ejemplo del kiosco ayuda a hacerlo tangible, pero no reemplaza fotos ni casos reales). |
| **Mobile** | ✅ | Barra fija con los dos WhatsApp (se oculta cuando ya están a la vista), menú grande, botones de 60–72 px. ⚠ Falta probar en dispositivos reales. |
| **Accesibilidad** | ✅ | Letra base 18 px, contraste mínimo 5,9:1 (el resto entre 8,7:1 y 15,2:1), "saltar al contenido", foco visible de 4 px, semántica correcta, sin animaciones, enlaces externos avisan que abren pestaña nueva. ⚠ Falta prueba con lector de pantalla. |
| **SEO** | ✅ técnico / ⚠️ contenido | Título, meta (153 caracteres), H1 único, schema `ProfessionalService` + `FAQPage`, `lang="es-AR"`, Instagram en `sameAs`. ⚠ Una sola página; `noindex` activo (correcto para un borrador). |
| **Conversión** | ✅ | Un llamado único, dos WhatsApp iguales, mensaje ya armado. ⚠ No hay medición de consultas. |
| **Velocidad** | ✅ (estimada) | ~92 KB, sin librerías, mapa con carga diferida. ⚠ Falta medirla con PageSpeed. |
| **Claridad** | ✅ | Vocabulario simple, sin jerga. |
| **Credibilidad** | ❌ / ⚠️ | Dirección con mapa, dos vías directas, Instagram, honestidad sobre lo que no se sabe. Faltan personas, casos, reseñas, seguridad de datos y correo con dominio propio (hoy Gmail). |
| **Errores de contenido** | ✅ | Ninguna frase sin respaldo. Quedan **4 comentarios** `[DATO A COMPLETAR]` en el código (schema, pasos, preguntas frecuentes y horarios/ubicación). |

### Riesgos y límites
1. **Vista previa al compartir:** el dominio `adminya.com.ar` ya está y `og:image` ya apunta a una dirección absoluta en el código; **solo se verá cuando esta versión se publique en Netlify** (la publicada hoy es la anterior).
2. **El repositorio está público** (GitHub Pages lo exige en cuentas gratuitas), así que `docs/` es visible para cualquiera.
3. **Los 3 pasos y los textos de las tarjetas** vienen de la versión del dueño y de sus piezas gráficas; conviene que confirme el alcance exacto de "vender online", "análisis de mercado" y "sistemas a medida". Las frases absolutas ("cualquier proceso", "100 %") se dejaron afuera a propósito.
3b. **Marca inconsistente en las piezas gráficas:** dicen "AdminYa" y no "AdminYAAA". La web usa AdminYAAA.
4. **La ficha de Google Maps no pudo leerse:** no se conoce su puntaje ni reseñas.
5. **El logo claro** se generó recoloreando el PNG; conviene la versión vectorial oficial.
6. **Sin formulario:** ya no hay forma de "dejar los datos" en la web; todo pasa por WhatsApp, correo o Instagram.
7. **Nombre de marca:** se agregó "Para tu negocio" junto al logo para desactivar la lectura de "administración de edificios" en el primer vistazo, pero es un parche de la web, no una solución de fondo. Si el dueño sigue viendo el problema al usarla, la conversación pendiente es sobre la marca (nombre, logo, Instagram), no sobre el sitio.

## 5. Mejoras recomendadas, por prioridad

### Antes de publicar
1. Que el dueño **confirme los textos** de las 5 tarjetas y los 3 pasos.
2. **Cargar horarios** y confirmar el alcance geográfico del servicio remoto.
3. **Correo institucional** (`contacto@adminya.com.ar`, hoy es un Gmail). El dominio, el `canonical`, la `og:image` absoluta y los datos del schema ya están cargados.
4. **Probar en celulares reales** los dos WhatsApp.
5. **Completar la ficha de Google Business Profile** (web, horarios, servicios, fotos).

### Primer mes
6. **"Quiénes somos" mínimo**: nombres, una foto real y una línea de experiencia. Es lo que más falta.
7. **Fotos reales** de la oficina y del equipo.
8. **1 a 3 testimonios reales** y las **reseñas de Google**.
9. **Una respuesta sobre seguridad** de datos y accesos.
10. **Un criterio de precio** (aunque sea "depende de X, Y, Z").
11. **Medir** clics en WhatsApp con una herramienta sin cookies (Plausible o Umami).

### Más adelante
12. Páginas propias para **vender online** y para **administración de comercios**, con contenido útil real.
13. Search Console para validar keywords; publicaciones periódicas en la ficha de Google.
14. Logo vectorial (versión clara y oscura) y sesión de fotos profesional.
