# Resumen diario de producción

Todos los días a las **7:00 am** de Cúcuta, tu hermana recibe la lista de lo que hay que producir y entregar ese día.

---

## Antes de empezar: WhatsApp no se puede, y por qué

Mandar un WhatsApp **automático** requiere la **API de WhatsApp Business** (Meta, Twilio o 360dialog). Es un servicio pago, con verificación de empresa y plantillas de mensaje aprobadas por Meta. No es un "conectá tu número y listo".

Lo que se abre con `wa.me/...` es una *pantalla de chat con el texto ya escrito* — sirve cuando hay alguien que le da enviar, no para un aviso automático a las 7 am.

**Lo realista hoy: correo.** La cuenta `chokbake.2024@gmail.com` ya está conectada en n8n para el calendario, así que el nodo de Gmail no cuesta configuración extra. Llega al celular como notificación igual.

Si más adelante pagan la API de WhatsApp, se cambia solo el último nodo: el resto queda igual.

---

## Paso 1 — Workflow nuevo en n8n

Creá un workflow aparte, **no toques el de los pedidos**. Ese ya funciona y no vale la pena arriesgarlo.

### Nodo 1: Webhook

| Campo | Valor |
|---|---|
| HTTP Method | `POST` |
| Path | `chok-resumen` |
| Authentication | `Header Auth` |
| Credential | el **mismo** `chok-auth` que ya creaste |
| Respond | `Immediately` |

La llave es la misma de siempre. No hay que inventar otra.

### Nodo 2: Code (aplanar)

**Language: JavaScript.**

```javascript
return $input.all().map(i => ({ json: i.json.body }));
```

### Nodo 3: Gmail → Send

Conectá `chokbake.2024@gmail.com`.

| Campo | Valor |
|---|---|
| To | el correo de tu hermana |
| Subject | `Chok Bake · {{ $json.cantidad }} entregas hoy` |
| Email Type | `HTML` |

**Message:**

```
<h2 style="font-family:Georgia,serif;color:#5a1226">
  {{ $json.cantidad }} entregas · {{ $json.unidades }} unidades
</h2>
<p style="color:#2e2a28">
  Total del día: <b>{{ $json.total }}</b><br>
  Por cobrar: <b>{{ $json.por_cobrar }}</b>
</p>
<hr>
{{ $json.pedidos.map(p =>
  '<p style="margin:14px 0"><b>' + p.hora + ' · ' + p.cliente + '</b><br>' +
  p.detalle + '<br>' +
  '<span style="color:#8c2740">' + p.entrega + '</span><br>' +
  '<small>' + p.id + ' · ' + p.estado +
  (p.saldo > 0 ? ' · saldo ' + p.saldo : '') +
  (p.notas ? '<br>Notas: ' + p.notas : '') +
  '</small></p>'
).join('') }}
<hr>
<a href="{{ $json.link_panel }}">Ver la agenda completa</a>
```

> ⚠️ Igual que en el otro workflow: **no teclees el `=` inicial** de las expresiones.

### Paso 2 — Publicar

**Botón Active.** Sin esto el POST llega a un webhook que no existe y da 404.

---

## Paso 3 — Guardar la URL

Copiá la **Production URL** del webhook (dice `/webhook/chok-resumen`) y corré `docs/migracion-06a-secreto-resumen.sql` con ese valor.

Recordá: **no borres las comillas simples**, reemplazá solo lo que está entre ellas.

---

## Paso 4 — Correr la migración

Pegá `docs/migracion-06-disponibilidad.sql` completo y Run. Ese archivo trae tres cosas: los días cerrados, la consulta de disponibilidad y el reloj del resumen.

El reloj usa **pg_cron**, que trabaja en UTC. Colombia es UTC−5 y no tiene horario de verano, así que `0 12 * * *` son las 7:00 am de Cúcuta todo el año.

---

## Paso 5 — Probarlo sin esperar a mañana

```sql
-- ¿Qué armaría el resumen de hoy?
select jsonb_pretty(armar_resumen_dia(current_date));

-- Mandalo ahora mismo
select enviar_resumen_diario();

-- ¿Llegó a n8n?
select id, status_code, created from net._http_response order by created desc limit 3;
```

Y confirmá que el cron quedó agendado:

```sql
select jobname, schedule, active from cron.job;
```

---

## Si algo falla

| Síntoma | Causa |
|---|---|
| `status_code` 404 | Workflow sin publicar, o guardaste la Test URL |
| `status_code` 403 | La llave del credential no es la misma que `n8n_chok_secret` |
| No llega el correo | El nodo Gmail no tiene la cuenta conectada, o cayó en spam la primera vez |
| Correo vacío | Falta el nodo Code que aplana `$json.body` |
| Nada a las 7 am | `select * from cron.job` — si no aparece, `pg_cron` no quedó habilitada |
| Fila en `notificaciones_fallidas` | Ahí está el error exacto, con el payload que se intentó mandar |

---

## Detalle de diseño

El resumen se manda **siempre**, incluso los días sin entregas. Un correo que dice "0 entregas hoy" confirma que el sistema está vivo; el silencio no distingue entre "no hay pedidos" y "se rompió algo".

Si con el tiempo molesta, se cambia agregando un nodo **If** con `{{ $json.cantidad }}` mayor a 0 antes del Gmail.
