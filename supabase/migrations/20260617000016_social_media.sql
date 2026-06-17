-- Social Media Module
create type social_platform as enum ('instagram', 'facebook', 'linkedin', 'tiktok', 'x');
create type social_post_status as enum ('draft', 'approved', 'posted', 'archived', 'rejected');

create table social_posts (
  id                uuid          primary key default gen_random_uuid(),
  demand_id         uuid          not null references demands(id) on delete cascade,
  platform          social_platform not null,
  status            social_post_status not null default 'draft',
  caption           text,
  hashtags          text[]        not null default '{}',
  image_path        text,
  tracking_code     text          not null unique default substr(md5(gen_random_uuid()::text), 1, 8),
  tracking_url      text,
  created_by        uuid          references profiles(id),
  approved_by       uuid          references profiles(id),
  approved_at       timestamptz,
  posted_at         timestamptz,
  external_post_url text,
  created_at        timestamptz   not null default now(),
  updated_at        timestamptz   not null default now()
);

create index on social_posts (demand_id);
create index on social_posts (status);

alter table social_posts enable row level security;

-- admin and recruiter: full CRUD
create policy "social_posts_admin_recruiter"
  on social_posts for all to authenticated
  using  (get_my_role() in ('admin', 'recruiter'))
  with check (get_my_role() in ('admin', 'recruiter'));

-- hiring_manager: own demands only
create policy "social_posts_hiring_manager"
  on social_posts for all to authenticated
  using  (get_my_role() = 'hiring_manager' and demand_id = any(get_my_demand_ids()))
  with check (get_my_role() = 'hiring_manager' and demand_id = any(get_my_demand_ids()));
