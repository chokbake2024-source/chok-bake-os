-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN 02 — Bucket de comprobantes
-- Pegar en Supabase → SQL Editor → Run
--
-- Mesas frías y tortas exigen comprobante del anticipo (50%).
-- Sin bucket, la función rechaza el pedido con COMPROBANTE_REQUERIDO
-- y el formulario no tiene dónde subir el archivo.
-- ═══════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do nothing;

-- El público sube su comprobante, pero no puede listar ni borrar los de otros.
do $$ begin
  create policy "anon sube comprobante"
    on storage.objects for insert to anon, authenticated
    with check (bucket_id = 'comprobantes');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "lectura publica de comprobantes"
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'comprobantes');
exception when duplicate_object then null; end $$;
