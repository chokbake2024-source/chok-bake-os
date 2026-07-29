-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 04 — Aviso al calendario (Fase D)
--
-- ⚠️ CORRER ANTES: docs/migracion-04a-secretos.sql
--    Este archivo NO lleva secretos y no hay que editarlo. Pegalo y Run.
--
-- Qué hace: cuando entra un pedido, Postgres manda un POST a n8n con un
-- JSON ya masticado (fechas, colores y resumen calculados acá), y n8n
-- crea los eventos en Google Calendar.
-- ═══════════════════════════════════════════════════════════

-- ─── 1. Extensiones ─────────────────────────────────────────
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- ─── 2. Los secretos ya deben existir ───────────────────────
-- Viven en Vault, nunca inline en la función: en Bianco eso obligó a
-- re-pegar el secreto en cada edición y una vez rompió el header con un
-- carácter raro.
--
-- Ojo: el editor de Supabase corre el script en UNA transacción. Si esto
-- falla, se revierte todo el archivo — incluida la extensión de arriba.
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'n8n_chok_url')
  or not exists (select 1 from vault.decrypted_secrets where name = 'n8n_chok_secret')
  then
    raise exception 'Faltan los secretos. Corré primero docs/migracion-04a-secretos.sql';
  end if;
end $$;

-- ─── 3. Bitácora de fallos ──────────────────────────────────
-- Un `exception when others` silencioso esconde bugs (en Bianco nos
-- ocultó uno 40 minutos). Si el aviso falla, queda registrado acá.
create table if not exists notificaciones_fallidas (
  id         bigserial primary key,
  pedido_id  text,
  error      text,
  payload    jsonb,
  created_at timestamptz not null default now()
);

alter table notificaciones_fallidas enable row level security;

do $$ begin
  create policy equipo_ve_fallos on notificaciones_fallidas
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

revoke all on notificaciones_fallidas from anon;
grant select, insert, update, delete on notificaciones_fallidas to authenticated;
grant usage, select on sequence notificaciones_fallidas_id_seq to authenticated;

-- ─── 4. Colores y duración por tipo de servicio ─────────────
-- Los colorId válidos de Google Calendar son los textos '1' a '11'.
-- Van resueltos acá, en SQL, y no como expresión en n8n: en Bianco la
-- expresión del color fue el bloqueo que dejó la Fase D a medias.
create or replace function calendario_config(p_tipo tipo_servicio)
returns table (color_id text, minutos int, produccion boolean)
language sql immutable as $$
  select
    case p_tipo when 'cuchareable' then '5'   -- banana
                when 'mesa_fria'   then '3'   -- uva
                else                    '11'  -- tomate
    end,
    case p_tipo when 'cuchareable' then 30 else 60 end,
    -- Cuchareables se hacen el día mismo; mesas frías y tortas necesitan
    -- una jornada previa de producción.
    p_tipo <> 'cuchareable';
$$;

-- ─── 5. La función que avisa ────────────────────────────────
create or replace function notificar_pedido()
returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url     text;
  v_secret  text;
  v_hora    text;
  v_cfg     record;
  v_items   jsonb;
  v_resumen text;
  v_ini     timestamp;
  v_payload jsonb;
begin
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'n8n_chok_url';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'n8n_chok_secret';

    if v_url is null or v_secret is null then
      raise exception 'Faltan los secretos n8n_chok_url / n8n_chok_secret en Vault';
    end if;

    -- hora_entrega es text: normalizar a HH:MM (puede venir '15:00:00')
    v_hora := left(coalesce(new.hora_entrega, '13:00'), 5);
    v_ini  := (new.fecha_entrega::text || ' ' || v_hora)::timestamp;

    select * into v_cfg from calendario_config(new.tipo);

    -- Las líneas ya existen: este trigger es DEFERRABLE INITIALLY DEFERRED
    -- y corre al commit, no en el instante del INSERT.
    select
      coalesce(jsonb_agg(jsonb_build_object(
        'nombre',   i.nombre,
        'cantidad', i.cantidad,
        'extras',   i.extras
      ) order by i.nombre), '[]'::jsonb),
      string_agg(
        i.cantidad || '× ' || i.nombre ||
        case when jsonb_array_length(i.extras) > 0
             then ' (' || (select string_agg(x, ', ')
                             from jsonb_array_elements_text(i.extras) x) || ')'
             else '' end,
        ' · ' order by i.nombre)
    into v_items, v_resumen
    from pedido_items i
    where i.pedido_id = new.id;

    v_payload := jsonb_build_object(
      'id',              new.id,
      'tipo',            new.tipo,
      'tipo_label',      case new.tipo when 'cuchareable' then 'Cuchareable'
                                       when 'mesa_fria'   then 'Mesa fría'
                                       else 'Torta' end,
      'cliente',         new.cliente,
      'telefono',        new.telefono,
      'entrega',         new.entrega,
      'direccion',       coalesce(new.direccion, 'Recoge en el punto'),
      'fecha_entrega',   new.fecha_entrega::text,
      'hora_entrega',    v_hora,
      'metodo_pago',     coalesce(new.metodo_pago, '—'),
      'notas',           coalesce(new.notas, ''),
      'valor',           new.valor,
      'anticipo',        new.anticipo,
      'saldo',           new.saldo,
      'comprobante_url', coalesce(new.comprobante_url, ''),
      'items',           v_items,
      'resumen',         coalesce(v_resumen, 'sin líneas'),
      -- Todo lo que n8n necesita, ya listo: cero expresiones de fecha allá.
      'color_id',        v_cfg.color_id,
      'inicio',          to_char(v_ini, 'YYYY-MM-DD"T"HH24:MI:SS') || '-05:00',
      'fin',             to_char(v_ini + make_interval(mins => v_cfg.minutos),
                                 'YYYY-MM-DD"T"HH24:MI:SS') || '-05:00',
      'crear_produccion', v_cfg.produccion,
      'produccion_inicio', to_char((new.fecha_entrega - 1)::timestamp + interval '8 hours',
                                   'YYYY-MM-DD"T"HH24:MI:SS') || '-05:00',
      'produccion_fin',    to_char((new.fecha_entrega - 1)::timestamp + interval '10 hours',
                                   'YYYY-MM-DD"T"HH24:MI:SS') || '-05:00',
      'link_gestion',    'https://sistemachok.vercel.app/pedidos'
    );

    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
                   'Content-Type', 'application/json',
                   'chok-auth',    v_secret
                 ),
      body    := v_payload
    );

  exception when others then
    -- Un fallo de aviso NO puede tumbar el pedido del cliente.
    insert into notificaciones_fallidas (pedido_id, error, payload)
    values (new.id, sqlerrm, v_payload);
    raise warning 'Aviso de calendario falló para %: %', new.id, sqlerrm;
  end;

  return null;
end $$;

-- ─── 6. El trigger, diferido ────────────────────────────────
-- DEFERRABLE INITIALLY DEFERRED es la pieza clave: corre al COMMIT.
-- Un AFTER INSERT normal dispararía antes de que existan las líneas y
-- con valor = 0, porque crear_pedido_publico inserta el pedido primero
-- y recalcula el total al final.
drop trigger if exists tr_notificar_pedido on pedidos;

create constraint trigger tr_notificar_pedido
  after insert on pedidos
  deferrable initially deferred
  for each row
  execute function notificar_pedido();

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN (correr después de hacer un pedido de prueba)
-- ═══════════════════════════════════════════════════════════
-- 1) ¿Salió el POST y con qué status?  200 ok · 403 auth mal · 404 workflow inactivo
--    select id, status_code, created
--      from net._http_response order by created desc limit 5;
--
-- 2) ¿Falló algún aviso?  (debería estar vacía)
--    select * from notificaciones_fallidas order by created_at desc limit 5;
--
-- 3) Ver el payload exacto que se armó, sin mandar nada:
--    select jsonb_pretty(to_jsonb(p)) from pedidos p order by created_at desc limit 1;
