-- migration_v41: enable RLS on stock_movements and machine_stock_items
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_stock_items ENABLE ROW LEVEL SECURITY;
