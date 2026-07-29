# Fase D — Cada pedido cae solo en el calendario

**Camino completo:** pedido en la web → `crear_pedido_publico` → trigger diferido en Postgres → `net.http_post` → webhook de n8n → eventos en Google Calendar.

**Decisión de diseño:** todo lo difícil (fechas con zona horaria, colores, resumen del pedido) se calcula **en SQL**. n8n solo recibe campos ya listos y los pega. En Bianco la Fase D quedó trancada justamente en una expresión de n8n; acá no hay ninguna expresión de lógica, solo `{{ $json.campo }}`.

---

## Paso 1 — El calendario en Google

1. Entrá a Google Calendar con **chokbake.2024@gmail.com**.
2. Creá un calendario nuevo llamado **Pedidos Chok**.
3. Compartilo con tu hermana con permiso de **"Hacer cambios en los eventos"**.

Colores por tipo de servicio (ya resueltos en SQL, no los toques en n8n):

| Servicio | `colorId` | Color |
|---|---|---|
| Cuchareable | `5` | Banana |
| Mesa fría | `3` | Uva |
| Torta | `11` | Tomate |

---

## Paso 2 — Nodo 1: Webhook

En tu workflow nuevo, agregá un nodo **Webhook**:

| Campo | Valor |
|---|---|
| HTTP Method | `POST` |
| Path | `chok-pedidos` |
| Authentication | `Header Auth` |
| Respond | `Immediately` |

En **Authentication → Create new credential**:

| Campo | Valor |
|---|---|
| Name | `chok-auth` |
| Value | *una llave larga y aleatoria que inventes vos* |

> **Guardá esa llave en tu gestor de contraseñas.** No la pegues en el chat, no la mandes en captura. Es la misma que vas a poner en el bloque 2 de `migracion-04-calendario.sql`.

El nodo te muestra **dos URLs**: *Test URL* y *Production URL*. La que va en Vault es la de **producción** — la que termina en `/webhook/chok-pedidos`, no en `/webhook-test/`.

---

## Paso 3 — Nodo 2: Code (aplanar)

El webhook de n8n envuelve el cuerpo bajo `$json.body`. Sin este nodo, todos los demás tendrían que escribir `$json.body.cliente` en vez de `$json.cliente`.

Agregá un nodo **Code** justo después del webhook, con **Language = JavaScript** y modo *Run Once for All Items*:

```javascript
return $input.all().map(i => ({ json: i.json.body }));
```

> ⚠️ Si el nodo te quedó en **Python**, cambiale el idioma a JavaScript en el desplegable *Language*. Si preferís dejarlo en Python, el equivalente es:
> ```python
> return [{"json": item.json["body"]} for item in _input.all()]
> ```

---

## Cómo se conectan los nodos

Las dos ramas salen **del nodo Code**, en paralelo:

```
Webhook → Code ─┬─→ Create an event    (entrega · siempre)
                │
                └─→ If ─[true]─→ Create an event1   (producción)
```

**Por qué en paralelo y no en cadena.** Después de un nodo de Google Calendar, `$json` deja de ser tu pedido y pasa a ser la respuesta de la API de Google. Si colgaras el `If` detrás del primer evento, `{{ $json.crear_produccion }}` llegaría vacío y nunca se crearía el evento de producción.

Colgando las dos ramas del Code, las dos reciben el payload aplanado y todas las expresiones `{{ $json.campo }}` funcionan igual en los dos nodos de calendario.

---

## Paso 4 — Nodo 3: Google Calendar (entrega)

Nodo **Google Calendar → Create an event**. Conectá la cuenta `chokbake.2024@gmail.com` por OAuth.

| Campo | Valor |
|---|---|
| Calendar | `Pedidos Chok` |
| Start | `{{ $json.inicio }}` |
| End | `{{ $json.fin }}` |
| Use Default Reminders | activado |

En **Additional Fields**:

| Campo | Valor |
|---|---|
| Summary | `{{ $json.tipo_label }} · {{ $json.id }} · {{ $json.cliente }}` |
| Color ID | `{{ $json.color_id }}` |
| Description | el bloque de abajo |

**Description:**

```
Pedido: {{ $json.id }}
Cliente: {{ $json.cliente }}
Teléfono: {{ $json.telefono }}

{{ $json.resumen }}

Entrega: {{ $json.entrega }}
Dirección: {{ $json.direccion }}
Pago: {{ $json.metodo_pago }}
Total: {{ $json.valor }}
Anticipo: {{ $json.anticipo }}
Saldo: {{ $json.saldo }}

Notas: {{ $json.notas }}
Comprobante: {{ $json.comprobante_url }}
Gestionar: {{ $json.link_gestion }}
```

> ⚠️ **No teclees el `=` inicial de las expresiones.** n8n lo agrega solo al pasar el campo a modo expresión. Si lo escribís vos, corrompe el valor y sale *"invalid value"*. Esto nos mordió en Bianco.

---

## Paso 5 — Nodo 4: IF (¿lleva jornada de producción?)

Los cuchareables se hacen el día mismo. Las mesas frías y las tortas necesitan la jornada previa.

Nodo **If**:

| Campo | Valor |
|---|---|
| Value 1 | `{{ $json.crear_produccion }}` |
| Tipo de comparación | **Boolean** |
| Operación | **is true** |

> ⚠️ Elegí tipo **Boolean**, no String. Con String, el texto `"false"` evalúa como verdadero y te crea eventos de producción para todos los cuchareables.

---

## Paso 6 — Nodo 5: Google Calendar (producción)

Colgado de la salida **true** del IF (que a su vez cuelga del Code, no del primer evento — ver *Cómo se conectan los nodos*). Igual al Nodo 3 pero:

| Campo | Valor |
|---|---|
| Start | `{{ $json.produccion_inicio }}` |
| End | `{{ $json.produccion_fin }}` |
| Summary | `Producción · {{ $json.id }} · {{ $json.resumen }}` |
| Color ID | `{{ $json.color_id }}` |

Queda el día anterior de **8:00 a 10:00 am**. Si a tu hermana no le sirve ese horario, se cambia en `migracion-04-calendario.sql` (buscá `interval '8 hours'`).

---

## Paso 7 — Publicar

**Dale al botón "Active" / "Publish" del workflow.** Los cambios del editor **no** llegan a producción hasta publicar.

Síntoma de haberlo olvidado: *"con Execute manual funciona, pero el pedido real no crea el evento"*. Eso es siempre versión sin publicar.

Si tenías datos **pinned** en el webhook para probar, hacé **Unpin** antes de publicar.

---

## Paso 8 — Correr las migraciones, en este orden

**8a.** Abrí `docs/migracion-04a-secretos.sql`. Reemplazá los dos valores del bloque `declare`:

- la **Production URL** del nodo Webhook (dice `/webhook/`, no `/webhook-test/`)
- la **llave** del credential Header Auth del Paso 2

Pegalo en el SQL Editor y Run. Al final te muestra las dos filas guardadas: la URL se ve, la llave sale tapada. Si no ves las dos filas, no sigas.

**8b.** Pegá `docs/migracion-04-calendario.sql` completo y Run. Este no se edita.

> ⚠️ **El editor de Supabase corre cada script en una sola transacción.** Si una línea falla, se revierte *todo* el archivo — incluidas las extensiones. Síntoma clásico: corrés la migración, sale un error al final, y después `net._http_response does not exist` porque `pg_net` también se revirtió.

---

## Paso 9 — Prueba de punta a punta

Hacé un pedido real de cuchareables en https://sistemachok.vercel.app/cuchareables

Después, en el SQL Editor:

```sql
-- ¿Salió el POST? 200 ok · 403 header mal · 404 workflow sin publicar
select id, status_code, created
  from net._http_response
 order by created desc limit 5;

-- ¿Falló algún aviso? Debería estar vacía.
select * from notificaciones_fallidas order by created_at desc limit 5;
```

Y mirá el calendario: el evento debe aparecer en menos de 30 segundos, en color banana.

**Verificá las dos ramas del IF, no solo una.** Un pedido de cuchareables (1 evento) y uno de mesa fría (2 eventos). Que funcione una rama no dice nada de la otra.

---

## Si algo falla

| Síntoma | Causa casi siempre |
|---|---|
| `status_code` 404 | Workflow sin publicar, o pusiste la Test URL en Vault |
| `status_code` 403 | El header del webhook y el secreto de Vault no coinciden |
| Nada en `net._http_response` | `pg_net` no quedó habilitada, o el trigger no existe |
| Evento creado sin datos | Falta el nodo Code que aplana `$json.body` |
| Evento con $0 y sin productos | El trigger no quedó `DEFERRABLE INITIALLY DEFERRED` |
| El evento de producción nunca se crea | El `If` está colgado del nodo de calendario en vez del Code, así que `crear_produccion` llega vacío |
| `Llená la URL del webhook y la llave…` | Es el guardián de la migración: faltan los placeholders de las líneas 27 y 28 |
| `Invalid color id value` | Tecleaste el `=` en la expresión del Color ID |
| Eventos duplicados | Cada *Execute* de prueba deja rastro. Limpiá el calendario entre intentos. |

---

## Lo que queda abierto

- **Hora de la jornada de producción:** puse 8:00–10:00 am por defecto. Confirmalo con tu hermana.
- **Recordatorios:** quedan los del calendario por defecto. Si quiere aviso 1 hora antes, se agrega en el nodo.
