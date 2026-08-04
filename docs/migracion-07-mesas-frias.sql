-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 07 — Cinco productos más para mesas frías
-- Pegar en Supabase → SQL Editor → Run
--
-- Los mini shots se modelan como UN producto con sabores a elegir, no
-- como seis productos distintos. Si fueran seis, el mínimo de 16 por
-- producto obligaría a pedir 96 shots — absurdo para una mesa de postres.
-- Así, el mínimo son 16 shots en total y la clienta marca qué sabores.
-- ═══════════════════════════════════════════════════════════

-- ─── Un producto puede ofrecer un grupo de extras ───────────
-- Sin esto habría que hardcodear "los sabores son de los mini shots" en
-- el formulario. Con la columna, el dato manda: sirve igual el día que
-- las tortas tengan sus propios rellenos.
alter table productos
  add column if not exists grupo_extras text;

comment on column productos.grupo_extras is
  'Grupo de la tabla extras que este producto ofrece como opciones. Null = ninguno.';

-- ─── Los cinco productos ────────────────────────────────────
insert into productos (id, tipo, categoria, nombre, precio, unidad, orden, grupo_extras) values
  ('MF-MBROWNIE', 'mesa_fria','mesa_fria','Mini brownies con topping',        2500,'porcion', 9, null),
  ('MF-ALFAJOR',  'mesa_fria','mesa_fria','Alfajores pequeños',               2500,'porcion',10, null),
  ('MF-ALFAIMG',  'mesa_fria','mesa_fria','Alfajores con imagen o inicial',   3000,'porcion',11, null),
  ('MF-CUPCREMA', 'mesa_fria','mesa_fria','Cupcakes con crema',               3000,'porcion',12, null),
  ('MF-SHOTS',    'mesa_fria','mesa_fria','Mini shots',                       3500,'porcion',13,'sabor_shot')
on conflict (id) do update set
  precio       = excluded.precio,
  nombre       = excluded.nombre,
  orden        = excluded.orden,
  grupo_extras = excluded.grupo_extras,
  activo       = true;

-- ─── Los seis sabores de los mini shots ─────────────────────
-- Precio 0: el sabor no cambia el valor, solo hay que saber cuál quiere.
insert into extras (id, tipo, grupo, nombre, precio, orden) values
  ('SH-LIMON',  'mesa_fria','sabor_shot','Limón',        0,1),
  ('SH-OREO',   'mesa_fria','sabor_shot','Oreo',         0,2),
  ('SH-MARACU', 'mesa_fria','sabor_shot','Maracuyá',     0,3),
  ('SH-KLIM',   'mesa_fria','sabor_shot','Leche Klim',   0,4),
  ('SH-KINDER', 'mesa_fria','sabor_shot','Kinder',       0,5),
  ('SH-ROJOS',  'mesa_fria','sabor_shot','Frutos rojos', 0,6)
on conflict (id) do update set
  nombre = excluded.nombre,
  precio = excluded.precio,
  activo = true;

-- ─── La vista pública tiene que exponer la columna nueva ────
-- DROP + CREATE y no CREATE OR REPLACE: reemplazar una vista solo admite
-- columnas al final y es fácil pisarse. Ya nos costó una vuelta en la 01.
drop view if exists productos_publicos;

create view productos_publicos as
  select id, tipo, categoria, nombre, precio, unidad, emoji, detalle,
         slots, sabor, tamano, grupo_extras, orden
  from productos where activo order by tipo, categoria, orden;

alter view productos_publicos set (security_invoker = off);
grant select on productos_publicos to anon, authenticated;

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════
-- Deben salir 13 productos de mesa fría, y solo Mini shots con grupo:
--   select nombre, precio, grupo_extras from productos_publicos
--    where tipo = 'mesa_fria' order by orden;
--
-- Y los seis sabores:
--   select nombre from extras_publicos where grupo = 'sabor_shot' order by orden;
