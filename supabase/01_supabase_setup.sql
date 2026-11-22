-- =====================================================================
-- SHOP CHÂM CÀI TÓC - SETUP SUPABASE
-- Chạy toàn bộ file này trong: Supabase Dashboard > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. BẢNG
-- ---------------------------------------------------------------------

-- Bảng 1: Khách hàng
-- Đăng nhập (gmail + mật khẩu) do Supabase Auth quản lý (mật khẩu được băm sẵn).
-- Bảng này lưu thông tin hồ sơ, liên kết 1-1 với auth.users qua id.
create table if not exists public.customers (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  full_name  text not null default '',
  phone      text,
  address    text,
  role       text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);

-- Bảng 3: Kho hàng
create table if not exists public.products (
  id         uuid primary key default gen_random_uuid(),
  sku        text not null unique,                    -- mã sản phẩm
  name       text not null,                           -- tên sản phẩm
  image_path text,                                    -- đường dẫn ảnh trong Storage bucket 'product-images'
  price      numeric(12,0) not null check (price >= 0),  -- VND
  stock      integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Bảng 4: Đơn hàng đã bán
create table if not exists public.orders (
  id           bigint generated always as identity primary key,
  customer_id  uuid not null references public.customers(id),
  total_amount numeric(14,0) not null default 0 check (total_amount >= 0),
  status       text not null default 'completed' check (status in ('pending', 'completed', 'cancelled')),
  created_at   timestamptz not null default now()
);

-- Bảng 2: Sản phẩm khách đã mua (mã khách hàng + sản phẩm + giá)
-- Lưu snapshot tên và giá tại thời điểm mua, để sau này sửa/xóa sản phẩm không làm sai lịch sử.
create table if not exists public.purchases (
  id           bigint generated always as identity primary key,
  order_id     bigint not null references public.orders(id) on delete cascade,
  customer_id  uuid not null references public.customers(id),
  product_id   uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity     integer not null check (quantity > 0),
  unit_price   numeric(12,0) not null check (unit_price >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists idx_orders_created_at   on public.orders(created_at);
create index if not exists idx_orders_customer     on public.orders(customer_id);
create index if not exists idx_purchases_customer  on public.purchases(customer_id);
create index if not exists idx_purchases_order     on public.purchases(order_id);

-- ---------------------------------------------------------------------
-- 2. HÀM + TRIGGER
-- ---------------------------------------------------------------------

-- Kiểm tra người đang đăng nhập có phải admin không
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.customers where id = auth.uid() and role = 'admin'
  );
$$;

-- Tự tạo hồ sơ customers khi có người đăng ký (signUp)
-- Frontend truyền full_name, phone, address qua options.data của signUp
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.customers (id, email, full_name, phone, address)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'address'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Chặn khách tự nâng quyền thành admin
create or replace function public.protect_role()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  -- auth.uid() null = chạy từ SQL Editor (postgres) -> cho phép
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Không được phép đổi role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_role on public.customers;
create trigger trg_protect_role
  before update on public.customers
  for each row execute function public.protect_role();

-- Tự cập nhật updated_at cho products
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated on public.products;
create trigger trg_products_updated
  before update on public.products
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- 3. ĐẶT HÀNG (an toàn): giá lấy từ DB, trừ kho nguyên tử
-- Frontend gọi: supabase.rpc('place_order', { items: [{product_id, quantity}, ...] })
-- ---------------------------------------------------------------------
create or replace function public.place_order(items jsonb)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_total    numeric := 0;
  it         jsonb;
  p          public.products;
  q          integer;
begin
  if auth.uid() is null then
    raise exception 'Cần đăng nhập để đặt hàng';
  end if;
  if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
    raise exception 'Giỏ hàng trống';
  end if;

  insert into public.orders (customer_id, total_amount)
  values (auth.uid(), 0)
  returning id into v_order_id;

  for it in select value from jsonb_array_elements(items) loop
    q := (it->>'quantity')::integer;
    if q is null or q <= 0 then
      raise exception 'Số lượng không hợp lệ';
    end if;

    select * into p from public.products
    where id = (it->>'product_id')::uuid
    for update;

    if not found then
      raise exception 'Sản phẩm không tồn tại';
    end if;
    if p.stock < q then
      raise exception 'Sản phẩm "%" không đủ hàng (còn %)', p.name, p.stock;
    end if;

    update public.products set stock = stock - q where id = p.id;

    insert into public.purchases (order_id, customer_id, product_id, product_name, quantity, unit_price)
    values (v_order_id, auth.uid(), p.id, p.name, q, p.price);

    v_total := v_total + p.price * q;
  end loop;

  update public.orders set total_amount = v_total where id = v_order_id;
  return v_order_id;
end;
$$;

revoke execute on function public.place_order(jsonb) from public, anon;
grant  execute on function public.place_order(jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. HÀM CHO DASHBOARD (chỉ admin gọi được)
-- ---------------------------------------------------------------------

-- Doanh thu 12 tháng của một năm (mặc định năm hiện tại), múi giờ Việt Nam
create or replace function public.admin_monthly_revenue(
  p_year integer default extract(year from (now() at time zone 'Asia/Ho_Chi_Minh'))::integer
)
returns table (month integer, revenue numeric, order_count bigint)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  return query
  select m::integer,
         coalesce(sum(o.total_amount), 0),
         count(o.id)
  from generate_series(1, 12) as m
  left join public.orders o
    on o.status = 'completed'
   and extract(year  from o.created_at at time zone 'Asia/Ho_Chi_Minh') = p_year
   and extract(month from o.created_at at time zone 'Asia/Ho_Chi_Minh') = m
  group by m
  order by m;
end;
$$;

-- Tổng kết: tổng doanh thu, số đơn, số sản phẩm đã bán
create or replace function public.admin_summary()
returns table (total_revenue numeric, total_orders bigint, total_items_sold bigint)
language plpgsql stable security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  return query
  select coalesce(sum(o.total_amount), 0),
         count(*),
         (select coalesce(sum(pu.quantity), 0)
            from public.purchases pu
            join public.orders o2 on o2.id = pu.order_id
           where o2.status = 'completed')
  from public.orders o
  where o.status = 'completed';
end;
$$;

revoke execute on function public.admin_monthly_revenue(integer) from public, anon;
revoke execute on function public.admin_summary()               from public, anon;
grant  execute on function public.admin_monthly_revenue(integer) to authenticated;
grant  execute on function public.admin_summary()               to authenticated;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (phân quyền với anon key)
-- ---------------------------------------------------------------------
alter table public.customers enable row level security;
alter table public.products  enable row level security;
alter table public.orders    enable row level security;
alter table public.purchases enable row level security;

-- Thu hồi quyền của người chưa đăng nhập (anon) với dữ liệu nhạy cảm
revoke all on public.customers, public.orders, public.purchases from anon;
revoke insert, update, delete on public.products from anon;

-- customers: xem/sửa hồ sơ của mình; admin xem/sửa tất cả. Không có insert (trigger lo), không delete.
drop policy if exists "customers_select" on public.customers;
create policy "customers_select" on public.customers
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "customers_update" on public.customers;
create policy "customers_update" on public.customers
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- products: ai cũng xem được (kể cả chưa đăng nhập); chỉ admin thêm/sửa/xóa
drop policy if exists "products_select_all" on public.products;
create policy "products_select_all" on public.products
  for select to anon, authenticated
  using (true);

drop policy if exists "products_admin_insert" on public.products;
create policy "products_admin_insert" on public.products
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "products_admin_update" on public.products;
create policy "products_admin_update" on public.products
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "products_admin_delete" on public.products;
create policy "products_admin_delete" on public.products
  for delete to authenticated
  using (public.is_admin());

-- orders: khách xem đơn của mình, admin xem tất cả. Tạo đơn chỉ qua place_order().
drop policy if exists "orders_select" on public.orders;
create policy "orders_select" on public.orders
  for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update" on public.orders
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "orders_admin_delete" on public.orders;
create policy "orders_admin_delete" on public.orders
  for delete to authenticated
  using (public.is_admin());

-- purchases: khách xem hàng mình đã mua, admin xem tất cả
drop policy if exists "purchases_select" on public.purchases;
create policy "purchases_select" on public.purchases
  for select to authenticated
  using (customer_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------
-- 6. STORAGE: bucket ảnh sản phẩm (upload ảnh thật từ máy)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_insert" on storage.objects;
create policy "product_images_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

-- ---------------------------------------------------------------------
-- 7. TẠO TÀI KHOẢN ADMIN
-- Bước 1: đăng ký tài khoản bình thường (qua web hoặc Authentication > Users > Add user)
-- Bước 2: bỏ comment và sửa email rồi chạy dòng dưới:
-- ---------------------------------------------------------------------
-- update public.customers set role = 'admin' where email = 'gmail-cua-ban@gmail.com';
