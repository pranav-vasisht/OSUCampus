-- Run this in the Supabase SQL Editor (or via CLI migrations) after creating the project.
-- Creates private bucket `sources`, table `user_documents`, RLS, and storage policies.

-- Table: one row per source (text, uploaded file, or YouTube link)
create table if not exists public.user_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  source_type text not null check (source_type in ('text', 'file', 'youtube')),
  text_content text,
  youtube_url text,
  storage_path text,
  mime_type text,
  created_at timestamptz not null default now()
);

create index if not exists user_documents_user_id_created_at_idx
  on public.user_documents (user_id, created_at);

alter table public.user_documents enable row level security;

create policy "user_documents_select_own"
  on public.user_documents for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_documents_insert_own"
  on public.user_documents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_documents_update_own"
  on public.user_documents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_documents_delete_own"
  on public.user_documents for delete
  to authenticated
  using (auth.uid() = user_id);

-- Storage: private bucket; object paths must start with the owner's user id
insert into storage.buckets (id, name, public)
values ('sources', 'sources', false)
on conflict (id) do nothing;

create policy "sources_insert_own_prefix"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sources'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "sources_select_own_prefix"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "sources_update_own_prefix"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername (name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'sources'
    and (storage.foldername (name))[1] = auth.uid()::text
  );

create policy "sources_delete_own_prefix"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'sources'
    and (storage.foldername (name))[1] = auth.uid()::text
  );
