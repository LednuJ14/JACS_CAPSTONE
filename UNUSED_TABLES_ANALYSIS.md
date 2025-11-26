# Database Tables Analysis - Unused Tables Report

## Summary
After analyzing the codebase, I've identified **5 unused tables** that can be safely dropped from the database.

---

## ✅ USED TABLES (Keep These)

The following 19 tables are actively used in the codebase:

1. **alembic_version** - Alembic migration tracking (required)
2. **announcements** - Used in sub-domain backend
3. **bills** - Used in sub-domain backend (Bill model)
4. **blacklisted_tokens** - Used in main-domain backend
5. **documents** - Used in sub-domain backend
6. **feedback** - Used in sub-domain backend
7. **inquiries** - Used in main-domain backend
8. **maintenance_requests** - Used in sub-domain backend (MaintenanceRequest model)
9. **payments** - Used in sub-domain backend (Payment model)
10. **properties** - Used in both domains
11. **staff** - Used in sub-domain backend
12. **subscriptions** - Used in main-domain backend
13. **subscription_plans** - Used in main-domain backend
14. **tasks** - Used in sub-domain backend
15. **tenants** - Used in sub-domain backend
16. **tenant_units** - Used in sub-domain backend (TenantUnit model)
17. **units** - Used in both domains
18. **users** - Used in both domains
19. **payment_transactions** - Used in main-domain admin controller (raw SQL queries)

---

## ❌ UNUSED TABLES (Can Be Dropped - WITH CAUTIONS)

### 1. **requests**
- **Status**: ⚠️ **CAUTION - Check Foreign Keys First**
- **Reason**: 
  - Schema defines a `requests` table, but the actual model uses `maintenance_requests` table
  - The `MaintenanceRequest` model uses `__tablename__ = 'maintenance_requests'`
  - **IMPORTANT**: Schema shows `tasks` table has FK `request_id` → `requests(id)`, but the Task model doesn't have this field
  - **Action Required**: Check if database actually has this FK constraint before dropping
- **Safety Check**:
  ```sql
  -- Check if tasks table has request_id column and FK constraint
  SELECT COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE TABLE_NAME = 'tasks' AND COLUMN_NAME = 'request_id';
  ```

### 2. **tenancies**
- **Status**: ⚠️ **CAUTION - Check Foreign Keys First**
- **Reason**:
  - Schema defines `tenancies` table, but models don't use it
  - `Bill` model uses `tenant_id` and `unit_id` directly (not `tenancy_id`)
  - `Document` model has `tenancy_id` as a compatibility property that returns `None`
  - **IMPORTANT**: Schema shows `bills` and `documents` tables have FK to `tenancies`, but models don't use these columns
  - **Action Required**: Verify if these FK constraints actually exist in your database
- **Safety Check**:
  ```sql
  -- Check for foreign keys referencing tenancies
  SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME
  FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
  WHERE REFERENCED_TABLE_NAME = 'tenancies';
  ```

### 3. **payment_methods**
- **Status**: ✅ **SAFE TO DROP**
- **Reason**:
  - No model definition found
  - No SQL queries or references found in codebase
  - Payment methods are stored as enum/string in the `payments` table directly
- **Safety**: No dependencies found

### 4. **property_bills**
- **Status**: ✅ **SAFE TO DROP**
- **Reason**:
  - No model definition found
  - No SQL queries or references found in codebase
  - Bills are linked to tenants/units directly, not properties
- **Safety**: No dependencies found

### 5. **subscription_bills**
- **Status**: ❌ **DO NOT DROP - ACTIVELY USED!**
- **Reason**:
  - **CRITICAL**: This table IS actively used!
  - Used in `main-domain/backend/app/repositories/subscription_repository.py`:
    - `create_subscription_bill()` - INSERT queries
    - `get_billing_history()` - SELECT queries
    - `update_subscription_bill_status()` - UPDATE queries
  - Used in `main-domain/backend/app/controllers/admin_controller_v2.py` - UPDATE queries
  - Referenced in frontend code
- **Action**: **KEEP THIS TABLE** - Removing it will break subscription billing functionality!

---

## 🔍 Important Notes

1. **Schema vs. Model Mismatch**: There's a discrepancy between the database schema files and the actual models:
   - Schema defines `requests` table, but model uses `maintenance_requests`
   - Schema defines `tenancies` table, but models use `tenant_units` and direct `tenant_id`/`unit_id` relationships

2. **Foreign Key Dependencies**: Before dropping `tenancies`, check if there are any foreign key constraints from other tables that reference it (the schema shows `bills` table has a foreign key to `tenancies`, but the actual Bill model doesn't use it).

3. **Backup First**: Always backup your database before dropping tables.

---

## 📝 SQL Commands to Drop Unused Tables (SAFE ONES ONLY)

```sql
-- ⚠️ IMPORTANT: Only drop tables after verifying no foreign key constraints exist!

-- Step 1: Check for foreign key dependencies FIRST
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME IN ('requests', 'tenancies', 'payment_methods', 'property_bills')
AND TABLE_SCHEMA = DATABASE();

-- Step 2: If no foreign keys found, drop the safe tables:

-- 3. Drop payment_methods table (SAFE - no dependencies)
DROP TABLE IF EXISTS payment_methods;

-- 4. Drop property_bills table (SAFE - no dependencies)
DROP TABLE IF EXISTS property_bills;

-- Step 3: For requests and tenancies, check if FK constraints exist first:
-- If tasks.request_id FK exists, you need to drop it first:
ALTER TABLE tasks DROP FOREIGN KEY IF EXISTS fk_tasks_request_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS request_id;

-- If bills.tenancy_id FK exists, you need to drop it first:
ALTER TABLE bills DROP FOREIGN KEY IF EXISTS fk_bills_tenancy_id;
ALTER TABLE bills DROP COLUMN IF EXISTS tenancy_id;

-- If documents.tenancy_id FK exists, you need to drop it first:
ALTER TABLE documents DROP FOREIGN KEY IF EXISTS fk_documents_tenancy_id;
ALTER TABLE documents DROP COLUMN IF EXISTS tenancy_id;

-- Step 4: Now you can drop the tables (if no FK constraints remain):
-- 1. Drop requests table (after removing FK from tasks)
DROP TABLE IF EXISTS requests;

-- 2. Drop tenancies table (after removing FKs from bills and documents)
DROP TABLE IF EXISTS tenancies;

-- ⚠️ DO NOT DROP subscription_bills - IT IS ACTIVELY USED!
```

---

## ⚠️ CRITICAL SAFETY CHECKS BEFORE DROPPING

### 1. **Check Foreign Key Dependencies** (MUST DO FIRST!)
```sql
-- Check all foreign keys that reference these tables
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE REFERENCED_TABLE_NAME IN ('requests', 'tenancies', 'payment_methods', 'property_bills')
AND TABLE_SCHEMA = DATABASE();

-- If any results are returned, you MUST drop those foreign keys first!
```

### 2. **Check for Data** (Verify if tables have important data)
```sql
SELECT 'requests' as table_name, COUNT(*) as row_count FROM requests
UNION ALL
SELECT 'tenancies', COUNT(*) FROM tenancies
UNION ALL
SELECT 'payment_methods', COUNT(*) FROM payment_methods
UNION ALL
SELECT 'property_bills', COUNT(*) FROM property_bills;
-- Note: subscription_bills is NOT included - DO NOT DROP IT!
```

### 3. **Verify Schema vs. Actual Database Structure**
```sql
-- Check if tasks table has request_id column
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'tasks' AND COLUMN_NAME = 'request_id';

-- Check if bills table has tenancy_id column
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'bills' AND COLUMN_NAME = 'tenancy_id';

-- Check if documents table has tenancy_id column
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'documents' AND COLUMN_NAME = 'tenancy_id';
```

### 4. **Backup Before Dropping** (ALWAYS DO THIS!)
```sql
-- Backup tables before dropping (only the ones you plan to drop)
CREATE TABLE IF NOT EXISTS requests_backup AS SELECT * FROM requests;
CREATE TABLE IF NOT EXISTS tenancies_backup AS SELECT * FROM tenancies;
CREATE TABLE IF NOT EXISTS payment_methods_backup AS SELECT * FROM payment_methods;
CREATE TABLE IF NOT EXISTS property_bills_backup AS SELECT * FROM property_bills;
-- Note: Do NOT backup subscription_bills - we're keeping it!
```

### 5. **Test in Development First!**
- ⚠️ **NEVER drop tables in production without testing in development first**
- Test that your application still works after dropping these tables
- Verify no errors occur when running the application

## 🚨 SUMMARY - What You Can Safely Drop

**✅ SAFE TO DROP (No dependencies found):**
1. `payment_methods` - No references found
2. `property_bills` - No references found

**⚠️ DROP WITH CAUTION (Check FK constraints first):**
3. `requests` - Schema shows FK from `tasks.request_id`, but model doesn't use it
4. `tenancies` - Schema shows FKs from `bills.tenancy_id` and `documents.tenancy_id`, but models don't use them

**❌ DO NOT DROP:**
5. `subscription_bills` - **ACTIVELY USED** in subscription billing system!

