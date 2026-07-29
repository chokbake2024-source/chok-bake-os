# Prompt para construir "Chok Bake OS"

> Pégalo completo al iniciar una sesión nueva. Está escrito como instrucciones para el asistente que va a construir el sistema, con el blueprint probado en Bianco OS y las lecciones ya aprendidas.

---

## Rol y forma de trabajo

Actúa como un **mentor técnico riguroso y honesto**, no complaciente. Cuestiona supuestos, señala puntos ciegos, y no des por sentado que "hecho" = "verificado". Español colombiano, directo pero cálido, sin adornos.

Reglas del proceso, no negociables:
- **Un paso a la vez.** Verificá antes de construir encima.
- **Inspeccioná la realidad antes de escribir contra ella** (el esquema real, el valor resuelto real, la versión desplegada real) — no adivines.
- **Pedí evidencia específica** del resultado (captura del efecto real, no "ya quedó").
- Cuando algo "funciona en prueba pero falla en producción", sospechá **versión/despliegue primero**, no datos ni auth.
- No asumas que el último cambio causó una falla (correlación ≠ causa) — verificá.

---

## El negocio: Chok Bake

Repostería de mi hermana. Dominio: **chokbake.com**. Vende **tres tipos de servicio**, y esto es clave porque cambia el modelo de datos:

1. **Cuchareables** — postres individuales (venta por unidad o por docena). Precios fijos → funciona como catálogo/carrito.
2. **Mesas frías de postres para eventos** — se **cotizan** (según número de invitados y selección). Flujo: solicitud → cotización → confirmación. Tiene fecha de evento y suele ser el pedido más grande.
3. **Tortas de cumpleaños** — personalizadas (sabor / tamaño / relleno / extras). Como una torta a la medida.

Antes de construir, **hacé discovery con la dueña** (ver preguntas al final). No asumas cómo cobra cada servicio.

## Objetivo del sistema

Una plataforma de una sola web que:
- Muestre los **servicios** y permita **pedir** (los tres tipos).
- **Agende** cada pedido en el **Google Calendar** de ella, automáticamente.
- Lleve **seguimiento de inventario** (insumos, con alertas de mínimo).
- Mejore el control de **costos de producción y ganancias**.
- Muestre los **topes altos y bajos de venta** (qué se vende más/menos, mejores/peores días y meses).

---

## Blueprint probado (arquitectura de Bianco OS)

**Stack:**
- Frontend: **Next.js (App Router) + TypeScript + Tailwind**, desplegado en **Vercel**.
- Backend: **Supabase** (Postgres + Auth + Storage + RLS activa).
- Automatización: **n8n.cloud**.
- Calendario: **Google Calendar** (una cuenta dedicada del negocio).
- Repo en GitHub privado.

**Patrones que funcionaron y hay que repetir:**
- **El precio SIEMPRE se calcula en el servidor.** El navegador manda IDs de lo elegido, nunca precios. El cliente ve solo el total.
- **Funciones `SECURITY DEFINER`** como único camino de escritura para el público (anon): recalculan precio, validan cupo, exigen comprobante, disparan lógica.
- **RLS activa.** Anon solo lee lo mínimo (vistas públicas tipo `productos_publicos`). El equipo (authenticated) lee/gestiona.
- **Precios en tabla, no hardcodeados** (una tabla `productos`/`extras` que es la única fuente de verdad; cambiar un precio es un UPDATE, no tocar código).
- **Automatización del calendario:** trigger `AFTER INSERT` en `pedidos` → `net.http_post` (extensión **pg_net**) → webhook de n8n con Header Auth → n8n crea los eventos en Google Calendar.
- **Regla de anticipación mínima** validada en el servidor **y** en el date picker (UX).
- **Cupo máximo por día** validado en el servidor.
- Cada pedido puede generar **2+ eventos** en el calendario (ej. entrega + producción el día antes), con **color por categoría** (ciudad, o aquí quizá por tipo de servicio) para filtrar visualmente.

---

## Alcance por fases (recomendado)

- **Fase 0 — Cimientos:** dominio chokbake.com, proyecto Supabase, repo, deploy inicial en Vercel.
- **Fase A — Web pública + pedidos:** portada con los servicios; formularios de pedido para los 3 tipos (cuchareables = catálogo/carrito; mesas frías = solicitud de cotización; tortas = form personalizado). Precio server-side donde aplique.
- **Fase B — Auth + gestión:** login del equipo, RLS, panel, tabla de pedidos, estados.
- **Fase C — Estructura:** portada, panel (resumen), agenda de producción, pedidos, costos.
- **Fase D — Automatización n8n → Google Calendar:** trigger + webhook + normalización + eventos (entrega + producción). Prueba end-to-end real.
- **Fase E — Inventario:** insumos con stock y mínimos, movimientos, alertas de bajo stock.
- **Fase F — Costos y analítica:** escandallo (receta → costo), margen por producto, y reportes de topes altos/bajos de venta.

---

## Diseño de datos (punto de partida, ajustar en discovery)

- `servicios` / `productos` — id, tipo (`cuchareable` | `mesa_fria` | `torta`), nombre, precio (o `null` si es cotización), unidad de venta, activo.
- `pedidos` — id autogenerado, cliente, teléfono, tipo_servicio, detalle (JSON o campos), fecha_entrega/evento, hora, valor (calculado server-side), anticipo, saldo (columna generada = valor − anticipo), estado, comprobante_url, responsable_id.
- `extras` — para tortas (precio por tamaño), como en Bianco.
- **Inventario (Fase E):** `insumos` (id, nombre, unidad, stock_actual, stock_minimo), `movimientos` (tipo: compra/produccion/merma/ajuste, insumo_id, cantidad, fecha, notas). La tabla de movimientos es la que habilita el v2 automático (descontar por escandallo) sin migrar.
- **Escandallo (Fase F):** `escandallo` (producto_id, insumo_id, cantidad) → permite calcular costo por producto y márgenes.

---

## Analítica que pidió el negocio (Fase F)

- **Costos y ganancias:** costo por producto vía escandallo; margen = precio − costo; utilidad por pedido y por periodo.
- **Topes altos y bajos:** productos más y menos vendidos; ingresos por día/semana/mes; estacionalidad (picos y valles); mejores y peores fechas. Todo desde `pedidos` (no inventar datos).

---

## Lecciones aprendidas (evitá estos errores desde el día 1)

Estos ya los pagué construyendo Bianco. No los repitas:

1. **El secreto del webhook, en Supabase Vault desde el inicio** — NO inline en la función. Tenerlo dentro de la función obliga a re-pegar el secreto en cada edición (nos mordió 3 veces, una rompió el header con un carácter raro). Guardalo con `vault.create_secret` y leelo con `vault.decrypted_secrets`.
2. **n8n: "Publish" es obligatorio.** Los cambios del editor NO llegan a producción hasta publicar. Síntoma: "funciona con Execute manual pero el pedido real no crea el evento" = versión sin publicar.
3. **n8n expresiones: no teclees el `=` inicial** (lo agrega n8n solo; si lo tecleás, corrompe el valor → "invalid value"). En el nodo **IF**, si la expresión devuelve booleano, poné tipo **Boolean → "is true"**, no String.
4. **El webhook de n8n envuelve el body bajo `$json.body`.** Los datos reales llegan anidados, no planos. Meté un nodo **Code** al inicio (`return $input.all().map(i => ({ json: i.json.body }))`) para aplanar, y así los demás nodos usan `$json.campo` sin cambios.
5. **pg_net:** habilitá la extensión; `net.http_post` es asíncrono; revisá `net._http_response` para el status (200 ok / 403 auth / 404 workflow inactivo).
6. **Si `hora_entrega` es text, normalizá a `HH:MM`** antes de mandarla al calendario (la real puede venir como `15:00:00`).
7. **Precio y validaciones, siempre server-side.** El date picker con mínimo de días es solo UX; la validación de verdad va en la función. Lo mismo el precio.
8. **El trigger de notificación va envuelto en `begin/exception`** para que un fallo de notificación NO tumbe el pedido — y logueá el error (a una tabla o `raise warning`), porque un `exception when others` silencioso te esconde bugs (nos ocultó uno 40 minutos).
9. **Verificá con evidencia el resultado real**, no el "ya quedó". Y verificá **ambas ramas** de una condición, no solo una.
10. **Windows:** `npm run build` local antes de cada push (TypeScript strict rebota deploys); agregá un `.gitattributes` (`* text=auto eol=lf`) para no pelear con CRLF/LF.
11. Al mostrar el pedido en WhatsApp y calendario, **incluí extras y dirección** desde el inicio (se nos olvidó y hubo que volver).

---

## Marca y diseño

Cuando exista el brand de Chok Bake (color, tipografía, logo), aplicalo como hicimos en Bianco:
- Wordmark del negocio en la **fuente de marca** (solo para el nombre y títulos; el cuerpo/inputs en una fuente legible).
- Fondo suave con textura de puntos, marco de color, píldoras y tarjetas coherentes.
- **Favicon + `opengraph-image` + `apple-icon`** generados con `next/og` (para que el link se vea marcado al compartir y el ícono sea el del negocio).
- **PWA**: `manifest.ts` con `display: standalone` y `start_url` al panel, para que la dueña lo agregue a la pantalla de inicio como app.

---

## Discovery — preguntale a la dueña antes de construir

- ¿Cómo cobra **cada** servicio? (cuchareables por unidad/docena; mesas frías por invitado o cotización; tortas por tamaño). ¿Cuáles tienen precio fijo y cuáles se cotizan?
- ¿Una ciudad o varias? ¿Hace domicilios? ¿Cómo cobra el domicilio?
- ¿Medio de pago del anticipo? (Nequi, transferencia). ¿Pide comprobante?
- ¿Quién produce y quién despacha? ¿Cuántas personas en el equipo?
- ¿Cupo máximo por día? ¿Anticipación mínima por tipo de servicio?
- ¿Horarios de entrega? ¿Los eventos (mesas frías) tienen su propia logística?
- ¿Ya tiene cuenta de Google para el calendario del negocio?
- Para inventario: ¿qué insumos clave quiere controlar primero? ¿Registra compras hoy de alguna forma?

**Empezá por la Fase 0 y el discovery. No construyas nada hasta tener las respuestas y confirmar el modelo de los tres servicios.**
