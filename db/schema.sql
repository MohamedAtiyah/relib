-- Every row belongs to one Clerk user. Keys are (owner_id, id) so ids made in one browser never collide with another user's.
-- Times are epoch milliseconds, the form the client already uses.

create table if not exists users (
  id text primary key,
  email text,
  created_at double precision not null
);

create table if not exists folders (
  owner_id text not null,
  id text not null,
  name text not null,
  kind text not null default 'study',
  agent_role text not null default '',
  last_opened_at double precision,
  created_at double precision not null,
  updated_at double precision not null,
  primary key (owner_id, id)
);

create table if not exists pages (
  owner_id text not null,
  id text not null,
  folder_id text not null,
  title text not null default '',
  editor_state text not null default '',
  plain_text text not null default '',
  analysed_text text,
  created_at double precision not null,
  updated_at double precision not null,
  primary key (owner_id, id)
);

create table if not exists presets (
  owner_id text not null,
  id text not null,
  name text not null,
  fields jsonb not null default '[]',
  citation_style text not null default 'APA 7',
  sections jsonb not null default '[]',
  updated_at double precision not null,
  primary key (owner_id, id)
);

create table if not exists sources (
  owner_id text not null,
  id text not null,
  origin text not null,
  title text not null,
  authors jsonb not null default '[]',
  year integer,
  url text not null,
  doi text,
  abstract text not null default '',
  full_text text, -- only for the user's own uploaded files
  updated_at double precision not null,
  primary key (owner_id, id)
);

create table if not exists suggestions (
  owner_id text not null,
  id text not null,
  folder_id text not null,
  page_id text not null,
  source_id text not null,
  fit_gap jsonb not null,
  basis text not null,
  status text not null,
  created_at double precision not null,
  updated_at double precision not null,
  primary key (owner_id, id)
);

create table if not exists files (
  owner_id text not null,
  id text not null,
  folder_id text not null,
  storage_key text not null,
  filename text not null,
  mime text not null,
  size integer not null,
  created_at double precision not null,
  primary key (owner_id, id)
);

create table if not exists cache (
  key text primary key,
  value jsonb not null,
  created_at double precision not null
);

create index if not exists pages_folder on pages (owner_id, folder_id);
create index if not exists suggestions_folder on suggestions (owner_id, folder_id);

create table if not exists usage (
  key text not null,
  day text not null,
  count integer not null default 0,
  primary key (key, day)
);

-- academic rebuild: pages have a type; folders no longer have kinds or roles
alter table pages add column if not exists type text not null default 'notes';
alter table pages add column if not exists last_opened_at double precision;
alter table folders drop column if exists kind;
alter table folders drop column if exists agent_role;
