-- ============================================================
-- 金熊站 Supabase 初始化脚本
-- 用法：Supabase 控制台 → SQL Editor → 粘贴全文 → Run
-- 可重复执行，不会删除已有数据。
-- ============================================================

-- ---------- 用户 ----------
create table if not exists public.users (
  id          text primary key,
  nickname    text not null unique,
  password    text not null,
  avatar      text default '',
  bio         text default '',
  created_at  timestamptz not null default now()
);

-- ---------- 帖子 ----------
create table if not exists public.posts (
  id          text primary key,
  user_id     text not null references public.users(id) on delete cascade,
  category    text not null default 'life',
  title       text not null,
  content     text not null,
  images      jsonb not null default '[]'::jsonb,
  files       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_id_idx on public.posts (user_id);
create index if not exists posts_category_idx on public.posts (category);

-- ---------- 点赞 ----------
create table if not exists public.likes (
  id          text primary key,
  user_id     text not null references public.users(id) on delete cascade,
  post_id     text not null references public.posts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, post_id)
);
create index if not exists likes_post_id_idx on public.likes (post_id);
create index if not exists likes_user_id_idx on public.likes (user_id);

-- ---------- 评论 ----------
create table if not exists public.comments (
  id          text primary key,
  post_id     text not null references public.posts(id) on delete cascade,
  user_id     text not null references public.users(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_post_id_idx on public.comments (post_id);

-- ---------- 私信 ----------
create table if not exists public.messages (
  id            text primary key,
  from_user_id  text not null references public.users(id) on delete cascade,
  to_user_id    text not null references public.users(id) on delete cascade,
  content       text not null,
  is_read       boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists messages_from_idx on public.messages (from_user_id);
create index if not exists messages_to_idx on public.messages (to_user_id);

-- ---------- 登录会话 ----------
create table if not exists public.sessions (
  token       text primary key,
  user_id     text not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists sessions_user_id_idx on public.sessions (user_id);

-- ---------- 开启 RLS ----------
-- 不加任何策略：匿名 key 完全无法读写，只有服务器端（service_role）能访问。
alter table public.users     enable row level security;
alter table public.posts     enable row level security;
alter table public.likes     enable row level security;
alter table public.comments  enable row level security;
alter table public.messages  enable row level security;
alter table public.sessions  enable row level security;

-- ---------- 文件桶 ----------
-- public = true：图片/附件可以通过公开 URL 直接访问（头像、帖子配图需要）。
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', true, 52428800)
on conflict (id) do update set public = true;

-- 允许匿名读者通过 public URL 读取对象（写入仍然只允许 service_role）
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'public read uploads'
  ) then
    create policy "public read uploads" on storage.objects
      for select using (bucket_id = 'uploads');
  end if;
end $$;

-- ---------- 完成 ----------
select '金熊站数据库初始化完成 ✅' as result;
