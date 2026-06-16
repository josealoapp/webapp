create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists user_profiles (
  id text primary key,
  display_name text,
  email text,
  avatar_url text,
  support_status text not null default 'active',
  is_verified boolean not null default false,
  profile jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at timestamptz not null default now()
);

create table if not exists auth_users (
  id text primary key default gen_random_uuid()::text,
  email text unique,
  display_name text not null default '',
  photo_url text not null default '',
  email_verified boolean not null default false,
  disabled boolean not null default false,
  provider text not null default 'password',
  provider_id text,
  password_hash text,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create index if not exists auth_users_email_idx on auth_users (lower(email));
alter table auth_users add column if not exists provider_id text;
create index if not exists auth_users_provider_idx on auth_users (provider, provider_id);

create table if not exists auth_sessions (
  token_hash text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  created_at_ms bigint not null,
  expires_at_ms bigint not null
);

create index if not exists auth_sessions_user_idx on auth_sessions (user_id);
create index if not exists auth_sessions_expires_idx on auth_sessions (expires_at_ms);

create table if not exists auth_action_tokens (
  token_hash text primary key,
  user_id text not null references auth_users(id) on delete cascade,
  type text not null,
  created_at_ms bigint not null,
  expires_at_ms bigint not null,
  used_at_ms bigint
);

create index if not exists auth_action_tokens_user_type_idx on auth_action_tokens (user_id, type);

create table if not exists user_private_profiles (
  user_id text primary key references user_profiles(id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at timestamptz not null default now()
);

create table if not exists listings (
  id text primary key default gen_random_uuid()::text,
  owner_id text not null,
  owner_name text not null,
  owner_avatar text,
  seller_whatsapp_number text,
  seller_uses_whatsapp boolean not null default false,
  type text not null default 'article',
  title text not null,
  price numeric(12, 2) not null,
  currency text not null default 'DOP',
  category text not null,
  bazar_category text,
  description text not null,
  tags jsonb not null default '[]'::jsonb,
  payment_method text not null default 'efectivo',
  location text not null,
  image text not null,
  images jsonb not null default '[]'::jsonb,
  vehicle_year integer,
  clothing_size text,
  shoe_size text,
  bazar_items jsonb not null default '[]'::jsonb,
  bazar_duration_hours integer,
  bazar_ends_at_ms bigint,
  status text not null default 'active',
  reserved_for_user_id text,
  reserved_for_user_name text,
  reserved_at_ms bigint,
  sold_at_ms bigint,
  sold_with_josealo boolean,
  sale_speed_rating integer,
  sold_to_user_id text,
  sold_to_user_name text,
  views integer not null default 0,
  view_count integer not null default 0,
  impressions integer not null default 0,
  last_viewed_at_ms bigint,
  search_tokens text[] not null default '{}',
  search_document text not null default '',
  created_at_ms bigint not null,
  updated_at_ms bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists listings_status_created_idx on listings (status, created_at_ms desc, id desc);
create index if not exists listings_owner_status_created_idx on listings (owner_id, status, created_at_ms desc, id desc);
create index if not exists listings_category_idx on listings (category);
create index if not exists listings_location_idx on listings (location);
create index if not exists listings_type_idx on listings (type);
create index if not exists listings_search_tokens_idx on listings using gin (search_tokens);
create index if not exists listings_search_document_trgm_idx on listings using gin (search_document gin_trgm_ops);

alter table listings add column if not exists views integer not null default 0;
alter table listings add column if not exists view_count integer not null default 0;
alter table listings add column if not exists impressions integer not null default 0;
alter table listings add column if not exists last_viewed_at_ms bigint;

create table if not exists chats (
  id text primary key,
  listing_id text not null,
  buyer_id text not null,
  seller_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null,
  updated_at_ms bigint not null
);

create index if not exists chats_buyer_updated_idx on chats (buyer_id, updated_at_ms desc);
create index if not exists chats_seller_updated_idx on chats (seller_id, updated_at_ms desc);
create index if not exists chats_listing_idx on chats (listing_id);

create table if not exists messages (
  id text primary key default gen_random_uuid()::text,
  chat_id text not null references chats(id) on delete cascade,
  sender_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null
);

create index if not exists messages_chat_created_idx on messages (chat_id, created_at_ms desc);
create index if not exists messages_sender_idx on messages (sender_id);

create table if not exists listing_sold_events (
  id text primary key default gen_random_uuid()::text,
  listing_id text not null,
  owner_id text not null,
  type text not null default 'listing',
  data jsonb not null default '{}'::jsonb,
  sold_at_ms bigint not null
);

create index if not exists listing_sold_events_owner_idx on listing_sold_events (owner_id, sold_at_ms desc);
create index if not exists listing_sold_events_listing_idx on listing_sold_events (listing_id);

create table if not exists purchase_review_requests (
  id text primary key,
  listing_id text not null,
  seller_id text not null,
  buyer_id text not null,
  status text not null default 'pending',
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null,
  updated_at_ms bigint
);

create index if not exists purchase_review_requests_buyer_status_idx on purchase_review_requests (buyer_id, status, created_at_ms desc);
create index if not exists purchase_review_requests_seller_idx on purchase_review_requests (seller_id, created_at_ms desc);

create table if not exists user_ratings (
  id text primary key,
  seller_id text not null,
  buyer_id text not null,
  listing_id text,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null
);

create index if not exists user_ratings_seller_created_idx on user_ratings (seller_id, created_at_ms desc);
create index if not exists user_ratings_buyer_idx on user_ratings (buyer_id);

create table if not exists reports (
  id text primary key default gen_random_uuid()::text,
  report_type text not null default 'item',
  listing_id text,
  seller_id text,
  target_user_id text,
  reporter_id text not null,
  status text not null default 'open',
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null,
  handled_at_ms bigint
);

create index if not exists reports_created_idx on reports (created_at_ms desc);
create index if not exists reports_seller_idx on reports (seller_id);
create index if not exists reports_target_user_idx on reports (target_user_id);
create index if not exists reports_reporter_idx on reports (reporter_id);

create table if not exists support_notifications (
  id text primary key default gen_random_uuid()::text,
  user_id text not null,
  type text not null,
  title text not null,
  message text not null,
  reason text not null default '',
  listing_id text,
  read boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null,
  read_at_ms bigint
);

create index if not exists support_notifications_user_created_idx on support_notifications (user_id, created_at_ms desc);

create table if not exists marketplace_ads (
  id text primary key default gen_random_uuid()::text,
  campaign_name text not null,
  image_url text not null,
  link_url text not null,
  start_date text not null,
  end_date text not null,
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null
);

create index if not exists marketplace_ads_created_idx on marketplace_ads (created_at_ms desc);
create index if not exists marketplace_ads_date_range_idx on marketplace_ads (start_date, end_date);

create table if not exists search_events (
  id text primary key default gen_random_uuid()::text,
  query text not null default '',
  normalized_query text not null default '',
  category text not null default '',
  location text not null default '',
  user_id text not null default '',
  source text not null default 'search',
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null
);

create index if not exists search_events_created_idx on search_events (created_at_ms desc);
create index if not exists search_events_query_idx on search_events (normalized_query);
create index if not exists search_events_category_idx on search_events (category);

create table if not exists listing_view_events (
  id text primary key default gen_random_uuid()::text,
  listing_id text not null,
  bazar_item_id text,
  owner_id text not null default '',
  viewer_id text not null default '',
  is_owner_view boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  viewed_at_ms bigint not null
);

create index if not exists listing_view_events_listing_idx on listing_view_events (listing_id, viewed_at_ms desc);
create index if not exists listing_view_events_owner_idx on listing_view_events (owner_id, viewed_at_ms desc);
create index if not exists listing_view_events_viewer_idx on listing_view_events (viewer_id);

create table if not exists user_presence (
  user_id text primary key,
  last_active_at_ms bigint not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists likes (
  id text primary key,
  actor_id text not null,
  owner_id text not null,
  listing_id text not null,
  bazar_item_id text,
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null
);

create table if not exists follows (
  id text primary key,
  follower_id text not null,
  followee_id text not null,
  data jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null
);
