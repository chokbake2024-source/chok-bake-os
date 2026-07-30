-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 04a — Los dos secretos de n8n
--
-- CORRER ESTE PRIMERO, y solo este.
-- Reemplazá los dos valores de abajo y dale Run. Nada más.
-- ═══════════════════════════════════════════════════════════

create extension if not exists supabase_vault;

-- ⚠️ LAS COMILLAS SIMPLES SON PARTE DE LA SINTAXIS. No las borres.
--    Bien:  v_url text := 'https://algo.app.n8n.cloud/webhook/chok-pedidos';
--    Mal:   v_url text := https://algo.app.n8n.cloud/webhook/chok-pedidos;
--    Reemplazá solo lo que está ENTRE las comillas.

do $$
declare
  -- 👇 1) La Production URL del nodo Webhook de n8n.
  --       Tiene que decir /webhook/ en el medio, NO /webhook-test/
  v_url    text := 'https://TU-INSTANCIA.app.n8n.cloud/webhook/chok-pedidos';

  -- 👇 2) El Value del credential "Header Auth" que creaste en n8n.
  --       Solo letras y números. Ver la validación de abajo.
  v_secret text := 'TU-LLAVE-AQUI';

  v_id uuid;
begin
  if v_url !~ '^https://' then
    raise exception 'La URL debe empezar con https:// — ¿te quedó sin comillas?';
  end if;

  if position('/webhook-test/' in v_url) > 0 then
    raise exception 'Esa es la Test URL. Usá la Production URL (dice /webhook/, no /webhook-test/)';
  end if;

  if v_secret = 'TU-LLAVE-AQUI' or length(v_secret) < 16 then
    raise exception 'La llave está vacía o es muy corta. Usá al menos 32 caracteres.';
  end if;

  -- Los headers HTTP solo aceptan ASCII imprimible. Una llave con £, ñ, °
  -- o similares rompe el header y da 403 sin explicar por qué: es
  -- exactamente lo que pasó en Bianco.
  if v_secret ~ '[^A-Za-z0-9]' then
    raise exception 'La llave tiene caracteres que no son letras ni números. Generá otra solo con A-Z, a-z y 0-9.';
  end if;

  select id into v_id from vault.secrets where name = 'n8n_chok_url';
  if v_id is null then
    perform vault.create_secret(v_url, 'n8n_chok_url', 'Webhook de n8n');
  else
    perform vault.update_secret(v_id, v_url);
  end if;

  select id into v_id from vault.secrets where name = 'n8n_chok_secret';
  if v_id is null then
    perform vault.create_secret(v_secret, 'n8n_chok_secret', 'Header Auth de n8n');
  else
    perform vault.update_secret(v_id, v_secret);
  end if;

  raise notice 'Secretos guardados.';
end $$;

-- ─── Comprobalo con el ojo ──────────────────────────────────
-- Deben salir las dos filas. La URL se ve; la llave queda tapada.
select name,
       case when name = 'n8n_chok_url' then decrypted_secret
            else '••••••• (' || length(decrypted_secret) || ' caracteres)' end as valor
  from vault.decrypted_secrets
 where name in ('n8n_chok_url', 'n8n_chok_secret');
