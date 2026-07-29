-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 04a — Los dos secretos de n8n
--
-- CORRER ESTE PRIMERO, y solo este.
-- Reemplazá los dos valores de abajo y dale Run. Nada más.
-- ═══════════════════════════════════════════════════════════

create extension if not exists supabase_vault;

do $$
declare
  -- 👇 1) La Production URL del nodo Webhook de n8n.
  --       Tiene que decir /webhook/ en el medio, NO /webhook-test/
  v_url    text := 'https://TU-INSTANCIA.app.n8n.cloud/webhook/chok-pedidos';

  -- 👇 2) El Value del credential "Header Auth" que creaste en n8n.
  --       Carácter por carácter, sin espacios de sobra.
  v_secret text := 'TU-LLAVE-AQUI';

  v_id uuid;
begin
  if position('/webhook-test/' in v_url) > 0 then
    raise exception 'Esa es la Test URL. Usá la Production URL (dice /webhook/, no /webhook-test/)';
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
