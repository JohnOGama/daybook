// A small shop schema used across the diagram tests.
export const SHOP = `Table users {
  id int [pk]
  email varchar [unique, not null]
}

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
}

Table order_items {
  order_id int
  quantity int
}

Ref: order_items.order_id > orders.id`;
