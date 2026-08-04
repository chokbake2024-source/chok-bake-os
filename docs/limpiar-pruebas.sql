-- ═══════════════════════════════════════════════════════════
-- LIMPIAR PEDIDOS DE PRUEBA
--
-- ⚠️ NO corras este archivo entero de una. Es por pasos, y el paso 1
--    es mirar con el ojo lo que vas a borrar. Un delete a ciegas en la
--    tabla de pedidos no se deshace.
--
-- pedido_items tiene ON DELETE CASCADE, así que borrando el pedido se
-- van sus líneas solas. No hay que tocarlas aparte.
-- ═══════════════════════════════════════════════════════════

-- ─── PASO 1 · MIRAR ─────────────────────────────────────────
-- Corré SOLO esto primero. Revisá la lista con el ojo: que no se haya
-- colado ningún pedido real de una clienta que también se llame así.
select p.id, p.cliente, p.telefono, p.tipo, p.fecha_entrega,
       p.valor, p.estado, p.origen, p.created_at,
       (select count(*) from pedido_items i where i.pedido_id = p.id) as lineas
  from pedidos p
 where p.cliente ilike '%michael%'
 order by p.created_at;

-- ─── PASO 2 · CONTAR ANTES ──────────────────────────────────
select count(*) as pedidos_totales_antes from pedidos;

-- ─── PASO 3 · BORRAR ────────────────────────────────────────
-- Solo cuando el paso 1 te haya mostrado exactamente lo que querés que
-- desaparezca. Si en la lista aparece algo que NO querés borrar, no
-- corras esto: agregale condiciones (por ejemplo `and p.id in (...)`).
delete from pedidos
 where cliente ilike '%michael%';

-- ─── PASO 4 · CONFIRMAR ─────────────────────────────────────
-- Debe dar 0. Si no, quedó algo con otra escritura del nombre.
select count(*) as quedan_michael from pedidos where cliente ilike '%michael%';

-- Y el total, para comparar con el paso 2:
select count(*) as pedidos_totales_despues from pedidos;

-- ─── PASO 5 · RASTROS SUELTOS ───────────────────────────────
-- Las pruebas dejaron huellas fuera de la tabla de pedidos.

-- a) Avisos fallidos de las pruebas del calendario y del resumen:
select id, pedido_id, error, created_at
  from notificaciones_fallidas
 order by created_at desc;

-- Si son todos de prueba:
-- delete from notificaciones_fallidas;

-- b) Comprobantes de prueba subidos al Storage.
--    Esto NO se borra por SQL: andá a Supabase → Storage → comprobantes
--    y borrá a mano los archivos de las pruebas.

-- c) ⚠️ LOS EVENTOS DEL CALENDARIO NO SE BORRAN SOLOS.
--    Borrar el pedido de la base no toca Google Calendar: el aviso ya
--    salió y el evento quedó creado. Abrí el calendario "Pedidos Chok"
--    y borrá a mano los eventos de prueba, incluidos los duplicados que
--    dejaron los "Execute workflow" de n8n.
