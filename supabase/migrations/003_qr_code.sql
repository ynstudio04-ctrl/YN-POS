-- QR payment code stored in settings
alter table settings add column if not exists qr_code_url text;

-- Ensure the existing public image bucket is present.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Allow the browser to upload/read only files under the qr/ prefix.
drop policy if exists "qr upload public" on storage.objects;
create policy "qr upload public" on storage.objects for insert to anon, authenticated
with check (bucket_id = 'product-images' and name like 'qr/%');
drop policy if exists "qr read public" on storage.objects;
create policy "qr read public" on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images' and name like 'qr/%');
