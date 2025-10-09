-- Enable Row Level Security
alter database postgres set "app.jwt_secret" to 'your-jwt-secret-here';

-- Create profiles table
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text unique not null,
  whatsapp_number text,
  stripe_customer_id text,
  korean_preferences jsonb,
  first_name text,
  last_name text,
  phone text,
  instagram_handle text,
  referral_code text unique,
  referred_by text references public.profiles(referral_code),
  total_savings decimal(10,2) default 0,
  order_count integer default 0,
  viral_shares_count integer default 0,
  last_order_date timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create products table
create table public.products (
  id uuid default gen_random_uuid() primary key,
  name_korean text not null,
  name_english text not null,
  brand text not null,
  seoul_price decimal(10,2) not null,
  us_price decimal(10,2) not null,
  savings_percentage decimal(5,2) not null,
  category text not null,
  description text,
  image_url text,
  korean_site_url text,
  us_site_url text,
  ingredients text,
  skin_type text,
  in_stock boolean default true,
  popularity_score integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create orders table
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references public.profiles(id) on delete cascade not null,
  product_id uuid references public.products(id),
  product_name text not null,
  seoul_price decimal(10,2) not null,
  service_fee decimal(10,2) default 25.00,
  total_amount decimal(10,2) not null,
  status text check (status in ('pending', 'confirmed', 'purchased', 'shipped', 'delivered', 'cancelled')) default 'pending',
  tracking_number text,
  whatsapp_conversation_id text,
  stripe_payment_intent_id text,
  quantity integer default 1,
  ai_confidence_score decimal(3,2),
  estimated_delivery timestamp with time zone,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create ai_customer_insights table
create table public.ai_customer_insights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  skin_analysis jsonb,
  preference_vector jsonb,
  predicted_purchases jsonb,
  conversation_history jsonb,
  sentiment_analysis jsonb,
  reorder_predictions jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create korean_suppliers table
create table public.korean_suppliers (
  id uuid default gen_random_uuid() primary key,
  company_name text not null,
  contact_info jsonb,
  product_categories text[] not null,
  wholesale_pricing jsonb,
  relationship_status text check (relationship_status in ('prospect', 'contacted', 'negotiating', 'active', 'inactive')) default 'prospect',
  ai_communication_log jsonb,
  performance_metrics jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.ai_customer_insights enable row level security;
alter table public.korean_suppliers enable row level security;

-- Create RLS policies
-- Profiles: Users can only see and update their own profile
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Products: All users can view products
create policy "Anyone can view products" on public.products
  for select using (true);

-- Orders: Users can only see their own orders
create policy "Users can view own orders" on public.orders
  for select using (auth.uid() = customer_id);

create policy "Users can insert own orders" on public.orders
  for insert with check (auth.uid() = customer_id);

create policy "Users can update own orders" on public.orders
  for update using (auth.uid() = customer_id);

-- AI Customer Insights: Users can only see their own insights
create policy "Users can view own insights" on public.ai_customer_insights
  for select using (auth.uid() = user_id);

create policy "Service can insert insights" on public.ai_customer_insights
  for insert with check (true);

create policy "Service can update insights" on public.ai_customer_insights
  for update using (true);

-- Korean Suppliers: Only service/admin access
create policy "Service can manage suppliers" on public.korean_suppliers
  for all using (true);

-- Create functions to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create triggers for updated_at
create trigger handle_updated_at before update on public.profiles
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.products
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.orders
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.ai_customer_insights
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at before update on public.korean_suppliers
  for each row execute procedure public.handle_updated_at();

-- Function to generate referral codes
create or replace function public.generate_referral_code()
returns text as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$ language plpgsql;

-- Function to create profile after user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, referral_code)
  values (new.id, new.email, public.generate_referral_code());
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Sample product data for demo
insert into public.products (name_korean, name_english, brand, seoul_price, us_price, savings_percentage, category, description, image_url) values
('자음과모음 레드 빈 워터', 'Red Bean Water', 'Beauty of Joseon', 12.50, 28.00, 55.36, 'Toner', 'Hydrating toner with red bean extract for sensitive skin', 'https://images.unsplash.com/photo-1556228578-8c89e6adf883'),
('센텔라 아시아티카 토너', 'Centella Asiatica Toner', 'COSRX', 13.00, 32.00, 59.38, 'Toner', 'Soothing toner with centella asiatica for acne-prone skin', 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a'),
('윤조에센스', 'Yun Jo Essence', 'Sulwhasoo', 28.00, 94.00, 70.21, 'Essence', 'Premium anti-aging essence with Korean herbal ingredients', 'https://images.unsplash.com/photo-1617897094665-d019c0ac14f5'),
('아쿠아 세럼', 'Aqua Serum', 'Laneige', 22.00, 56.00, 60.71, 'Serum', 'Deep hydrating serum with hyaluronic acid', 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908'),
('굿 모닝 젤 클렌저', 'Good Morning Gel Cleanser', 'COSRX', 8.50, 18.00, 52.78, 'Cleanser', 'Gentle morning cleanser with BHA for oily skin', 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b');

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;