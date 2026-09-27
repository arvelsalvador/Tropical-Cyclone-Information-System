-- ===========================================================================
-- Step 6 housekeeping (NOT run automatically — review each item first).
--
-- These objects are leftovers whose purpose has ended. They are listed here
-- instead of being dropped in place so the decision (and the "why") is
-- recorded in the repo. Run them one at a time.
-- ===========================================================================

-- 1) bulletins_backup_20260918 — a manual snapshot of `bulletins` taken on
--    2026-09-18 (1,062 rows, identical row count to the live table).
--    Kept as a recovery copy for now; drop it only once the PDF archive is
--    confirmed secure elsewhere (R2) and no further bulk edits are planned.
--    Check first:
--      SELECT COUNT(*) FROM bulletins;                       -- 1062
--      SELECT COUNT(*) FROM bulletins_backup_20260918;       -- 1062
--      SELECT COUNT(*) FROM bulletins b
--        LEFT JOIN bulletins_backup_20260918 k ON k.id = b.id
--        WHERE k.id IS NULL;                                 -- 0 = still identical
-- DROP TABLE bulletins_backup_20260918;

-- 2) upcoming_storm — the "upcoming storm" feature is now session-based on the
--    public site (js/upcoming-storm-state.js) and the admin page that edited
--    this table was removed, so the single row here ("TY ARVELd", a test
--    entry) is unreachable from the UI. api/get_upcoming_storm.php was
--    deleted in the same step.
-- DROP TABLE upcoming_storm;

-- 3) Stray databases on the local XAMPP server (never referenced by the app).
--    `test` is a MySQL default; `storm` holds an old copy of the schema.
-- DROP DATABASE IF EXISTS `storm`;
-- DROP DATABASE IF EXISTS `test`;

-- 4) password_resets — expired/used rows are now pruned on every reset
--    request. To clear the backlog immediately:
-- DELETE FROM password_resets WHERE used = 1 OR expires_at <= NOW();
