-- ============================================================================
-- Bank Reconciliation Test Data Setup Script
-- ============================================================================
-- This script inserts test GeneralLedgerEntry records for "Thomas Brown LLC 2"
-- to test the bank reconciliation feature.
--
-- Test Scenarios:
-- 1. Entries that WILL auto-match (dates within ±3 days, exact amounts, matching references)
-- 2. Entries that WON'T match (dates >3 days apart, different amounts, missing references)
-- ============================================================================

-- Step 1: Find OrganizationId for "Thomas Brown LLC 2"
DECLARE @OrgId BIGINT;
SELECT @OrgId = Id 
FROM Organizations 
WHERE Name = 'Thomas Brown LLC 2' AND IsDeleted = 0;

IF @OrgId IS NULL
BEGIN
    PRINT 'ERROR: Organization "Thomas Brown LLC 2" not found!';
    PRINT 'Please verify the organization name exists in the database.';
    RETURN;
END

PRINT 'Found OrganizationId: ' + CAST(@OrgId AS VARCHAR(20));

-- Step 1.5: Delete existing ledger entries for this organization
PRINT 'Deleting existing ledger entries...';
DELETE FROM GeneralLedgerEntries WHERE OrganizationId = @OrgId;
PRINT 'Deleted existing ledger entries.';

-- Step 2: Seed accounts if they don't exist, then get AccountIds
-- AccountType enum values: Asset=1, Liability=2, Equity=3, Income=4, Expense=5

-- Check if accounts exist, if not, create them
IF NOT EXISTS (SELECT 1 FROM Accounts WHERE OrganizationId = @OrgId AND AccountCode = '1000')
BEGIN
    INSERT INTO Accounts (OrganizationId, AccountCode, AccountName, AccountType, IsSystemAccount, IsActive, Description, CreatedAt)
    VALUES (@OrgId, '1000', 'Cash', 1, 1, 1, 'Cash and cash equivalents', GETDATE());
    PRINT 'Created Cash account (1000)';
END

IF NOT EXISTS (SELECT 1 FROM Accounts WHERE OrganizationId = @OrgId AND AccountCode = '4000')
BEGIN
    INSERT INTO Accounts (OrganizationId, AccountCode, AccountName, AccountType, IsSystemAccount, IsActive, Description, CreatedAt)
    VALUES (@OrgId, '4000', 'Rent Income', 4, 1, 1, 'Rental income from tenants', GETDATE());
    PRINT 'Created Rent Income account (4000)';
END

IF NOT EXISTS (SELECT 1 FROM Accounts WHERE OrganizationId = @OrgId AND AccountCode = '5100')
BEGIN
    INSERT INTO Accounts (OrganizationId, AccountCode, AccountName, AccountType, IsSystemAccount, IsActive, Description, CreatedAt)
    VALUES (@OrgId, '5100', 'Maintenance Expense', 5, 1, 1, 'Property maintenance and repairs', GETDATE());
    PRINT 'Created Maintenance Expense account (5100)';
END

IF NOT EXISTS (SELECT 1 FROM Accounts WHERE OrganizationId = @OrgId AND AccountCode = '5900')
BEGIN
    INSERT INTO Accounts (OrganizationId, AccountCode, AccountName, AccountType, IsSystemAccount, IsActive, Description, CreatedAt)
    VALUES (@OrgId, '5900', 'Other Expenses', 5, 1, 1, 'Other miscellaneous expenses', GETDATE());
    PRINT 'Created Other Expenses account (5900)';
END

-- Now get the AccountIds
DECLARE @CashAccountId BIGINT;
DECLARE @RentIncomeAccountId BIGINT;
DECLARE @MaintenanceExpenseAccountId BIGINT;
DECLARE @OtherExpenseAccountId BIGINT;

SELECT @CashAccountId = Id 
FROM Accounts 
WHERE OrganizationId = @OrgId AND AccountCode = '1000' AND IsActive = 1;

SELECT @RentIncomeAccountId = Id 
FROM Accounts 
WHERE OrganizationId = @OrgId AND AccountCode = '4000' AND IsActive = 1;

SELECT @MaintenanceExpenseAccountId = Id 
FROM Accounts 
WHERE OrganizationId = @OrgId AND AccountCode = '5100' AND IsActive = 1;

SELECT @OtherExpenseAccountId = Id 
FROM Accounts 
WHERE OrganizationId = @OrgId AND AccountCode = '5900' AND IsActive = 1;

IF @CashAccountId IS NULL OR @RentIncomeAccountId IS NULL
BEGIN
    PRINT 'ERROR: Failed to create or find required accounts!';
    PRINT 'Cash Account (1000): ' + ISNULL(CAST(@CashAccountId AS VARCHAR(20)), 'NOT FOUND');
    PRINT 'Rent Income Account (4000): ' + ISNULL(CAST(@RentIncomeAccountId AS VARCHAR(20)), 'NOT FOUND');
    RETURN;
END

PRINT 'Found AccountIds:';
PRINT '  Cash (1000): ' + CAST(@CashAccountId AS VARCHAR(20));
PRINT '  Rent Income (4000): ' + CAST(@RentIncomeAccountId AS VARCHAR(20));
IF @MaintenanceExpenseAccountId IS NOT NULL
    PRINT '  Maintenance Expense (5100): ' + CAST(@MaintenanceExpenseAccountId AS VARCHAR(20));
IF @OtherExpenseAccountId IS NOT NULL
    PRINT '  Other Expense (5900): ' + CAST(@OtherExpenseAccountId AS VARCHAR(20));

-- Step 3: Insert test ledger entries
-- Using dates from the past month (25 days ago as base, spread over past month)

DECLARE @TestDateBase DATE = DATEADD(DAY, -25, GETDATE()); -- 25 days ago (within past month)
DECLARE @Today DATE = GETDATE();

-- ============================================================================
-- ENTRIES THAT WILL MATCH (for auto-matching test)
-- ============================================================================
-- These entries have dates, amounts, and references that match the CSV file

-- Rent Payment 1 - Will match CSV entry (same date)
INSERT INTO GeneralLedgerEntries (OrganizationId, AccountId, TransactionId, TransactionType, Amount, TransactionDate, Description, Reference, CreatedAt)
VALUES (@OrgId, @RentIncomeAccountId, 1001, 'Payment', 1500.00, @TestDateBase, 'Rent Payment from Tenant - Unit 101', 'PAY001', GETDATE());

-- Maintenance Expense 1 - Will match CSV entry (1 day later, within 3 days)
INSERT INTO GeneralLedgerEntries (OrganizationId, AccountId, TransactionId, TransactionType, Amount, TransactionDate, Description, Reference, CreatedAt)
VALUES (@OrgId, @MaintenanceExpenseAccountId, 2001, 'Expense', -250.00, DATEADD(DAY, 1, @TestDateBase), 'Plumbing Repair - Kitchen Sink', 'EXP001', GETDATE());

-- Property Management Fee - Will match CSV entry (5 days later)
INSERT INTO GeneralLedgerEntries (OrganizationId, AccountId, TransactionId, TransactionType, Amount, TransactionDate, Description, Reference, CreatedAt)
VALUES (@OrgId, @OtherExpenseAccountId, 2002, 'Expense', -100.00, DATEADD(DAY, 5, @TestDateBase), 'Property Management Fee', 'PM001', GETDATE());

-- Rent Payment 2 - Will match CSV entry (7 days later, within 3 days)
INSERT INTO GeneralLedgerEntries (OrganizationId, AccountId, TransactionId, TransactionType, Amount, TransactionDate, Description, Reference, CreatedAt)
VALUES (@OrgId, @RentIncomeAccountId, 1002, 'Payment', 1200.00, DATEADD(DAY, 7, @TestDateBase), 'Rent Payment from Tenant - Unit 202', 'PAY002', GETDATE());

-- ============================================================================
-- ENTRIES THAT WON'T MATCH (for discrepancy testing)
-- ============================================================================
-- These entries have dates >3 days apart, different amounts, or missing references

-- Rent Payment 3 - Different amount (won't match)
INSERT INTO GeneralLedgerEntries (OrganizationId, AccountId, TransactionId, TransactionType, Amount, TransactionDate, Description, Reference, CreatedAt)
VALUES (@OrgId, @RentIncomeAccountId, 1003, 'Payment', 1800.00, DATEADD(DAY, 10, @TestDateBase), 'Rent Payment from Tenant - Unit 303', 'PAY003', GETDATE());

-- Maintenance Expense 2 - Different amount (won't match)
INSERT INTO GeneralLedgerEntries (OrganizationId, AccountId, TransactionId, TransactionType, Amount, TransactionDate, Description, Reference, CreatedAt)
VALUES (@OrgId, @MaintenanceExpenseAccountId, 2003, 'Expense', -350.00, DATEADD(DAY, 3, @TestDateBase), 'HVAC Repair - Unit 101', 'EXP002', GETDATE());

-- Journal Entry - Missing reference (won't auto-match)
INSERT INTO GeneralLedgerEntries (OrganizationId, AccountId, TransactionId, TransactionType, Amount, TransactionDate, Description, Reference, CreatedAt)
VALUES (@OrgId, @OtherExpenseAccountId, 3001, 'JournalEntry', -75.00, DATEADD(DAY, 2, @TestDateBase), 'Office Supplies', NULL, GETDATE());

-- Rent Payment 4 - Different amount
INSERT INTO GeneralLedgerEntries (OrganizationId, AccountId, TransactionId, TransactionType, Amount, TransactionDate, Description, Reference, CreatedAt)
VALUES (@OrgId, @RentIncomeAccountId, 1004, 'Payment', 2000.00, DATEADD(DAY, 12, @TestDateBase), 'Rent Payment from Tenant - Unit 404', 'PAY004', GETDATE());

-- Maintenance Expense 3 - Date within range but no matching CSV entry
INSERT INTO GeneralLedgerEntries (OrganizationId, AccountId, TransactionId, TransactionType, Amount, TransactionDate, Description, Reference, CreatedAt)
VALUES (@OrgId, @MaintenanceExpenseAccountId, 2004, 'Expense', -150.00, DATEADD(DAY, 9, @TestDateBase), 'Landscaping Service', 'EXP003', GETDATE());

-- ============================================================================
-- Verification Query
-- ============================================================================
PRINT '';
PRINT 'Verification: Checking inserted ledger entries...';
SELECT 
    Id,
    TransactionType,
    Amount,
    TransactionDate,
    Description,
    Reference,
    CASE 
        WHEN Reference IN ('PAY001', 'EXP001', 'PM001', 'PAY002') THEN 'WILL MATCH'
        ELSE 'WON''T MATCH'
    END AS MatchStatus
FROM GeneralLedgerEntries
WHERE OrganizationId = @OrgId
    AND TransactionDate >= DATEADD(DAY, -30, @Today)
    AND TransactionDate <= @Today
ORDER BY TransactionDate DESC;

PRINT '';
PRINT 'Setup complete!';
PRINT 'Total entries inserted: ' + CAST(@@ROWCOUNT AS VARCHAR(10));
PRINT '';
PRINT 'Next steps:';
PRINT '1. Update test-bank-statement.csv with dates from the past month';
PRINT '2. Upload the CSV file in the Bank Reconciliation page';
PRINT '3. Verify that entries with references PAY001, EXP001, PM001, PAY002 auto-match';
PRINT '4. Verify that other entries remain unmatched (discrepancies)';
PRINT '5. Test manual matching for the unmatched entries';
PRINT '';
PRINT 'NOTE: CSV dates should match the ledger entry dates:';
PRINT '  Base date: ' + CAST(@TestDateBase AS VARCHAR(20));
PRINT '  Date +1: ' + CAST(DATEADD(DAY, 1, @TestDateBase) AS VARCHAR(20));
PRINT '  Date +5: ' + CAST(DATEADD(DAY, 5, @TestDateBase) AS VARCHAR(20));
PRINT '  Date +7: ' + CAST(DATEADD(DAY, 7, @TestDateBase) AS VARCHAR(20));
