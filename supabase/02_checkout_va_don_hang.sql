-- =====================================================================
-- NẾP CÀI - CẬP NHẬT 02: THANH TOÁN + QUẢN LÝ ĐƠN HÀNG
-- Chạy SAU file supabase_setup.sql. Chạy lại nhiều lần vẫn an toàn.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Bảng orders: thêm thông tin giao hàng, thanh toán, thời điểm hoàn tất
-- ---------------------------------------------------------------------
alter table public.orders
  add column if not exists ship_type      text not null default 'default',
  add column if not exists ship_name      text,
  add column if not exists ship_phone     text,
  add column if not exists ship_address   text,
  add column if not exists payment_method text not null default 'cod',
  add column if not exists note           text,
  add column if not exists completed_at   timestamptz,
  add column if not exists updated_at     timestamptz not null default now();

do $$ begin
  alter table public.orders add constraint orders_ship_type_chk check (ship_type in ('default', 'other'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.orders add constraint orders_payment_chk check (payment_method in ('cod', 'qr'));
exception when duplicate_object then null; end $$;

-- Đơn mới mặc định "Đang xử lý"; admin bấm "Đã xong" thì mới tính doanh thu
alter table public.orders alter column status set default 'pending';

-- Bổ sung dữ liệu cho các đơn cũ
update public.orders set completed_at = created_at where status = 'completed' and completed_at is null;
update public.orders o
   set ship_name = c.full_name, ship_phone = c.phone, ship_address = c.address
  from public.customers c
 where c.id = o.customer_id and o.ship_address is null;

create index if not exists idx_orders_status on public.orders(status);

-- ---------------------------------------------------------------------
-- 2. Đặt hàng: giá + tồn kho lấy từ DB; địa chỉ mặc định lấy từ hồ sơ khách
--    supabase.rpc('place_order', { items, p_ship_type, p_ship_name, p_ship_phone, p_ship_address, p_note })
-- ---------------------------------------------------------------------
drop function if exists public.place_order(jsonb);

create or replace function public.place_order(
  items           jsonb,
  p_ship_type     text default 'default',
  p_ship_name     text default null,
  p_ship_phone    text default null,
  p_ship_address  text default null,
  p_note          text default null,
  p_payment       text default 'cod'
)
returns bigint
language plpgsql security definer
set search_path = public
as $$
declare
  v_order_id bigint;
  v_total    numeric := 0;
  v_name     text;
  v_phone    text;
  v_address  text;
  c          public.customers;
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
  if jsonb_array_length(items) > 50 then
    raise exception 'Đơn hàng có quá nhiều sản phẩm';
  end if;
  if p_payment is distinct from 'cod' then
    raise exception 'Hiện chỉ hỗ trợ thanh toán khi nhận hàng (COD)';
  end if;

  select * into c from public.customers where id = auth.uid();
  if not found then
    raise exception 'Không tìm thấy hồ sơ khách hàng';
  end if;

  if p_ship_type = 'default' then
    v_name := nullif(trim(c.full_name), '');
    v_phone := nullif(trim(c.phone), '');
    v_address := nullif(trim(c.address), '');
    if v_phone is null or v_address is null then
      raise exception 'Hồ sơ của bạn chưa có số điện thoại hoặc địa chỉ. Hãy chọn "Địa chỉ khác" hoặc cập nhật hồ sơ.';
    end if;
  elsif p_ship_type = 'other' then
    v_name := nullif(trim(p_ship_name), '');
    v_phone := nullif(trim(p_ship_phone), '');
    v_address := nullif(trim(p_ship_address), '');
    if v_name is null or v_phone is null or v_address is null then
      raise exception 'Vui lòng nhập đủ tên người nhận, số điện thoại và địa chỉ';
    end if;
  else
    raise exception 'Loại địa chỉ không hợp lệ';
  end if;

  if v_phone !~ '^[0-9+ .-]{8,15}$' then
    raise exception 'Số điện thoại không hợp lệ';
  end if;
  if length(coalesce(v_name, '')) > 100 or length(v_address) > 300 or length(coalesce(p_note, '')) > 500 then
    raise exception 'Thông tin giao hàng quá dài';
  end if;

  insert into public.orders (customer_id, total_amount, status, ship_type, ship_name, ship_phone, ship_address, payment_method, note)
  values (auth.uid(), 0, 'pending', p_ship_type, coalesce(v_name, c.email), v_phone, v_address, 'cod', nullif(trim(p_note), ''))
  returning id into v_order_id;

  for it in select value from jsonb_array_elements(items) loop
    q := (it->>'quantity')::integer;
    if q is null or q <= 0 or q > 99 then
      raise exception 'Số lượng không hợp lệ';
    end if;

    select * into p from public.products where id = (it->>'product_id')::uuid for update;
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

revoke execute on function public.place_order(jsonb, text, text, text, text, text, text) from public, anon;
grant  execute on function public.place_order(jsonb, text, text, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Admin đổi trạng thái đơn: pending (Đang xử lý) | completed (Đã xong) | cancelled (Đã huỷ)
--    - Huỷ đơn: trả hàng về kho
--    - Mở lại đơn đã huỷ: trừ kho lại (báo lỗi nếu không đủ hàng)
-- ---------------------------------------------------------------------
create or replace function public.admin_set_order_status(p_order_id bigint, p_status text)
returns public.orders
language plpgsql security definer
set search_path = public
as $$
declare
  o  public.orders;
  r  record;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if p_status not in ('pending', 'completed', 'cancelled') then
    raise exception 'Trạng thái không hợp lệ';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Không tìm thấy đơn hàng';
  end if;
  if o.status = p_status then
    return o;
  end if;

  if p_status = 'cancelled' then
    for r in select product_id, sum(quantity) qty from public.purchases
             where order_id = p_order_id and product_id is not null group by product_id loop
      update public.products set stock = stock + r.qty where id = r.product_id;
    end loop;
  elsif o.status = 'cancelled' then
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
     set status = p_status,
         completed_at = case when p_status = 'completed' then now() else null end,
         updated_at = now()
   where id = p_order_id
  returning * into o;
  return o;
end;
$$;

revoke execute on function public.admin_set_order_status(bigint, text) from public, anon;
grant  execute on function public.admin_set_order_status(bigint, text) to authenticated;

-- Đổi trạng thái chỉ qua hàm trên (để tồn kho luôn khớp)
drop policy if exists "orders_admin_update" on public.orders;

-- ---------------------------------------------------------------------
-- 4. Doanh thu theo tháng: tính theo NGÀY HOÀN TẤT (lúc admin bấm "Đã xong")
-- ---------------------------------------------------------------------
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
  select m::integer, coalesce(sum(o.total_amount), 0), count(o.id)
  from generate_series(1, 12) as m
  left join public.orders o
    on o.status = 'completed'
   and extract(year  from coalesce(o.completed_at, o.created_at) at time zone 'Asia/Ho_Chi_Minh') = p_year
   and extract(month from coalesce(o.completed_at, o.created_at) at time zone 'Asia/Ho_Chi_Minh') = m
  group by m
  order by m;
end;
$$;
