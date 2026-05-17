-- Chicken VyapasPoint POS Initial Schema

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table 1: tenants
CREATE TABLE tenants (
    tenant_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_name VARCHAR(150) NOT NULL,
    owner_name VARCHAR(100) NOT NULL,
    phone VARCHAR(15) NOT NULL,
    address TEXT,
    gstin VARCHAR(20),
    subscription_status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 2: users
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(15),
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'worker')),
    pin_code VARCHAR(6),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 3: shifts
CREATE TABLE shifts (
    shift_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    shift_name VARCHAR(50),
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 4: suppliers
CREATE TABLE suppliers (
    supplier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    supplier_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100),
    phone VARCHAR(15),
    area VARCHAR(100),
    default_vehicle_no VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 5: inward_sessions
CREATE TABLE inward_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_birds INTEGER DEFAULT 0,
    total_weight_kg DECIMAL(8,2) DEFAULT 0,
    average_rate_per_kg DECIMAL(8,2) GENERATED ALWAYS AS (
        CASE 
            WHEN total_weight_kg > 0 THEN total_value / total_weight_kg
            ELSE 0
        END
    ) STORED,
    total_value DECIMAL(10,2) DEFAULT 0,
    created_by_user_id UUID REFERENCES users(user_id),
    is_finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 6: inward_lines
CREATE TABLE inward_lines (
    line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES inward_sessions(session_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
    vehicle_no VARCHAR(20),
    number_of_birds INTEGER NOT NULL,
    weight_kg DECIMAL(8,2) NOT NULL,
    rate_per_kg DECIMAL(8,2) NOT NULL,
    line_value DECIMAL(10,2) GENERATED ALWAYS AS (weight_kg * rate_per_kg) STORED,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Note: The trigger to update inward_sessions totals based on inward_lines will be added below.

-- Table 7: mortality_log
CREATE TABLE mortality_log (
    mortality_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    session_id UUID REFERENCES inward_sessions(session_id) ON DELETE SET NULL,
    date DATE NOT NULL,
    number_of_birds_dead INTEGER NOT NULL,
    estimated_weight_kg DECIMAL(6,2) NOT NULL,
    loss_value DECIMAL(8,2) DEFAULT 0, -- Should ideally be updated based on avg_rate_per_kg
    reason TEXT,
    created_by_user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 8: products
CREATE TABLE products (
    product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- null = system default
    product_name VARCHAR(100) NOT NULL,
    category VARCHAR(30) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    is_weight_based BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 9: daily_rates
CREATE TABLE daily_rates (
    rate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(product_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    rate_per_unit DECIMAL(8,2) NOT NULL,
    set_by_user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 10: bills
CREATE TABLE bills (
    bill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    bill_number VARCHAR(20) NOT NULL,
    date DATE NOT NULL,
    shift_id UUID REFERENCES shifts(shift_id) ON DELETE SET NULL,
    served_by_user_id UUID REFERENCES users(user_id),
    subtotal DECIMAL(10,2) NOT NULL,
    discount DECIMAL(8,2) DEFAULT 0,
    tax_amount DECIMAL(8,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_mode VARCHAR(10) NOT NULL,
    cash_amount DECIMAL(10,2) DEFAULT 0,
    upi_amount DECIMAL(10,2) DEFAULT 0,
    is_printed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 11: bill_items
CREATE TABLE bill_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID REFERENCES bills(bill_id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(product_id) ON DELETE SET NULL,
    product_name_snapshot VARCHAR(100) NOT NULL,
    weight_kg DECIMAL(6,3),
    quantity_pieces INTEGER,
    rate_applied DECIMAL(8,2) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 12: expense_categories
CREATE TABLE expense_categories (
    category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE, -- Null = system default
    category_name VARCHAR(100) NOT NULL,
    expense_type VARCHAR(30) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 13: expenses
CREATE TABLE expenses (
    expense_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    category_id UUID REFERENCES expense_categories(category_id) ON DELETE SET NULL,
    custom_label VARCHAR(200),
    amount DECIMAL(8,2) NOT NULL,
    payment_mode VARCHAR(10) NOT NULL,
    created_by_user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 14: day_summary
CREATE TABLE day_summary (
    summary_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    opening_stock_birds INTEGER DEFAULT 0,
    opening_stock_weight_kg DECIMAL(8,2) DEFAULT 0,
    total_inward_birds INTEGER DEFAULT 0,
    total_inward_weight_kg DECIMAL(8,2) DEFAULT 0,
    average_purchase_rate DECIMAL(8,2) DEFAULT 0,
    total_mortality_birds INTEGER DEFAULT 0,
    total_mortality_weight_kg DECIMAL(8,2) DEFAULT 0,
    total_sold_weight_kg DECIMAL(8,2) DEFAULT 0,
    closing_stock_birds INTEGER DEFAULT 0,
    closing_stock_weight_kg DECIMAL(8,2) DEFAULT 0,
    gross_sale DECIMAL(10,2) DEFAULT 0,
    total_stock_cost DECIMAL(10,2) DEFAULT 0,
    total_mortality_loss DECIMAL(10,2) DEFAULT 0,
    total_expenses DECIMAL(10,2) DEFAULT 0,
    net_profit DECIMAL(10,2) DEFAULT 0,
    cash_total DECIMAL(10,2) DEFAULT 0,
    upi_total DECIMAL(10,2) DEFAULT 0,
    total_bills INTEGER DEFAULT 0,
    is_closed BOOLEAN DEFAULT FALSE,
    closed_at TIMESTAMP,
    closed_by_user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 15: worker_day_summary
CREATE TABLE worker_day_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    date DATE NOT NULL,
    user_id UUID REFERENCES users(user_id) ON DELETE CASCADE,
    shift_id UUID REFERENCES shifts(shift_id) ON DELETE CASCADE,
    total_bills INTEGER DEFAULT 0,
    total_weight_sold_kg DECIMAL(8,2) DEFAULT 0,
    total_revenue DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table 16: export_log
CREATE TABLE export_log (
    export_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    exported_by_user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    export_type VARCHAR(30) NOT NULL,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    file_url TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inward_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inward_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE mortality_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_day_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_log ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX idx_tenants_created ON tenants(created_at);
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_shifts_tenant_date ON shifts(tenant_id, date);
CREATE INDEX idx_inward_sessions_tenant_date ON inward_sessions(tenant_id, date);
CREATE INDEX idx_inward_lines_session ON inward_lines(session_id);
CREATE INDEX idx_bills_tenant_date ON bills(tenant_id, date);
CREATE INDEX idx_bill_items_bill ON bill_items(bill_id);
CREATE INDEX idx_expenses_tenant_date ON expenses(tenant_id, date);

-- Function and trigger to update inward_sessions totals
CREATE OR REPLACE FUNCTION update_inward_session_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE inward_sessions
    SET total_birds = (SELECT COALESCE(SUM(number_of_birds), 0) FROM inward_lines WHERE session_id = NEW.session_id),
        total_weight_kg = (SELECT COALESCE(SUM(weight_kg), 0) FROM inward_lines WHERE session_id = NEW.session_id),
        total_value = (SELECT COALESCE(SUM(line_value), 0) FROM inward_lines WHERE session_id = NEW.session_id)
    WHERE session_id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_inward_session_totals
AFTER INSERT OR UPDATE OR DELETE ON inward_lines
FOR EACH ROW EXECUTE FUNCTION update_inward_session_totals();
