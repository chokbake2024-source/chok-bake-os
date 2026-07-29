-- ═══════════════════════════════════════════════════════════
-- CHOK BAKE OS — Esquema base (Fase 1)
-- Pegar completo en Supabase → SQL Editor → Run
-- Idempotente: se puede correr varias veces sin romper nada.
-- ═══════════════════════════════════════════════════════════

-- ─── TIPOS ───────────────────────────────────────────────
do $$ begin
  create type tipo_servicio as enum ('cuchareable','mesa_fria','torta');
exception when duplicate_object then null; end $$;

do $$ begin
  create type tipo_entrega as enum ('domicilio','recoge');
exception when duplicate_object then null; end $$;

do $$ begin
  create type estado_pedido as enum ('nuevo','confirmado','en_produccion','entregado','cancelado');
exception when duplicate_object then null; end $$;

-- ─── REGLAS POR SERVICIO ─────────────────────────────────
-- Las reglas de negocio viven en tabla, no en código.
-- Cambiar una regla = UPDATE, no deploy.
create table if not exists reglas_servicio (
  tipo                 tipo_servicio primary key,
  anticipacion_minutos int     not null default 30,
  cupo_dia             int,                          -- null = sin límite
  minimo_unidades      int     not null default 1,   -- por producto
  requiere_comprobante boolean not null default false,
  porcentaje_anticipo  numeric not null default 0,   -- 0 = paga al recibir
  hora_min             text,                         -- 'HH:MM' o null = libre
  hora_max             text
);

insert into reglas_servicio (tipo, anticipacion_minutos, cupo_dia, minimo_unidades, requiere_comprobante, porcentaje_anticipo, hora_min, hora_max) values
  ('cuchareable',      30, null,  1, false,  0, '13:00', '18:00'),
  ('mesa_fria',      2880,    2, 16,  true, 50, null,    null),
  ('torta',          2880,    3,  1,  true, 50, null,    null)
on conflict (tipo) do update set
  anticipacion_minutos = excluded.anticipacion_minutos,
  cupo_dia             = excluded.cupo_dia,
  minimo_unidades      = excluded.minimo_unidades,
  requiere_comprobante = excluded.requiere_comprobante,
  porcentaje_anticipo  = excluded.porcentaje_anticipo,
  hora_min             = excluded.hora_min,
  hora_max             = excluded.hora_max;

-- ─── PRODUCTOS ───────────────────────────────────────────
-- Única fuente de verdad de precios. El navegador NUNCA manda precios.
create table if not exists productos (
  id        text primary key,
  tipo      tipo_servicio not null,
  categoria text not null,              -- 'cuchareable' | 'vasca' | 'brownie' | 'mesa_fria' | 'torta'
  nombre    text not null,
  precio    numeric not null,           -- por unidad / porción
  unidad    text not null default 'unidad',
  emoji     text,
  detalle   text,                       -- ej. '12 oz', '6 porciones'
  slots     int not null default 0,     -- cuántos toppings obligatorios (brownies)
  sabor     text,                       -- tortas
  tamano    int,                        -- tortas: porciones
  orden     int not null default 0,
  activo    boolean not null default true
);

-- ─── EXTRAS ──────────────────────────────────────────────
create table if not exists extras (
  id     text primary key,
  tipo   tipo_servicio not null,
  grupo  text not null,                 -- 'adicion' | 'premium' | 'topping_vasca' | 'topping_brownie'
  nombre text not null,
  precio numeric not null default 0,
  orden  int not null default 0,
  activo boolean not null default true
);

-- ─── PEDIDOS ─────────────────────────────────────────────
create sequence if not exists pedidos_seq start 1000;

create table if not exists pedidos (
  id              text primary key default 'PED-' || nextval('pedidos_seq'),
  tipo            tipo_servicio not null,
  cliente         text not null,
  telefono        text not null,
  entrega         tipo_entrega not null,
  direccion       text,
  fecha_entrega   date not null,
  hora_entrega    text,                              -- 'HH:MM' normalizado
  metodo_pago     text,
  notas           text,
  valor           numeric not null,                  -- calculado en el servidor
  anticipo        numeric not null default 0,
  saldo           numeric generated always as (valor - anticipo) stored,
  estado          estado_pedido not null default 'nuevo',
  comprobante_url text,
  created_at      timestamptz not null default now()
);

create index if not exists pedidos_fecha_idx on pedidos (fecha_entrega, tipo);

create table if not exists pedido_items (
  id          uuid primary key default gen_random_uuid(),
  pedido_id   text not null references pedidos(id) on delete cascade,
  producto_id text not null references productos(id),
  nombre      text not null,                         -- congelado al momento del pedido
  cantidad    int  not null check (cantidad > 0),
  extras      jsonb not null default '[]'::jsonb,    -- nombres de extras elegidos
  precio_unit numeric not null,
  subtotal    numeric not null
);

create index if not exists pedido_items_pedido_idx on pedido_items (pedido_id);

-- ═══════════════════════════════════════════════════════════
-- SEED — CUCHAREABLES
-- ═══════════════════════════════════════════════════════════
insert into productos (id, tipo, categoria, nombre, precio, detalle, emoji, orden) values
  ('CUCH-KLIM',   'cuchareable','cuchareable','Leche Klim',      17000,'12 oz','🥛',1),
  ('CUCH-MILO',   'cuchareable','cuchareable','Milo',            17000,'12 oz','🟤',2),
  ('CUCH-KINDER', 'cuchareable','cuchareable','Kinder',          18000,'12 oz','🍫',3),
  ('CUCH-PIST',   'cuchareable','cuchareable','Pistacho',        18000,'12 oz','🟢',4),
  ('CUCH-MARA',   'cuchareable','cuchareable','Maracuyá',        17000,'12 oz','🌟',5),
  ('CUCH-COOKIE', 'cuchareable','cuchareable','Cookies & Cream', 17000,'12 oz','🍪',6)
on conflict (id) do update set precio = excluded.precio, nombre = excluded.nombre, activo = true;

-- TARTA VASCA
insert into productos (id, tipo, categoria, nombre, precio, detalle, emoji, slots, orden) values
  ('VASCA-CLAS', 'cuchareable','vasca','Tarta Vasca Clásica',           20000,'Porción personal','🫕',1,1),
  ('VASCA-NUT',  'cuchareable','vasca','Tarta Vasca Nutella + Brownie', 25000,'Porción personal','🍫',1,2)
on conflict (id) do update set precio = excluded.precio, nombre = excluded.nombre, slots = excluded.slots, activo = true;

-- BROWNIES
insert into productos (id, tipo, categoria, nombre, precio, detalle, emoji, slots, orden) values
  ('BROW-X4',    'cuchareable','brownie','Caja x4',       25000,'4 brownies',  '📦',4,1),
  ('BROW-X6',    'cuchareable','brownie','Caja x6',       35000,'6 brownies',  '📦',6,2),
  ('BROW-TORTA', 'cuchareable','brownie','Torta Brownie', 55000,'6 porciones','🎂',3,3)
on conflict (id) do update set precio = excluded.precio, nombre = excluded.nombre, slots = excluded.slots, activo = true;

-- ═══════════════════════════════════════════════════════════
-- SEED — MESAS FRÍAS (precio por porción · mínimo 16 por producto)
-- ═══════════════════════════════════════════════════════════
insert into productos (id, tipo, categoria, nombre, precio, unidad, emoji, orden) values
  ('MF-CUPIMG',  'mesa_fria','mesa_fria','Cupcakes con imagen',                                                    4000,'porcion','🧁',1),
  ('MF-MINICUP', 'mesa_fria','mesa_fria','Mini cupcakes con crema',                                                2500,'porcion','🎂',2),
  ('MF-MEREN',   'mesa_fria','mesa_fria','Merengue con arequipe o nutella, trozos de fresa y crema de vainilla',   3500,'porcion','🍓',3),
  ('MF-ZANAH',   'mesa_fria','mesa_fria','Ponqué de zanahoria con frutos secos',                                   3500,'porcion','🥕',4),
  ('MF-VAINI',   'mesa_fria','mesa_fria','Ponqué de vainilla con arequipe o nutella y crema de mantequilla',       3000,'porcion','🍰',5),
  ('MF-CHOCO',   'mesa_fria','mesa_fria','Ponqué de chocolate con ganache de chocolate',                           3000,'porcion','🍫',6),
  ('MF-QUESI',   'mesa_fria','mesa_fria','Mini quesillo',                                                          3500,'porcion','🍮',7),
  ('MF-VASCA',   'mesa_fria','mesa_fria','Mini tarta vasca con salsa',                                             4500,'porcion','🫕',8)
on conflict (id) do update set precio = excluded.precio, nombre = excluded.nombre, activo = true;

-- ═══════════════════════════════════════════════════════════
-- SEED — EXTRAS
-- ═══════════════════════════════════════════════════════════
insert into extras (id, tipo, grupo, nombre, precio, orden) values
  ('AD-CHOKIS',  'cuchareable','adicion','Chokis',     2000,1),
  ('AD-QUIPI',   'cuchareable','adicion','Quipitos',   2000,2),
  ('AD-MM',      'cuchareable','adicion','M&M',        2000,3),
  ('AD-OREO',    'cuchareable','adicion','Oreo',       2000,4),
  ('AD-MCHIPS',  'cuchareable','adicion','Mini Chips', 2000,5),
  ('AD-PIAZZA',  'cuchareable','adicion','Piazza',     2000,6),
  ('AD-NUTELLA', 'cuchareable','adicion','Nutella',    2000,7),
  ('AD-AREQ',    'cuchareable','adicion','Arequipe',   2000,8),
  ('PR-KLIM',    'cuchareable','premium','Leche Klim ⭐',   3000,1),
  ('PR-MILO',    'cuchareable','premium','Milo ⭐',         3000,2),
  ('PR-KBUENO',  'cuchareable','premium','Kinder Bueno',   3000,3),
  ('PR-FERRERO', 'cuchareable','premium','Ferrero Rocher', 3000,4),
  ('TV-PIST',    'cuchareable','topping_vasca','Crema de Pistacho', 0,1),
  ('TV-NUT',     'cuchareable','topping_vasca','Nutella',           0,2),
  ('TV-AREQ',    'cuchareable','topping_vasca','Arequipe',          0,3),
  ('TV-KLIM',    'cuchareable','topping_vasca','Leche Klim',        0,4),
  ('TV-ROJOS',   'cuchareable','topping_vasca','Frutos Rojos',      0,5),
  ('TB-KLIM',    'cuchareable','topping_brownie','Leche Klim',      0,1),
  ('TB-MILO',    'cuchareable','topping_brownie','Milo',            0,2),
  ('TB-KINDER',  'cuchareable','topping_brownie','Kinder',          0,3),
  ('TB-PIRU',    'cuchareable','topping_brownie','Pirulín',         0,4),
  ('TB-CHOKIS',  'cuchareable','topping_brownie','Chokis',          0,5),
  ('TB-QUIPI',   'cuchareable','topping_brownie','Quipitos',        0,6),
  ('TB-MM',      'cuchareable','topping_brownie','M&M',             0,7),
  ('TB-OREO',    'cuchareable','topping_brownie','Oreo',            0,8),
  ('TB-JET',     'cuchareable','topping_brownie','Chocolatina Jet', 0,9),
  ('TB-MCHIPS',  'cuchareable','topping_brownie','Minichips',       0,10)
on conflict (id) do update set precio = excluded.precio, nombre = excluded.nombre, activo = true;

-- ═══════════════════════════════════════════════════════════
-- VISTAS PÚBLICAS — lo único que anon puede leer
-- ═══════════════════════════════════════════════════════════
create or replace view productos_publicos as
  select id, tipo, categoria, nombre, precio, unidad, emoji, detalle, slots, sabor, tamano, orden
  from productos where activo order by tipo, categoria, orden;

create or replace view extras_publicos as
  select id, tipo, grupo, nombre, precio, orden
  from extras where activo order by tipo, grupo, orden;

create or replace view reglas_publicas as
  select tipo, anticipacion_minutos, cupo_dia, minimo_unidades,
         requiere_comprobante, porcentaje_anticipo, hora_min, hora_max
  from reglas_servicio;

-- ═══════════════════════════════════════════════════════════
-- FUNCIÓN: cupo disponible (solo UX)
-- ═══════════════════════════════════════════════════════════
create or replace function cupo_disponible(p_fecha date, p_tipo tipo_servicio)
returns int language plpgsql security definer set search_path = public as $$
declare v_cupo int; v_usado int;
begin
  select cupo_dia into v_cupo from reglas_servicio where tipo = p_tipo;
  if v_cupo is null then return 999; end if;
  select count(*) into v_usado from pedidos
    where fecha_entrega = p_fecha and tipo = p_tipo and estado <> 'cancelado';
  return greatest(v_cupo - v_usado, 0);
end $$;

-- ═══════════════════════════════════════════════════════════
-- FUNCIÓN: crear pedido — ÚNICO camino de escritura para anon
-- Recalcula precio, valida cupo, anticipación, mínimos y comprobante.
-- ═══════════════════════════════════════════════════════════
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

  -- Validaciones de forma
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

  -- Hora normalizada a HH:MM
  v_hora := nullif(left(coalesce(p_hora,''), 5), '');
  if v_reglas.hora_min is not null and v_hora is not null then
    if v_hora < v_reglas.hora_min or v_hora > v_reglas.hora_max then
      raise exception 'HORA_FUERA_DE_RANGO';
    end if;
  end if;

  -- Anticipación mínima (hora Colombia)
  v_momento := (p_fecha::text || ' ' || coalesce(v_hora,'13:00'))::timestamp
               at time zone 'America/Bogota';
  if v_momento < now() + make_interval(mins => v_reglas.anticipacion_minutos) then
    raise exception 'ANTICIPACION_MINIMA';
  end if;

  -- Cupo del día
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

  -- Items: el precio se recalcula acá, SIEMPRE
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

    -- Los brownies/vascas exigen exactamente `slots` toppings
    if v_prod.slots > 0 and array_length(v_nombres, 1) is distinct from v_prod.slots then
      raise exception 'TOPPINGS_INCOMPLETOS: % requiere % topping(s)', v_prod.nombre, v_prod.slots;
    end if;

    insert into pedido_items (pedido_id, producto_id, nombre, cantidad, extras, precio_unit, subtotal)
    values (v_id, v_prod.id, v_prod.nombre, v_cant, to_jsonb(v_nombres), v_unit, v_unit * v_cant);

    v_total := v_total + (v_unit * v_cant);
  end loop;

  update pedidos
     set valor    = v_total,
         anticipo = round(v_total * v_reglas.porcentaje_anticipo / 100)
   where id = v_id;

  return v_id;
end $$;

-- ═══════════════════════════════════════════════════════════
-- RLS — anon no toca las tablas, solo la función y las vistas
-- ═══════════════════════════════════════════════════════════
alter table productos     enable row level security;
alter table extras        enable row level security;
alter table pedidos       enable row level security;
alter table pedido_items  enable row level security;
alter table reglas_servicio enable row level security;

do $$ begin
  create policy equipo_lee_productos on productos       for all to authenticated using (true) with check (true);
  create policy equipo_lee_extras    on extras          for all to authenticated using (true) with check (true);
  create policy equipo_lee_pedidos   on pedidos         for all to authenticated using (true) with check (true);
  create policy equipo_lee_items     on pedido_items    for all to authenticated using (true) with check (true);
  create policy equipo_lee_reglas    on reglas_servicio for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

revoke all on productos, extras, pedidos, pedido_items, reglas_servicio from anon;
grant  select on productos_publicos, extras_publicos, reglas_publicas to anon, authenticated;
grant  execute on function crear_pedido_publico(text,text,text,text,text,date,text,text,text,text,jsonb) to anon, authenticated;
grant  execute on function cupo_disponible(date, tipo_servicio) to anon, authenticated;

-- Las vistas heredan los permisos del dueño, no de RLS de la tabla base.
alter view productos_publicos set (security_invoker = off);
alter view extras_publicos    set (security_invoker = off);
alter view reglas_publicas    set (security_invoker = off);
