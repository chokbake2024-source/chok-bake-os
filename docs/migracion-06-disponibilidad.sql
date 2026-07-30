-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 06 — Disponibilidad, días bloqueados y resumen diario
-- Pegar en Supabase → SQL Editor → Run
--
-- Cubre tres cosas:
--   1. Una sola consulta que le dice al formulario si una fecha sirve
--   2. Días cerrados a mano (vacaciones, festivos, "ese día no produzco")
--   3. El aviso de las 7 am con la producción del día
-- ═══════════════════════════════════════════════════════════

-- ─── 1. DÍAS BLOQUEADOS ─────────────────────────────────────
create table if not exists dias_bloqueados (
  id         bigserial primary key,
  fecha      date not null,
  tipo       tipo_servicio,          -- null = cierra todos los servicios
  motivo     text,
  created_at timestamptz not null default now()
);

-- Dos índices parciales en vez de uno con coalesce(tipo::text,'*'):
-- el cast de enum a text NO es IMMUTABLE (Postgres permite renombrar las
-- etiquetas de un enum), y un índice exige expresiones inmutables.
-- Partiéndolo en dos, no hace falta castear nada.
--   · un cierre por servicio y fecha
--   · un solo cierre total por fecha
create unique index if not exists dias_bloqueados_por_tipo
  on dias_bloqueados (fecha, tipo) where tipo is not null;

create unique index if not exists dias_bloqueados_totales
  on dias_bloqueados (fecha) where tipo is null;

alter table dias_bloqueados enable row level security;

do $$ begin
  create policy equipo_gestiona_dias on dias_bloqueados
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

revoke all on dias_bloqueados from anon;
grant select, insert, update, delete on dias_bloqueados to authenticated;
grant usage, select on sequence dias_bloqueados_id_seq to authenticated;

-- ─── 2. EL BLOQUEO SE APLICA SOLO AL PÚBLICO ────────────────
-- Un día cerrado es para los clientes. Si la dueña decide tomar un pedido
-- ese día igual, es su negocio. El trigger mira `origen`, así que no hay
-- que reescribir crear_pedido_publico (que ya es larga) para agregar esto.
create or replace function validar_dia_pedido()
returns trigger language plpgsql as $$
declare v_motivo text;
begin
  if new.origen = 'web' then
    select coalesce(motivo, 'ese día no hay producción') into v_motivo
      from dias_bloqueados
     where fecha = new.fecha_entrega
       and (tipo is null or tipo = new.tipo)
     limit 1;

    if v_motivo is not null then
      raise exception 'DIA_BLOQUEADO: %', v_motivo;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists tr_validar_dia on pedidos;
create trigger tr_validar_dia
  before insert on pedidos
  for each row execute function validar_dia_pedido();

-- ─── 3. DISPONIBILIDAD EN UNA SOLA CONSULTA ─────────────────
-- El formulario preguntaba tres cosas por separado (o ninguna). Con esto
-- pide una vez al elegir la fecha y ya sabe si puede seguir.
create or replace function disponibilidad(p_fecha date, p_tipo tipo_servicio)
returns table (
  bloqueado  boolean,
  motivo     text,
  cupos      int,      -- pedidos que faltan para llenar el día (null = sin tope)
  unidades   int       -- unidades de producción libres (null = sin tope)
)
language plpgsql security definer set search_path = public as $$
declare
  v_reglas reglas_servicio%rowtype;
  v_motivo text;
begin
  select * into v_reglas from reglas_servicio where tipo = p_tipo;

  select coalesce(d.motivo, 'ese día no hay producción') into v_motivo
    from dias_bloqueados d
   where d.fecha = p_fecha and (d.tipo is null or d.tipo = p_tipo)
   limit 1;

  return query select
    v_motivo is not null,
    v_motivo,
    case when v_reglas.cupo_dia is null then null
         else cupo_disponible(p_fecha, p_tipo) end,
    case when v_reglas.cupo_unidades_dia is null then null
         else unidades_disponibles(p_fecha, p_tipo) end;
end $$;

grant execute on function disponibilidad(date, tipo_servicio) to anon, authenticated;

-- ─── 4. RESUMEN DIARIO ──────────────────────────────────────
-- La URL del webhook de resumen es distinta a la de pedidos: son dos
-- workflows separados en n8n. Guardala con migracion-06a-secreto-resumen.sql
create or replace function armar_resumen_dia(p_fecha date)
returns jsonb language sql stable set search_path = public as $$
  with lineas as (
    select p.id, p.tipo, p.cliente, p.telefono, p.hora_entrega, p.entrega,
           p.direccion, p.valor, p.saldo, p.estado, p.notas,
           string_agg(i.cantidad || '× ' || i.nombre, ' · ' order by i.nombre) as detalle,
           sum(i.cantidad) as unidades
      from pedidos p
      join pedido_items i on i.pedido_id = p.id
     where p.fecha_entrega = p_fecha and p.estado <> 'cancelado'
     group by p.id, p.tipo, p.cliente, p.telefono, p.hora_entrega, p.entrega,
              p.direccion, p.valor, p.saldo, p.estado, p.notas
  )
  select jsonb_build_object(
    'evento',    'resumen_diario',
    'fecha',     p_fecha::text,
    'cantidad',  (select count(*) from lineas),
    'unidades',  coalesce((select sum(unidades) from lineas), 0),
    'total',     coalesce((select sum(valor) from lineas), 0),
    'por_cobrar',coalesce((select sum(saldo) from lineas), 0),
    'pedidos',   coalesce((select jsonb_agg(jsonb_build_object(
                    'id', id, 'hora', coalesce(hora_entrega, 'sin hora'),
                    'cliente', cliente, 'telefono', telefono,
                    'detalle', detalle,
                    'entrega', case when entrega = 'domicilio'
                                    then 'Domicilio: ' || coalesce(direccion, '—')
                                    else 'Recoge en el punto' end,
                    'valor', valor, 'saldo', saldo, 'estado', estado,
                    'notas', coalesce(notas, '')
                  ) order by hora_entrega nulls last) from lineas), '[]'::jsonb),
    'link_panel', 'https://sistemachok.vercel.app/agenda'
  );
$$;

create or replace function enviar_resumen_diario()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url     text;
  v_secret  text;
  v_payload jsonb;
  v_hoy     date := (now() at time zone 'America/Bogota')::date;
begin
  begin
    select decrypted_secret into v_url
      from vault.decrypted_secrets where name = 'n8n_chok_url_resumen';
    select decrypted_secret into v_secret
      from vault.decrypted_secrets where name = 'n8n_chok_secret';

    if v_url is null or v_secret is null then
      raise exception 'Falta n8n_chok_url_resumen o n8n_chok_secret en Vault';
    end if;

    v_payload := armar_resumen_dia(v_hoy);

    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'chok-auth', v_secret),
      body    := v_payload
    );
  exception when others then
    insert into notificaciones_fallidas (pedido_id, error, payload)
    values ('RESUMEN-' || v_hoy::text, sqlerrm, v_payload);
    raise warning 'Resumen diario falló: %', sqlerrm;
  end;
end $$;

-- ─── 5. EL RELOJ ────────────────────────────────────────────
-- pg_cron trabaja en UTC. Colombia es UTC-5 y no tiene horario de verano,
-- así que 7:00 am de Cúcuta son las 12:00 UTC, todo el año.
--
-- Si esta línea da error de permisos, habilitá pg_cron desde el panel:
--   Supabase → Database → Extensions → buscar "pg_cron" → Enable
-- y volvé a correr el archivo.
create extension if not exists pg_cron;

select cron.unschedule('resumen-diario-chok')
  where exists (select 1 from cron.job where jobname = 'resumen-diario-chok');

select cron.schedule(
  'resumen-diario-chok',
  '0 12 * * *',
  $$ select enviar_resumen_diario(); $$
);

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════
-- 1) El cron quedó agendado:
--    select jobname, schedule, active from cron.job;
--
-- 2) Probá el resumen sin esperar a mañana:
--    select jsonb_pretty(armar_resumen_dia(current_date));
--
-- 3) Mandalo de verdad, ahora:
--    select enviar_resumen_diario();
--    select id, status_code, created from net._http_response order by created desc limit 3;
--
-- 4) Cerrá un día y probá que el formulario público lo rechace:
--    insert into dias_bloqueados (fecha, tipo, motivo)
--    values ('2026-12-25', null, 'Navidad');
--
-- 5) Cómo se ve la disponibilidad de una fecha:
--    select * from disponibilidad(current_date + 3, 'mesa_fria');
