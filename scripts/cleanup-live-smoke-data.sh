#!/usr/bin/env bash
set -euo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-store-postgres}"
BUYER_EMAIL="${BUYER_EMAIL:-buyer@example.com}"
SMOKE_DATE="${SMOKE_DATE:-$(date -u +%F)}"

docker exec -i "$POSTGRES_CONTAINER" psql -U store -d store <<SQL
begin;

create temp table tmp_smoke_orders as
select id
from "order"
where email = '${BUYER_EMAIL}'
  and created_at::date = date '${SMOKE_DATE}';

create temp table tmp_smoke_carts as
select id, shipping_address_id, billing_address_id
from cart
where email = '${BUYER_EMAIL}'
  and created_at::date = date '${SMOKE_DATE}';

create temp table tmp_smoke_attempts as
select id, cart_id, order_id
from payment_attempt
where created_at::date = date '${SMOKE_DATE}'
  and (
    order_id in (select id from tmp_smoke_orders)
    or cart_id in (select id from tmp_smoke_carts)
  );

create temp table tmp_smoke_items as
select id, batch_id
from account_item
where account_identifier like '%_smoke%'
   or display_label like '%Smoke%';

create temp table tmp_smoke_batches as
select distinct batch_id as id
from tmp_smoke_items;

create temp table tmp_restore_inventory as
select distinct id, batch_id
from account_item
where order_id in (select id from tmp_smoke_orders)
   or cart_id in (select id from tmp_smoke_carts)
   or exists (
     select 1
     from tmp_smoke_attempts a
     where account_item.reservation_key like 'payment_attempt:' || a.id || ':%'
   );

create temp table tmp_order_item_links as
select id, item_id
from order_item
where order_id in (select id from tmp_smoke_orders);

create temp table tmp_order_shipping_methods as
select id
from order_shipping_method
where id in (
  select distinct shipping_method_id
  from order_shipping_method_tax_line
)
or id in (
  select distinct shipping_method_id
  from order_shipping_method_adjustment
);

delete from order_access_token
where order_id in (select id from tmp_smoke_orders);

delete from notification
where template = 'guest-order-recovery'
  and data->>'order_id' in (select id from tmp_smoke_orders);

delete from audit_log
where entity_id in (
  select id from tmp_smoke_orders
  union all
  select id from tmp_smoke_attempts
);

delete from after_sale
where order_id in (select id from tmp_smoke_orders);

delete from order_delivery
where order_id in (select id from tmp_smoke_orders)
   or payment_attempt_id in (select id from tmp_smoke_attempts);

delete from order_line_item_adjustment
where item_id in (select item_id from tmp_order_item_links);

delete from order_line_item_tax_line
where item_id in (select item_id from tmp_order_item_links);

delete from order_shipping_method_adjustment
where shipping_method_id in (select id from tmp_order_shipping_methods);

delete from order_shipping_method_tax_line
where shipping_method_id in (select id from tmp_order_shipping_methods);

delete from order_transaction
where order_id in (select id from tmp_smoke_orders);

delete from order_summary
where order_id in (select id from tmp_smoke_orders);

delete from order_payment_collection
where order_id in (select id from tmp_smoke_orders);

delete from order_promotion
where order_id in (select id from tmp_smoke_orders);

delete from order_cart
where order_id in (select id from tmp_smoke_orders)
   or cart_id in (select id from tmp_smoke_carts);

delete from order_item
where id in (select id from tmp_order_item_links);

delete from order_line_item
where id in (select item_id from tmp_order_item_links);

delete from "order"
where id in (select id from tmp_smoke_orders);

delete from cart_line_item_adjustment
where item_id in (
  select id from cart_line_item where cart_id in (select id from tmp_smoke_carts)
);

delete from cart_line_item_tax_line
where item_id in (
  select id from cart_line_item where cart_id in (select id from tmp_smoke_carts)
);

delete from cart_shipping_method_adjustment
where shipping_method_id in (
  select id from cart_shipping_method where cart_id in (select id from tmp_smoke_carts)
);

delete from cart_shipping_method_tax_line
where shipping_method_id in (
  select id from cart_shipping_method where cart_id in (select id from tmp_smoke_carts)
);

delete from cart_payment_collection
where cart_id in (select id from tmp_smoke_carts);

delete from cart_promotion
where cart_id in (select id from tmp_smoke_carts);

delete from credit_line
where cart_id in (select id from tmp_smoke_carts);

delete from cart_line_item
where cart_id in (select id from tmp_smoke_carts);

delete from cart_shipping_method
where cart_id in (select id from tmp_smoke_carts);

delete from payment_attempt
where id in (select id from tmp_smoke_attempts);

delete from cart
where id in (select id from tmp_smoke_carts);

delete from cart_address
where id in (
  select shipping_address_id from tmp_smoke_carts where shipping_address_id is not null
  union
  select billing_address_id from tmp_smoke_carts where billing_address_id is not null
);

update account_item
set status = 'in_stock',
    reservation_key = null,
    cart_id = null,
    order_id = null,
    reserved_at = null,
    reserved_until = null,
    sold_at = null
where id in (select id from tmp_restore_inventory);

delete from account_item
where id in (select id from tmp_smoke_items);

update account_batch b
set total_count = counts.total_count,
    available_count = counts.available_count,
    reserved_count = counts.reserved_count,
    sold_count = counts.sold_count,
    locked_count = counts.locked_count,
    status = case when counts.available_count > 0 then 'active' else 'depleted' end
from (
  select
    batch_id,
    count(*)::int as total_count,
    count(*) filter (where status = 'in_stock')::int as available_count,
    count(*) filter (where status = 'reserved')::int as reserved_count,
    count(*) filter (where status = 'sold')::int as sold_count,
    count(*) filter (where status = 'locked')::int as locked_count
  from account_item
  where batch_id in (select id from tmp_smoke_batches)
  group by batch_id
) as counts
where b.id = counts.batch_id;

update account_batch b
set total_count = counts.total_count,
    available_count = counts.available_count,
    reserved_count = counts.reserved_count,
    sold_count = counts.sold_count,
    locked_count = counts.locked_count,
    status = case when counts.available_count > 0 then 'active' else 'depleted' end
from (
  select
    batch_id,
    count(*)::int as total_count,
    count(*) filter (where status = 'in_stock')::int as available_count,
    count(*) filter (where status = 'reserved')::int as reserved_count,
    count(*) filter (where status = 'sold')::int as sold_count,
    count(*) filter (where status = 'locked')::int as locked_count
  from account_item
  where batch_id in (
    select id from tmp_smoke_batches
    union
    select batch_id from tmp_restore_inventory
  )
  group by batch_id
) as counts
where b.id = counts.batch_id;

update payment_channel
set enabled = coalesce((config_json->>'live_smoke_previous_enabled')::boolean, false),
    config_json = config_json - 'live_smoke_enabled' - 'live_smoke_previous_enabled',
    updated_at = now()
where code = 'manual'
  and deleted_at is null
  and config_json->>'live_smoke_enabled' = 'true';

select
  (select count(*) from tmp_smoke_orders) as deleted_orders,
  (select count(*) from tmp_smoke_carts) as deleted_carts,
  (select count(*) from tmp_smoke_attempts) as deleted_attempts,
  (select count(*) from tmp_smoke_items) as deleted_smoke_inventory,
  (select count(*) from tmp_restore_inventory) as restored_inventory;

commit;
SQL
