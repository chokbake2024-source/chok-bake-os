-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 03 — Permisos del equipo (panel)
-- Pegar en Supabase → SQL Editor → Run
--
-- Las policies de RLS para `authenticated` ya existen desde schema.sql,
-- pero RLS y GRANT son dos capas distintas: una policy permisiva no
-- sirve de nada si el rol no tiene el GRANT de tabla. Supabase los da
-- por defecto, pero dejarlo explícito evita la sesión de depuración de
-- "el panel dice permission denied y las policies están bien".
-- ═══════════════════════════════════════════════════════════

grant select, insert, update, delete
  on productos, extras, pedidos, pedido_items, reglas_servicio
  to authenticated;

grant usage, select on sequence pedidos_seq to authenticated;

-- El panel lee pedidos con sus líneas en una sola consulta anidada.
-- Sin este índice, cada carga hace un scan de pedido_items.
create index if not exists pedido_items_producto_idx on pedido_items (producto_id);

-- ─── Verificación: correr esto después y revisar con el ojo ───
-- Debe listar 5 tablas con rls = true y al menos una policy cada una.
--
--   select c.relname                as tabla,
--          c.relrowsecurity         as rls,
--          count(p.policyname)      as policies
--     from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--     left join pg_policies p on p.tablename = c.relname
--    where n.nspname = 'public'
--      and c.relname in ('productos','extras','pedidos','pedido_items','reglas_servicio')
--    group by 1, 2
--    order by 1;
