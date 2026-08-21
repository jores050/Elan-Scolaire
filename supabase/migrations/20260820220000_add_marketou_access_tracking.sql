alter table public.profiles
  add column if not exists signup_source text;

alter table public.license_keys
  add column if not exists provision_source text,
  add column if not exists provision_reference text;

create unique index if not exists idx_license_keys_marketou_user_unique
  on public.license_keys(provision_source, provision_reference)
  where provision_source = 'marketou' and provision_reference is not null;
