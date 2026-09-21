-- Step 3 performance: indexes for frequently queried columns
-- (cyclone name search, year filter, category filter, bulletin lookup).
-- Safe to run twice (checks information_schema first in the PHP applier;
-- raw runner: use CREATE INDEX IF NOT EXISTS on MySQL 8 / MariaDB 10.1+).
CREATE INDEX IF NOT EXISTS idx_cyclones_local_name ON cyclones (local_name);
CREATE INDEX IF NOT EXISTS idx_cyclones_year ON cyclones (year);
CREATE INDEX IF NOT EXISTS idx_cyclones_category ON cyclones (highest_category);
CREATE INDEX IF NOT EXISTS idx_bulletins_cyclone_bulletin ON bulletins (cyclone_id, bulletin_number);
