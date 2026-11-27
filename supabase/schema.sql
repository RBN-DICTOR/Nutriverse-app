-- OPTIONAL future backend. The app currently stores data locally and does not use this yet.
create table profiles (id uuid primary key references auth.users on delete cascade, display_name text, country text, region text, preferred_language text, created_at timestamptz default now());
create table food_sources (id bigint generated always as identity primary key, source_name text not null, source_url text, source_version text, access_date date, notes text);
create table foods (id text primary key, name text not null, category text not null, description text, alternative_names text[], preparation_state text not null, serving_description text, default_serving_grams numeric check (default_serving_grams > 0), source_id bigint references food_sources, created_at timestamptz default now());
create table food_nutrients (id bigint generated always as identity primary key, food_id text not null references foods on delete cascade, nutrient_name text not null, nutrient_value numeric check (nutrient_value >= 0), unit text not null, nutrient_basis text not null default 'per 100 g', source_id bigint references food_sources, unique (food_id, nutrient_name));
create table recipes (id uuid primary key default gen_random_uuid(), name text not null, description text, preparation_instructions text, serving_count int check (serving_count > 0), cooked_yield_grams numeric check (cooked_yield_grams > 0), created_by uuid references auth.users on delete cascade, created_at timestamptz default now());
create table recipe_ingredients (id bigint generated always as identity primary key, recipe_id uuid not null references recipes on delete cascade, food_id text not null references foods, quantity_grams numeric not null check (quantity_grams > 0), preparation_method text);
create table saved_meals (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, meal_name text not null, created_at timestamptz default now());
create table saved_meal_items (id bigint generated always as identity primary key, meal_id uuid not null references saved_meals on delete cascade, food_id text not null references foods, portion_grams numeric not null check (portion_grams > 0), preparation_state text);
create table meal_plans (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, plan_name text, budget_amount numeric check (budget_amount >= 0), currency text, location text, start_date date, end_date date);
create table planned_meals (id bigint generated always as identity primary key, meal_plan_id uuid not null references meal_plans on delete cascade, date date, meal_type text, recipe_id uuid references recipes);
create table local_food_prices (id bigint generated always as identity primary key, food_id text not null references foods, location text not null, currency text not null, price numeric not null check (price > 0), unit text not null, source_type text not null, source_description text not null, observed_at date not null);
create table learning_progress (id bigint generated always as identity primary key, user_id uuid not null references auth.users on delete cascade, lesson_id text not null, completion_status text, score int check (score between 0 and 100), completed_at timestamptz, unique (user_id, lesson_id));
create index on food_nutrients (food_id);
create index on saved_meals (user_id);
create index on saved_meal_items (meal_id);
create index on meal_plans (user_id);
create index on planned_meals (meal_plan_id);

-- Row Level Security on every table. Reference data is read-only to clients.
do $$ declare t text; begin
  foreach t in array array['profiles','food_sources','foods','food_nutrients','recipes','recipe_ingredients','saved_meals','saved_meal_items','meal_plans','planned_meals','local_food_prices','learning_progress'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
  foreach t in array array['food_sources','foods','food_nutrients','local_food_prices'] loop
    execute format('create policy "public read" on %I for select using (true)', t);
  end loop;
  foreach t in array array['saved_meals','meal_plans','learning_progress'] loop
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
create policy "own profile" on profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own recipes" on recipes for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "own recipe items" on recipe_ingredients for all using (exists (select 1 from recipes r where r.id = recipe_id and r.created_by = auth.uid())) with check (exists (select 1 from recipes r where r.id = recipe_id and r.created_by = auth.uid()));
create policy "own meal items" on saved_meal_items for all using (exists (select 1 from saved_meals m where m.id = meal_id and m.user_id = auth.uid())) with check (exists (select 1 from saved_meals m where m.id = meal_id and m.user_id = auth.uid()));
create policy "own planned meals" on planned_meals for all using (exists (select 1 from meal_plans p where p.id = meal_plan_id and p.user_id = auth.uid())) with check (exists (select 1 from meal_plans p where p.id = meal_plan_id and p.user_id = auth.uid()));
