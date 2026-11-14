// Stands in for the real diagram while it loads, so the skeleton has the page's shape.
export const SAMPLE_DBML = `Table users {
  id int [pk]
  email varchar [unique, not null]
  name varchar
}

Table orders {
  id int [pk]
  user_id int [ref: > users.id]
  total decimal
}

Table products {
  id int [pk]
  name varchar
  price decimal
}

Table order_items {
  order_id int [ref: > orders.id]
  product_id int [ref: > products.id]
  quantity int
}

Table reviews {
  id int [pk]
  product_id int [ref: > products.id]
  user_id int [ref: > users.id]
  rating int
}`;
