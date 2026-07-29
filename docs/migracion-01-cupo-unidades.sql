-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 01 — Cupo por unidades producidas al día
-- Pegar en Supabase → SQL Editor → Run (después de schema.sql)
--
-- Por qué: `cupo_dia` cuenta PEDIDOS. Para cuchareables el límite real
-- que dio el negocio es de PRODUCCIÓN: 30 unidades al día, sin importar
-- en cuántos pedidos vengan repartidas. Son dos topes distintos y
-- conviven: tortas y mesas frías se topan por pedidos, cuchareables
-- por unidades.
-- ═══════════════════════════════════════════════════════════

alter table reglas_servicio
  add column if not exists cupo_unidades_dia int;   -- null = sin límite

update reglas_servicio set cupo_unidades_dia = 30   where tipo = 'cuchareable';
update reglas_servicio set cupo_unidades_dia = null where tipo in ('mesa_fria','torta');

-- La vista pública tiene que exponerlo para que el formulario avise antes de enviar.
create or replace view reglas_publicas as
  select tipo, anticipacion_minutos, cupo_dia, cupo_unidades_dia, minimo_unidades,
         requiere_comprobante, porcentaje_anticipo, hora_min, hora_max
  from reglas_servicio;

alter view reglas_publicas set (security_invoker = off);
grant select on reglas_publicas to anon, authenticated;

-- ─── Unidades ya comprometidas para una fecha ───────────────
create or replace function unidades_disponibles(p_fecha date, p_tipo tipo_servicio)
returns int language plpgsql security definer set search_path = public as $$
declare v_cupo int; v_usado int;
begin
  select cupo_unidades_dia into v_cupo from reglas_servicio where tipo = p_tipo;
  if v_cupo is null then return 9999; end if;
  select coalesce(sum(i.cantidad), 0) into v_usado
    from pedido_items i
    join pedidos p on p.id = i.pedido_id
   where p.fecha_entrega = p_fecha and p.tipo = p_tipo and p.estado <> 'cancelado';
  return greatest(v_cupo - v_usado, 0);
end $$;

grant execute on function unidades_disponibles(date, tipo_servicio) to anon, authenticated;

-- ─── El tope se valida donde importa: dentro de crear_pedido_publico ───
create or replace function crear_pedido_publico(
  p_tipo            text,
  p_cliente         text,
  p_telefono        text,
  p_entrega         text,
  p_direccion       text,
  p_fecha           date,
  p_hora            text,
  p_metodo_pago     text,
  p_notas           text,
  p_comprobante_url text,
  p_items           jsonb
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_tipo    tipo_servicio := p_tipo::tipo_servicio;
  v_reglas  reglas_servicio%rowtype;
  v_id      text;
  v_total   numeric := 0;
  v_unids   int := 0;
  v_item    jsonb;
  v_prod    productos%rowtype;
  v_cant    int;
  v_extras  jsonb;
  v_ex_id   text;
  v_ex      extras%rowtype;
  v_unit    numeric;
  v_nombres text[];
  v_hora    text;
  v_momento timestamptz;
begin
  select * into v_reglas from reglas_servicio where tipo = v_tipo;

  if coalesce(trim(p_cliente),'')  = '' then raise exception 'NOMBRE_REQUERIDO'; end if;
  if coalesce(trim(p_telefono),'') = '' then raise exception 'TELEFONO_REQUERIDO'; end if;
  if p_fecha is null                    then raise exception 'FECHA_REQUERIDA'; end if;
  if p_entrega = 'domicilio' and coalesce(trim(p_direccion),'') = '' then
    raise exception 'DIRECCION_REQUERIDA';
  end if;
  if jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 then
    raise exception 'PEDIDO_VACIO';
  end if;
  if v_reglas.requiere_comprobante and coalesce(trim(p_comprobante_url),'') = '' then
    raise exception 'COMPROBANTE_REQUERIDO';
  end if;

  v_hora := nullif(left(coalesce(p_hora,''), 5), '');
  if v_reglas.hora_min is not null and v_hora is not null then
    if v_hora < v_reglas.hora_min or v_hora > v_reglas.hora_max then
      raise exception 'HORA_FUERA_DE_RANGO';
    end if;
  end if;

  v_momento := (p_fecha::text || ' ' || coalesce(v_hora,'13:00'))::timestamp
               at time zone 'America/Bogota';
  if v_momento < now() + make_interval(mins => v_reglas.anticipacion_minutos) then
    raise exception 'ANTICIPACION_MINIMA';
  end if;

  if v_reglas.cupo_dia is not null and cupo_disponible(p_fecha, v_tipo) <= 0 then
    raise exception 'CUPO_LLENO';
  end if;

  insert into pedidos (tipo, cliente, telefono, entrega, direccion, fecha_entrega,
                       hora_entrega, metodo_pago, notas, valor, comprobante_url)
  values (v_tipo, trim(p_cliente), trim(p_telefono), p_entrega::tipo_entrega,
          nullif(trim(coalesce(p_direccion,'')),''), p_fecha, v_hora,
          p_metodo_pago, nullif(trim(coalesce(p_notas,'')),''), 0,
          nullif(trim(coalesce(p_comprobante_url,'')),''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_prod from productos
      where id = v_item->>'producto_id' and activo and tipo = v_tipo;
    if not found then raise exception 'PRODUCTO_INVALIDO: %', v_item->>'producto_id'; end if;

    v_cant := greatest(coalesce((v_item->>'cantidad')::int, 1), 1);
    if v_cant < v_reglas.minimo_unidades then
      raise exception 'MINIMO_UNIDADES: % (mínimo %)', v_prod.nombre, v_reglas.minimo_unidades;
    end if;

    v_unit    := v_prod.precio;
    v_extras  := coalesce(v_item->'extras', '[]'::jsonb);
    v_nombres := array[]::text[];

    for v_ex_id in select jsonb_array_elements_text(v_extras) loop
      select * into v_ex from extras where id = v_ex_id and activo and tipo = v_tipo;
      if not found then raise exception 'EXTRA_INVALIDO: %', v_ex_id; end if;
      v_unit    := v_unit + v_ex.precio;
      v_nombres := v_nombres || v_ex.nombre;
    end loop;

    if v_prod.slots > 0 and array_length(v_nombres, 1) is distinct from v_prod.slots then
      raise exception 'TOPPINGS_INCOMPLETOS: % requiere % topping(s)', v_prod.nombre, v_prod.slots;
    end if;

    insert into pedido_items (pedido_id, producto_id, nombre, cantidad, extras, precio_unit, subtotal)
    values (v_id, v_prod.id, v_prod.nombre, v_cant, to_jsonb(v_nombres), v_unit, v_unit * v_cant);

    v_total  := v_total + (v_unit * v_cant);
    v_unids  := v_unids + v_cant;
  end loop;

  -- Tope de producción. Se cuenta contra la tabla (no contra
  -- unidades_disponibles(), que viene recortada a 0 y nunca sería negativa)
  -- y con el pedido ya insertado, para que dos clientes simultáneos no puedan
  -- pasarse del tope entre los dos.
  if v_reglas.cupo_unidades_dia is not null then
    declare v_dia int;
    begin
      select coalesce(sum(i.cantidad), 0) into v_dia
        from pedido_items i
        join pedidos p on p.id = i.pedido_id
       where p.fecha_entrega = p_fecha and p.tipo = v_tipo and p.estado <> 'cancelado';
      if v_dia > v_reglas.cupo_unidades_dia then
        raise exception 'CUPO_UNIDADES_LLENO: quedan % de % unidades',
          greatest(v_reglas.cupo_unidades_dia - (v_dia - v_unids), 0),
          v_reglas.cupo_unidades_dia;
      end if;
    end;
  end if;

  update pedidos
     set valor    = v_total,
         anticipo = round(v_total * v_reglas.porcentaje_anticipo / 100)
   where id = v_id;

  return v_id;
end $$;

grant execute on function crear_pedido_publico(text,text,text,text,text,date,text,text,text,text,jsonb)
  to anon, authenticated;
