-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 06a — La URL del webhook del resumen diario
--
-- CORRER ESTE ANTES de migracion-06-disponibilidad.sql
--
-- ⚠️ LAS COMILLAS SIMPLES SON PARTE DE LA SINTAXIS. No las borres.
--    Reemplazá solo lo que está ENTRE las comillas.
--
-- Es un workflow DISTINTO al de los pedidos: otro path, otra URL.
-- La llave (chok-auth) es la misma de siempre, no hay que volver a ponerla.
-- ═══════════════════════════════════════════════════════════

do $$
declare
  -- 👇 Production URL del webhook del workflow "Resumen diario"
  v_url text := 'https://TU-INSTANCIA.app.n8n.cloud/webhook/chok-resumen';
  v_id  uuid;
begin
  if v_url !~ '^https://' then
    raise exception 'La URL debe empezar con https:// — ¿te quedó sin comillas?';
  end if;
  if position('/webhook-test/' in v_url) > 0 then
    raise exception 'Esa es la Test URL. Usá la Production URL.';
  end if;
  if position('TU-INSTANCIA' in v_url) > 0 then
    raise exception 'Reemplazá TU-INSTANCIA por tu instancia real de n8n.';
  end if;

  select id into v_id from vault.secrets where name = 'n8n_chok_url_resumen';
  if v_id is null then
    perform vault.create_secret(v_url, 'n8n_chok_url_resumen',
      'Webhook de n8n del resumen diario');
  else
    perform vault.update_secret(v_id, v_url);
  end if;

  raise notice 'URL del resumen guardada.';
end $$;

select name, decrypted_secret as valor
  from vault.decrypted_secrets
 where name = 'n8n_chok_url_resumen';
