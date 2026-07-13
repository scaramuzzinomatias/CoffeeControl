-- migration_v43: enable RLS on admin_users and machines
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
