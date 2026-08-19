-- ============================================================
-- 个人金融系统 · Supabase 同步后端建表脚本
-- 在 Supabase 控制台 (SQL Editor) 中整段执行一次即可。
-- 作用：创建按用户隔离的账本表 + 行级安全(RLS)策略。
-- ============================================================

-- 1) 账本表：每个登录用户一行，data 存整本账本的 JSON
create table if not exists public.cfo_data (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  data       jsonb       not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2) 开启行级安全：默认任何请求都读不到数据，必须命中下面的策略
alter table public.cfo_data enable row level security;

-- 3) 策略：只有"已登录且 uid 等于该行 user_id"的请求才能增删改查自己的那一行
drop policy if exists "own row" on public.cfo_data;
create policy "own row" on public.cfo_data
  for all
  using     ( auth.uid() = user_id )
  with check ( auth.uid() = user_id );

-- 4) 触发器：每次更新自动刷新 updated_at（用于判断哪边更新更新）
create or replace function public.touch_cfo_updated() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cfo_updated on public.cfo_data;
create trigger trg_cfo_updated
  before update on public.cfo_data
  for each row execute function public.touch_cfo_updated();

-- 完成。执行后可在 Table Editor 看到 cfo_data 表（初始为空）。
