insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

drop policy if exists "product images public read" on storage.objects;
drop policy if exists "product images public upload" on storage.objects;
drop policy if exists "product images public update" on storage.objects;
drop policy if exists "product images public delete" on storage.objects;

create policy "product images public read"
on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');

create policy "product images public upload"
on storage.objects for insert to anon, authenticated
with check (bucket_id = 'product-images');

create policy "product images public update"
on storage.objects for update to anon, authenticated
using (bucket_id = 'product-images')
with check (bucket_id = 'product-images');

create policy "product images public delete"
on storage.objects for delete to anon, authenticated
using (bucket_id = 'product-images');
