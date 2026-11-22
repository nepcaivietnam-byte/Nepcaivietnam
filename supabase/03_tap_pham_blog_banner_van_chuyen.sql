-- =====================================================================
-- NẾP CÀI - CẬP NHẬT 03
-- Bộ sưu tập (Tập phẩm) · Nhiều ảnh sản phẩm · Banner trang chủ · Blog (Về Nếp, Góc Nếp)
-- Đăng ký nhận tin · Trạng thái vận chuyển · Hàm cho trang Tổng quan
-- Chạy SAU 01 và 02. Chạy lại nhiều lần vẫn an toàn.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BỘ SƯU TẬP (TẬP PHẨM)
-- ---------------------------------------------------------------------
create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  tagline     text,                         -- câu ngắn: "Gợi cảm hứng từ lá sen và lá trầu Việt."
  description text,                         -- ý nghĩa bộ sưu tập (nhiều đoạn)
  quote       text,                         -- câu trích dẫn cuối trang chi tiết
  image_path  text not null,                -- ảnh đại diện (Storage hoặc assets/…)
  is_featured boolean not null default true, -- hiện ở "Tập phẩm nổi bật" trang chủ
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. SẢN PHẨM: thuộc bộ sưu tập, loại, nổi bật, nội dung các tab
-- ---------------------------------------------------------------------
alter table public.products
  add column if not exists collection_id uuid references public.collections(id) on delete set null,
  add column if not exists category      text not null default 'tram-cai',
  add column if not exists is_featured   boolean not null default false,
  add column if not exists tagline       text,   -- mô tả ngắn / ý nghĩa ngắn
  add column if not exists description   text,   -- tab Mô tả
  add column if not exists material      text,   -- tab Chất liệu & kích thước
  add column if not exists usage         text,   -- tab Hướng dẫn sử dụng
  add column if not exists care          text;   -- tab Bảo quản
do $$ begin
  alter table public.products add constraint products_category_chk check (category in ('tram-cai', 'vong-tram', 'cay-tram'));
exception when duplicate_object then null; end $$;
create index if not exists idx_products_collection on public.products(collection_id);

-- Ảnh phụ của sản phẩm (ảnh chính vẫn là products.image_path)
create table if not exists public.product_images (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products(id) on delete cascade,
  image_path  text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_product_images_product on public.product_images(product_id, sort_order);

-- ---------------------------------------------------------------------
-- 3. BANNER TRANG CHỦ (trình chiếu nhiều ảnh)
-- ---------------------------------------------------------------------
create table if not exists public.banners (
  id          bigint generated always as identity primary key,
  image_path  text not null,
  title       text,          -- chữ phụ (không bắt buộc)
  link        text,          -- bấm vào ảnh sẽ đi tới (không bắt buộc)
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. BÀI VIẾT: Về Nếp + Góc Nếp
-- ---------------------------------------------------------------------
create table if not exists public.posts (
  id           bigint generated always as identity primary key,
  section      text not null,                 -- 've-nep' | 'goc-nep'
  category     text,                          -- chủ đề Góc Nếp
  title        text not null,
  excerpt      text,                          -- tóm tắt ngắn
  content      text not null default '',      -- nội dung (xuống dòng = đoạn mới, ## = tiêu đề nhỏ)
  cover_path   text,
  is_published boolean not null default true,
  sort_order   integer not null default 0,    -- thứ tự các mục trên trang Về Nếp
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
do $$ begin
  alter table public.posts add constraint posts_section_chk check (section in ('ve-nep', 'goc-nep'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.posts add constraint posts_category_chk check (category is null or category in ('van-hoa', 'thu-cong', 'lam-dep', 'cam-hung'));
exception when duplicate_object then null; end $$;
create index if not exists idx_posts_section on public.posts(section, is_published, published_at desc);

drop trigger if exists trg_posts_updated on public.posts;
create trigger trg_posts_updated before update on public.posts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. ĐĂNG KÝ NHẬN TIN
-- ---------------------------------------------------------------------
create table if not exists public.subscribers (
  id         bigint generated always as identity primary key,
  email      text not null unique,
  created_at timestamptz not null default now()
);
do $$ begin
  alter table public.subscribers add constraint subscribers_email_chk
    check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 200);
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 6. ĐƠN HÀNG: trạng thái vận chuyển
--    pending   = Cần xử lý        confirmed = Đã xác nhận (Cần giao hàng)
--    shipping  = Đang giao hàng   delivered = Đã giao (TÍNH DOANH THU)
--    cancelled = Đã huỷ           returned  = Hoàn hàng
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists confirmed_at timestamptz,
  add column if not exists shipped_at   timestamptz;
alter table public.orders drop constraint if exists orders_status_check;
update public.orders set status = 'delivered' where status = 'completed';
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'returned'));

create or replace function public.admin_set_order_status(p_order_id bigint, p_status text)
returns public.orders
language plpgsql security definer
set search_path = public
as $$
declare
  o  public.orders;
  r  record;
  was_active boolean;
  now_active boolean;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if p_status not in ('pending', 'confirmed', 'shipping', 'delivered', 'cancelled', 'returned') then
    raise exception 'Trạng thái không hợp lệ';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then raise exception 'Không tìm thấy đơn hàng'; end if;
  if o.status = p_status then return o; end if;

  was_active := o.status not in ('cancelled', 'returned');
  now_active := p_status not in ('cancelled', 'returned');

  if was_active and not now_active then
    -- Huỷ / Hoàn: trả hàng về kho
    for r in select product_id, sum(quantity) qty from public.purchases
             where order_id = p_order_id and product_id is not null group by product_id loop
      update public.products set stock = stock + r.qty where id = r.product_id;
    end loop;
  elsif not was_active and now_active then
    -- Mở lại đơn: trừ kho lại
    for r in select pu.product_id, sum(pu.quantity) qty, max(pr.stock) stock, max(pr.name) pname
             from public.purchases pu join public.products pr on pr.id = pu.product_id
             where pu.order_id = p_order_id group by pu.product_id loop
      if r.stock < r.qty then
        raise exception 'Không đủ hàng để mở lại đơn: "%" còn %', r.pname, r.stock;
      end if;
      update public.products set stock = stock - r.qty where id = r.product_id;
    end loop;
  end if;

  update public.orders
     set status       = p_status,
         confirmed_at = case when p_status in ('confirmed', 'shipping', 'delivered') then coalesce(confirmed_at, now()) else confirmed_at end,
         shipped_at   = case when p_status in ('shipping', 'delivered') then coalesce(shipped_at, now()) else shipped_at end,
         completed_at = case when p_status = 'delivered' then now() else null end,
         updated_at   = now()
   where id = p_order_id
  returning * into o;
  return o;
end;
$$;
revoke execute on function public.admin_set_order_status(bigint, text) from public, anon;
grant  execute on function public.admin_set_order_status(bigint, text) to authenticated;

-- Doanh thu chỉ tính đơn "Đã giao"
create or replace function public.admin_summary()
returns table (total_revenue numeric, total_orders bigint, total_items_sold bigint)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  return query
  select coalesce(sum(o.total_amount), 0), count(*),
         (select coalesce(sum(pu.quantity), 0) from public.purchases pu
            join public.orders o2 on o2.id = pu.order_id where o2.status = 'delivered')
  from public.orders o where o.status = 'delivered';
end;
$$;

create or replace function public.admin_monthly_revenue(
  p_year integer default extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::integer
)
returns table (month integer, revenue numeric, order_count bigint)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  return query
  select m::integer, coalesce(sum(o.total_amount), 0), count(o.id)
  from generate_series(1, 12) as m
  left join public.orders o
    on o.status = 'delivered'
   and extract(year  from coalesce(o.completed_at, o.created_at) at time zone 'Asia/Ho_Chi_Minh') = p_year
   and extract(month from coalesce(o.completed_at, o.created_at) at time zone 'Asia/Ho_Chi_Minh') = m
  group by m order by m;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. TỔNG QUAN (dashboard admin): số liệu 30 ngày so với 30 ngày trước + chuỗi theo ngày
-- ---------------------------------------------------------------------
create or replace function public.admin_dashboard(p_days integer default 7)
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  tz text := 'Asia/Ho_Chi_Minh';
  today date := (now() at time zone tz)::date;
  res jsonb;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  p_days := greatest(1, least(coalesce(p_days, 7), 90));
  select jsonb_build_object(
    'orders_30',      (select count(*) from orders where created_at >= now() - interval '30 days' and status not in ('cancelled','returned')),
    'orders_prev',    (select count(*) from orders where created_at >= now() - interval '60 days' and created_at < now() - interval '30 days' and status not in ('cancelled','returned')),
    'revenue_30',     (select coalesce(sum(total_amount),0) from orders where status = 'delivered' and completed_at >= now() - interval '30 days'),
    'revenue_prev',   (select coalesce(sum(total_amount),0) from orders where status = 'delivered' and completed_at >= now() - interval '60 days' and completed_at < now() - interval '30 days'),
    'shipping_now',   (select count(*) from orders where status = 'shipping'),
    'to_ship_now',    (select count(*) from orders where status = 'confirmed'),
    'pending_now',    (select count(*) from orders where status = 'pending'),
    'customers_30',   (select count(*) from customers where role = 'customer' and created_at >= now() - interval '30 days'),
    'customers_prev', (select count(*) from customers where role = 'customer' and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'series', (
      select jsonb_agg(jsonb_build_object(
               'day', d::date,
               'revenue', coalesce((select sum(total_amount) from orders where status = 'delivered' and (completed_at at time zone tz)::date = d::date), 0),
               'orders',  (select count(*) from orders where (created_at at time zone tz)::date = d::date and status not in ('cancelled','returned')),
               'customers', (select count(*) from customers where role = 'customer' and (created_at at time zone tz)::date = d::date)
             ) order by d)
      from generate_series(today - (p_days - 1), today, interval '1 day') d
    ),
    'stock', jsonb_build_object(
      'in',  (select count(*) from products where stock > 3),
      'low', (select count(*) from products where stock between 1 and 3),
      'out', (select count(*) from products where stock <= 0),
      'units', (select coalesce(sum(stock),0) from products)
    )
  ) into res;
  return res;
end;
$$;
revoke execute on function public.admin_dashboard(integer) from public, anon;
grant  execute on function public.admin_dashboard(integer) to authenticated;

-- ---------------------------------------------------------------------
-- 8. BÁN CHẠY (ai cũng xem được, chỉ trả mã SP + số lượng đã bán)
-- ---------------------------------------------------------------------
create or replace function public.best_sellers(p_limit integer default 8)
returns table (product_id uuid, sold bigint)
language sql stable security definer
set search_path = public
as $$
  select pu.product_id, sum(pu.quantity)::bigint
  from public.purchases pu join public.orders o on o.id = pu.order_id
  where o.status not in ('cancelled', 'returned') and pu.product_id is not null
  group by pu.product_id
  order by 2 desc
  limit greatest(1, least(coalesce(p_limit, 8), 50));
$$;
grant execute on function public.best_sellers(integer) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9. PHÂN QUYỀN (RLS)
-- ---------------------------------------------------------------------
alter table public.collections    enable row level security;
alter table public.product_images enable row level security;
alter table public.banners        enable row level security;
alter table public.posts          enable row level security;
alter table public.subscribers    enable row level security;

-- Ai cũng xem được bộ sưu tập, ảnh SP, banner đang bật, bài đã đăng; admin xem tất cả
drop policy if exists "collections_read" on public.collections;
create policy "collections_read" on public.collections for select to anon, authenticated using (true);
drop policy if exists "product_images_read" on public.product_images;
create policy "product_images_read" on public.product_images for select to anon, authenticated using (true);
drop policy if exists "banners_read" on public.banners;
create policy "banners_read" on public.banners for select to anon, authenticated using (is_active or public.is_admin());
drop policy if exists "posts_read" on public.posts;
create policy "posts_read" on public.posts for select to anon, authenticated using (is_published or public.is_admin());

-- Chỉ admin thêm / sửa / xoá
do $$
declare t text;
begin
  foreach t in array array['collections', 'product_images', 'banners', 'posts'] loop
    execute format('drop policy if exists "%1$s_admin_insert" on public.%1$s', t);
    execute format('create policy "%1$s_admin_insert" on public.%1$s for insert to authenticated with check (public.is_admin())', t);
    execute format('drop policy if exists "%1$s_admin_update" on public.%1$s', t);
    execute format('create policy "%1$s_admin_update" on public.%1$s for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('drop policy if exists "%1$s_admin_delete" on public.%1$s', t);
    execute format('create policy "%1$s_admin_delete" on public.%1$s for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- Đăng ký nhận tin: ai cũng gửi được email, chỉ admin xem / xoá
drop policy if exists "subscribers_insert" on public.subscribers;
create policy "subscribers_insert" on public.subscribers for insert to anon, authenticated with check (true);
drop policy if exists "subscribers_admin_read" on public.subscribers;
create policy "subscribers_admin_read" on public.subscribers for select to authenticated using (public.is_admin());
drop policy if exists "subscribers_admin_delete" on public.subscribers;
create policy "subscribers_admin_delete" on public.subscribers for delete to authenticated using (public.is_admin());

grant select on public.collections, public.product_images, public.banners, public.posts to anon, authenticated;
grant insert on public.subscribers to anon, authenticated;
grant insert, update, delete on public.collections, public.product_images, public.banners, public.posts to authenticated;
grant select, delete on public.subscribers to authenticated;
