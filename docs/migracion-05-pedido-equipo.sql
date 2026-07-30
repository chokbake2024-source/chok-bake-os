-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 05 — Pedidos cargados por el equipo
-- Pegar en Supabase → SQL Editor → Run
--
-- Por qué otra función y no reusar crear_pedido_publico:
-- la pública exige anticipación mínima, cupo del día y comprobante.
-- Son guardas contra el cliente, no contra la dueña. Si ella toma un
-- pedido por teléfono para hoy mismo, o le fía a una clienta de siempre,
-- el sistema no puede frenarla.
--
-- Lo que SÍ se mantiene: el precio sale de la tabla productos, nunca del
-- navegador. El descuento va aparte y queda registrado, para que la
-- diferencia entre precio de lista y precio cobrado sea auditable.
-- ═══════════════════════════════════════════════════════════

alter table pedidos
  add column if not exists descuento numeric not null default 0,
  add column if not exists origen    text    not null default 'web';

comment on column pedidos.descuento is 'Rebaja aplicada por el equipo sobre el precio de lista';
comment on column pedidos.origen    is 'web = lo hizo el cliente · equipo = lo cargó la dueña';

-- `saldo` es columna generada sobre valor - anticipo. El descuento ya
-- viene restado dentro de valor, así que no hay que recalcular nada.

create or replace function crear_pedido_equipo(
  p_tipo        text,
  p_cliente     text,
  p_telefono    text,
  p_entrega     text,
  p_direccion   text,
  p_fecha       date,
  p_hora        text,
  p_metodo_pago text,
  p_notas       text,
  p_items       jsonb,
  p_estado      text    default 'confirmado',
  p_descuento   numeric default 0,
  p_anticipo    numeric default 0,
  p_comprobante_url text default null
) returns text
language plpgsql security invoker set search_path = public as $$
declare
  v_tipo    tipo_servicio := p_tipo::tipo_servicio;
  v_id      text;
  v_total   numeric := 0;
  v_item    jsonb;
  v_prod    productos%rowtype;
  v_cant    int;
  v_ex_id   text;
  v_ex      extras%rowtype;
  v_unit    numeric;
  v_nombres text[];
  v_hora    text;
begin
  if coalesce(trim(p_cliente),'')  = '' then raise exception 'NOMBRE_REQUERIDO'; end if;
  if coalesce(trim(p_telefono),'') = '' then raise exception 'TELEFONO_REQUERIDO'; end if;
  if p_fecha is null                    then raise exception 'FECHA_REQUERIDA'; end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'PEDIDO_VACIO';
  end if;
  if p_descuento < 0 then raise exception 'DESCUENTO_NEGATIVO'; end if;

  v_hora := nullif(left(coalesce(p_hora,''), 5), '');

  insert into pedidos (tipo, cliente, telefono, entrega, direccion, fecha_entrega,
                       hora_entrega, metodo_pago, notas, valor, anticipo,
                       descuento, estado, origen, comprobante_url)
  values (v_tipo, trim(p_cliente), trim(p_telefono), p_entrega::tipo_entrega,
          nullif(trim(coalesce(p_direccion,'')),''), p_fecha, v_hora,
          p_metodo_pago, nullif(trim(coalesce(p_notas,'')),''),
          0, greatest(coalesce(p_anticipo, 0), 0),
          p_descuento, p_estado::estado_pedido, 'equipo',
          nullif(trim(coalesce(p_comprobante_url,'')),''))
  returning id into v_id;

  -- El precio se recalcula acá igual que en la pública.
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from productos
      where id = v_item->>'producto_id' and tipo = v_tipo;
    if not found then raise exception 'PRODUCTO_INVALIDO: %', v_item->>'producto_id'; end if;

    v_cant    := greatest(coalesce((v_item->>'cantidad')::int, 1), 1);
    v_unit    := v_prod.precio;
    v_nombres := array[]::text[];

    for v_ex_id in select jsonb_array_elements_text(coalesce(v_item->'extras','[]'::jsonb)) loop
      select * into v_ex from extras where id = v_ex_id and tipo = v_tipo;
      if not found then raise exception 'EXTRA_INVALIDO: %', v_ex_id; end if;
      v_unit    := v_unit + v_ex.precio;
      v_nombres := v_nombres || v_ex.nombre;
    end loop;

    -- A diferencia de la pública, acá NO se exigen los toppings completos
    -- ni el mínimo de unidades: eso lo decide la dueña.
    insert into pedido_items (pedido_id, producto_id, nombre, cantidad, extras, precio_unit, subtotal)
    values (v_id, v_prod.id, v_prod.nombre, v_cant, to_jsonb(v_nombres), v_unit, v_unit * v_cant);

    v_total := v_total + (v_unit * v_cant);
  end loop;

  if p_descuento > v_total then raise exception 'DESCUENTO_MAYOR_AL_TOTAL'; end if;

  update pedidos set valor = v_total - p_descuento where id = v_id;

  return v_id;
end $$;

-- Solo el equipo. El público jamás debe poder saltarse las guardas.
revoke all on function crear_pedido_equipo(text,text,text,text,text,date,text,text,text,jsonb,text,numeric,numeric,text) from anon, public;
grant execute on function crear_pedido_equipo(text,text,text,text,text,date,text,text,text,jsonb,text,numeric,numeric,text) to authenticated;

-- ─── Verificación ───────────────────────────────────────────
-- Debe decir que anon NO tiene execute y authenticated SÍ:
--   select grantee, privilege_type
--     from information_schema.routine_privileges
--    where routine_name = 'crear_pedido_equipo';
