-- Run this in the Supabase SQL editor.

create table if not exists food_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text not null,
  description text,
  cuisine_name text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table food_items enable row level security;

create policy "Allow all access to food_items"
  on food_items
  for all
  to public
  using (true)
  with check (true);

-- 30 dishes, 2 per existing cuisine. `vegan` items also carry `vegetarian`, since vegan
-- is a subset of it — a "vegetarian" filter should still surface vegan dishes.
insert into food_items (name, emoji, description, cuisine_name, tags) values
  ('Margherita Pizza', '🍕', 'Classic tomato, mozzarella, and basil pizza.', 'Italian', '{vegetarian}'),
  ('Spaghetti Carbonara', '🍝', 'Egg, pecorino, and pancetta pasta.', 'Italian', '{}'),
  ('Beef Tacos', '🌮', 'Seasoned beef in a corn tortilla.', 'Mexican', '{}'),
  ('Guacamole', '🥑', 'Mashed avocado with lime and cilantro.', 'Mexican', '{vegan,vegetarian,gluten-free}'),
  ('Sushi Rolls', '🍣', 'Vinegared rice with fish and vegetables.', 'Japanese', '{}'),
  ('Ramen', '🍜', 'Noodle soup with pork broth and toppings.', 'Japanese', '{}'),
  ('Chicken Tikka Masala', '🍛', 'Grilled chicken in a creamy spiced tomato sauce.', 'Indian', '{spicy}'),
  ('Palak Paneer', '🥬', 'Spinach curry with paneer cheese.', 'Indian', '{vegetarian,gluten-free,spicy}'),
  ('Pad Thai', '🍜', 'Stir-fried rice noodles with peanuts and lime.', 'Thai', '{spicy}'),
  ('Green Curry', '🍛', 'Coconut curry with Thai basil and vegetables.', 'Thai', '{spicy,gluten-free}'),
  ('Kung Pao Chicken', '🍗', 'Stir-fried chicken with peanuts and chili peppers.', 'Chinese', '{spicy}'),
  ('Vegetable Dumplings', '🥟', 'Steamed dumplings filled with vegetables.', 'Chinese', '{vegan,vegetarian}'),
  ('Croissant', '🥐', 'Buttery, flaky laminated pastry.', 'French', '{vegetarian}'),
  ('Coq au Vin', '🍷', 'Chicken braised in red wine.', 'French', '{}'),
  ('Greek Salad', '🥗', 'Tomato, cucumber, olives, and feta.', 'Greek', '{vegetarian,gluten-free}'),
  ('Souvlaki', '🍢', 'Grilled skewered meat, often pork or chicken.', 'Greek', '{gluten-free}'),
  ('Bibimbap', '🍚', 'Mixed rice bowl with vegetables and gochujang.', 'Korean', '{spicy}'),
  ('Korean Fried Chicken', '🍗', 'Crispy double-fried chicken with a sweet-spicy glaze.', 'Korean', '{spicy}'),
  ('Pho', '🍲', 'Beef or chicken noodle soup with herbs.', 'Vietnamese', '{}'),
  ('Fresh Spring Rolls', '🥗', 'Rice-paper rolls with herbs, vermicelli, and shrimp or tofu.', 'Vietnamese', '{gluten-free}'),
  ('Paella', '🥘', 'Saffron rice with seafood, chicken, or vegetables.', 'Spanish', '{gluten-free}'),
  ('Patatas Bravas', '🥔', 'Fried potatoes with spicy tomato sauce.', 'Spanish', '{vegan,vegetarian,gluten-free,spicy}'),
  ('Hummus', '🧆', 'Blended chickpeas, tahini, and lemon.', 'Lebanese', '{vegan,vegetarian,gluten-free}'),
  ('Falafel', '🧆', 'Fried chickpea patties.', 'Lebanese', '{vegan,vegetarian}'),
  ('Cheeseburger', '🍔', 'Beef patty with cheese on a bun.', 'American', '{}'),
  ('BBQ Ribs', '🍖', 'Slow-cooked pork ribs with barbecue sauce.', 'American', '{gluten-free}'),
  ('Vegan Lentil Wat', '🌶️', 'Spiced red lentil stew served with injera.', 'Ethiopian', '{vegan,vegetarian,spicy}'),
  ('Doro Wat', '🍗', 'Spicy chicken stew, an Ethiopian staple.', 'Ethiopian', '{spicy,gluten-free}'),
  ('Feijoada', '🍖', 'Black bean and pork stew.', 'Brazilian', '{gluten-free}'),
  ('Brigadeiro', '🍫', 'Chocolate fudge balls, a classic Brazilian dessert.', 'Brazilian', '{vegetarian,gluten-free}');
