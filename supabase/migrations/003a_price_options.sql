alter table products add column if not exists price_options jsonb not null default '[]'::jsonb;
