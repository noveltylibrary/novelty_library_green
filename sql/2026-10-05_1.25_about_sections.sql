-- Novelty Library 1.25
-- Editable About page: every block of the About page is a row an admin can edit,
-- reorder, hide or delete from Admin > WebApp Pages Moderation > About.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.about_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  layout text not null default 'text',
  eyebrow text not null default '',
  title text not null,
  subtitle text not null default '',
  body text not null default '',
  items jsonb not null default '[]'::jsonb,
  button_label text not null default '',
  button_link text not null default '',
  sort_order integer not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint about_sections_layout_check check (layout in ('hero','pillars','grid','steps','faq','cta','text')),
  constraint about_sections_title_len check (char_length(title) between 1 and 200),
  constraint about_sections_body_len check (char_length(body) <= 6000),
  constraint about_sections_items_array check (jsonb_typeof(items) = 'array')
);

create index if not exists about_sections_order_idx on public.about_sections(sort_order);

create or replace function public.nl_is_admin()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  begin
    return coalesce(public.is_admin(), false);
  exception when undefined_function then
    return false;
  end;
end;
$$;

alter table public.about_sections enable row level security;

drop policy if exists "about_sections public read active" on public.about_sections;
create policy "about_sections public read active" on public.about_sections
  for select using (active = true or public.nl_is_admin());

drop policy if exists "about_sections admin insert" on public.about_sections;
create policy "about_sections admin insert" on public.about_sections
  for insert with check (public.nl_is_admin());

drop policy if exists "about_sections admin update" on public.about_sections;
create policy "about_sections admin update" on public.about_sections
  for update using (public.nl_is_admin()) with check (public.nl_is_admin());

drop policy if exists "about_sections admin delete" on public.about_sections;
create policy "about_sections admin delete" on public.about_sections
  for delete using (public.nl_is_admin());

grant select on public.about_sections to anon, authenticated;
grant insert, update, delete on public.about_sections to authenticated;
