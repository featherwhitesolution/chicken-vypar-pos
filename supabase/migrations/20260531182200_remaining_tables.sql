-- Migrating Remaining Tables for Chicken Vypar POS
-- Execute this script in your Supabase SQL Editor

-- 1. wholesale_rates
CREATE TABLE IF NOT EXISTS wholesale_rates (
    date DATE PRIMARY KEY,
    chicken_rate DECIMAL(10,2) DEFAULT 0.00,
    eggs_rate DECIMAL(10,2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE wholesale_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read wholesale_rates" ON wholesale_rates FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update wholesale_rates" ON wholesale_rates FOR ALL USING (true) WITH CHECK (true);


-- 2. wholesale_mortality
CREATE TABLE IF NOT EXISTS wholesale_mortality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    weight_kg DECIMAL(10,2) DEFAULT 0.00,
    count INTEGER DEFAULT 0,
    notes TEXT,
    source VARCHAR(50) DEFAULT 'shop_floor',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE wholesale_mortality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read wholesale_mortality" ON wholesale_mortality FOR SELECT USING (true);
CREATE POLICY "Allow public insert wholesale_mortality" ON wholesale_mortality FOR INSERT WITH CHECK (true);


-- 3. truck_dispatches
CREATE TABLE IF NOT EXISTS truck_dispatches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    truck_number VARCHAR(50) NOT NULL,
    driver_name VARCHAR(100),
    driver_phone VARCHAR(20),
    dispatch_date DATE NOT NULL,
    total_birds INTEGER DEFAULT 0,
    total_weight_kg DECIMAL(10,2) DEFAULT 0.00,
    sold_weight_kg DECIMAL(10,2) DEFAULT 0.00,
    remaining_weight_kg DECIMAL(10,2) DEFAULT 0.00,
    dead_birds_weight_kg DECIMAL(10,2) DEFAULT 0.00,
    dead_birds_count INTEGER DEFAULT 0,
    rate_per_kg DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'partial', 'sold', 'carryover'
    notes TEXT,
    is_carry_over BOOLEAN DEFAULT FALSE,
    diesel_expense DECIMAL(10,2) DEFAULT 0.00,
    driver_bhatta DECIMAL(10,2) DEFAULT 0.00,
    toll_expense DECIMAL(10,2) DEFAULT 0.00,
    other_expenses DECIMAL(10,2) DEFAULT 0.00,
    carry_over_date DATE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE truck_dispatches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read truck_dispatches" ON truck_dispatches FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update truck_dispatches" ON truck_dispatches FOR ALL USING (true) WITH CHECK (true);


-- 4. farm_inwards
CREATE TABLE IF NOT EXISTS farm_inwards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    farm_name VARCHAR(150),
    vehicle_no VARCHAR(50),
    driver_name VARCHAR(100),
    farm_weight_loaded DECIMAL(10,2) DEFAULT 0.00,
    birds_loaded INTEGER DEFAULT 0,
    gross_weight DECIMAL(10,2) DEFAULT 0.00,
    tare_weight DECIMAL(10,2) DEFAULT 0.00,
    net_weight DECIMAL(10,2) DEFAULT 0.00,
    sellable_weight DECIMAL(10,2) DEFAULT 0.00,
    birds_received INTEGER DEFAULT 0,
    dead_birds_weight DECIMAL(10,2) DEFAULT 0.00,
    transit_weight_loss DECIMAL(10,2) DEFAULT 0.00,
    transit_weight_loss_percent DECIMAL(5,2) DEFAULT 0.00,
    transit_mortality INTEGER DEFAULT 0,
    rate DECIMAL(10,2) DEFAULT 0.00,
    total_value DECIMAL(12,2) DEFAULT 0.00,
    notes TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE farm_inwards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read farm_inwards" ON farm_inwards FOR SELECT USING (true);
CREATE POLICY "Allow public insert farm_inwards" ON farm_inwards FOR INSERT WITH CHECK (true);


-- 5. stock_inwards
CREATE TABLE IF NOT EXISTS stock_inwards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id VARCHAR(50),
    supplier_name VARCHAR(150),
    chicken_type VARCHAR(50), -- 'BR', 'P', 'D', 'EG'
    weight DECIMAL(10,2) DEFAULT 0.00,
    rate DECIMAL(10,2) DEFAULT 0.00,
    number_of_birds INTEGER DEFAULT 0,
    vehicle_no VARCHAR(50),
    payment_mode VARCHAR(50) DEFAULT 'Credit',
    cheque_date DATE,
    cheque_number VARCHAR(50),
    bank_name VARCHAR(150),
    total_value DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE stock_inwards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read stock_inwards" ON stock_inwards FOR SELECT USING (true);
CREATE POLICY "Allow public insert stock_inwards" ON stock_inwards FOR INSERT WITH CHECK (true);


-- 6. sales
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_number VARCHAR(50),
    date DATE DEFAULT CURRENT_DATE,
    items JSONB DEFAULT '[]'::jsonb,
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    discount DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) DEFAULT 0.00,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    worker_name VARCHAR(100),
    shift VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read sales" ON sales FOR SELECT USING (true);
CREATE POLICY "Allow public insert sales" ON sales FOR INSERT WITH CHECK (true);


-- 7. mortality
CREATE TABLE IF NOT EXISTS mortality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    birds_dead INTEGER DEFAULT 0,
    weight_loss DECIMAL(10,2) DEFAULT 0.00,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE mortality ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read mortality" ON mortality FOR SELECT USING (true);
CREATE POLICY "Allow public insert/delete mortality" ON mortality FOR ALL USING (true) WITH CHECK (true);


-- 8. retail_products
CREATE TABLE IF NOT EXISTS retail_products (
    id INTEGER PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    rate DECIMAL(10,2) DEFAULT 0.00,
    category VARCHAR(50),
    unit VARCHAR(10),
    is_weight_based BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE retail_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read retail_products" ON retail_products FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update retail_products" ON retail_products FOR ALL USING (true) WITH CHECK (true);


-- 9. supplier_payments
CREATE TABLE IF NOT EXISTS supplier_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id VARCHAR(50),
    supplier_name VARCHAR(150),
    amount DECIMAL(12,2) DEFAULT 0.00,
    payment_method VARCHAR(50) DEFAULT 'Cash',
    purchase_type VARCHAR(50) DEFAULT 'Chicken',
    reference_no VARCHAR(50),
    bank_name VARCHAR(150),
    notes TEXT,
    payment_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE supplier_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read supplier_payments" ON supplier_payments FOR SELECT USING (true);
CREATE POLICY "Allow public insert supplier_payments" ON supplier_payments FOR INSERT WITH CHECK (true);


-- 10. expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    name VARCHAR(250),
    amount DECIMAL(10,2) DEFAULT 0.00,
    payment_mode VARCHAR(50) DEFAULT 'Cash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read expenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Allow public insert/delete expenses" ON expenses FOR ALL USING (true) WITH CHECK (true);


-- 11. workers
CREATE TABLE IF NOT EXISTS workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(50) DEFAULT 'worker',
    shift VARCHAR(50) DEFAULT 'Morning Shift',
    pin_code VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read workers" ON workers FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update/delete workers" ON workers FOR ALL USING (true) WITH CHECK (true);


-- 12. field_staff
CREATE SEQUENCE IF NOT EXISTS field_staff_id_seq START WITH 1001;

CREATE TABLE IF NOT EXISTS field_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id VARCHAR(50) UNIQUE DEFAULT 'FS-' || nextval('field_staff_id_seq')::text,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    passcode VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'Active',
    subscription_plan VARCHAR(50) DEFAULT 'Monthly',
    registered_at DATE DEFAULT CURRENT_DATE,
    subscription_started_at DATE,
    subscription_expired_at DATE,
    assigned_wholesaler_id VARCHAR(50),
    assigned_wholesaler_name VARCHAR(150),
    last_location_lat DECIMAL(10, 8) DEFAULT 19.0413,
    last_location_lng DECIMAL(11, 8) DEFAULT 72.8431,
    last_location_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    battery_percentage INTEGER DEFAULT 100,
    battery_charging BOOLEAN DEFAULT FALSE,
    network_status VARCHAR(20) DEFAULT 'online',
    route_history JSONB DEFAULT '[]'::jsonb,
    current_shop_id VARCHAR(50),
    current_shop_name VARCHAR(150),
    minutes_spent_at_current_shop INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS & Policies
ALTER TABLE field_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read field_staff" ON field_staff FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update/delete field_staff" ON field_staff FOR ALL USING (true) WITH CHECK (true);
