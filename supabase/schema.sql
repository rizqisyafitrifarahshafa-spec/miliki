create extension if not exists pgcrypto;
create table customers(id uuid primary key default gen_random_uuid(), member_id text unique not null, name text not null, code_hash text not null, stamps int not null default 0 check(stamps between 0 and 10), joined_at date not null default current_date, created_at timestamptz default now());
create table orders(id uuid primary key default gen_random_uuid(), nota_no text unique not null default ('WM-'||upper(substr(md5(random()::text),1,6))), customer_id uuid not null references customers on delete cascade, product text not null, plan text, qty int not null default 1, price int not null default 0, status text not null default 'diproses' check(status in ('diproses','selesai','batal')), stamped boolean not null default false, created_at timestamptz default now());
create table warranties(id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers on delete cascade, order_id uuid references orders on delete set null, product text not null, plan text, start_date date not null, end_date date not null);
create table claims(id uuid primary key default gen_random_uuid(), warranty_id uuid not null references warranties on delete cascade, customer_id uuid not null references customers on delete cascade, message text not null, status text not null default 'baru' check(status in ('baru','diproses','selesai','ditolak')), created_at timestamptz default now());
create table vouchers(id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers on delete cascade, code text unique not null, discount_pct int not null default 10, max_amount int not null default 15000, expires_at date not null default current_date+90, used_at timestamptz, created_at timestamptz default now());
create table stamp_logs(id uuid primary key default gen_random_uuid(), customer_id uuid not null references customers on delete cascade, order_id uuid references orders on delete set null, delta int not null, reason text, created_at timestamptz default now());
-- cegah stamp ganda dari transaksi yang sama
create unique index one_stamp_per_order on stamp_logs(order_id) where order_id is not null;

create or replace function complete_order(p_order uuid) returns void language plpgsql security definer set search_path=public as $$
declare o orders%rowtype; s int;
begin
  select * into o from orders where id=p_order for update;
  if not found then raise exception 'Nota tidak ditemukan'; end if;
  update orders set status='selesai' where id=p_order;
  if o.stamped then return; end if;
  update orders set stamped=true where id=p_order;
  update customers set stamps=stamps+1 where id=o.customer_id returning stamps into s;
  insert into stamp_logs(customer_id,order_id,delta,reason) values(o.customer_id,p_order,1,'Nota '||o.nota_no||' selesai');
  if s>=10 then
    insert into vouchers(customer_id,code) values(o.customer_id,'VC-'||upper(substr(md5(random()::text),1,8)));
    update customers set stamps=0 where id=o.customer_id;
    insert into stamp_logs(customer_id,delta,reason) values(o.customer_id,-10,'Reset: voucher 10% terbit');
  end if;
end $$;
revoke all on function complete_order(uuid) from public, anon, authenticated;

-- RLS aktif tanpa policy: anon/authenticated key TIDAK bisa baca/tulis apa pun.
-- Semua akses lewat Netlify Function memakai service_role (server-side).
alter table customers enable row level security; alter table orders enable row level security;
alter table warranties enable row level security; alter table claims enable row level security;
alter table vouchers enable row level security; alter table stamp_logs enable row level security;
