-- Script to delete and re-seed HOA template and expenses for Property ID 95 and Units 160, 161, 162
-- This script:
-- 1. Deletes all previously seeded expenses and HOA template for Property 95
-- 2. Re-seeds the data with updated structure:
--    - HOA template and expenses are property-level (not per unit)
--    - Random expenses for each unit

-- Declare variables
DECLARE @PropertyId BIGINT = 95;
DECLARE @UnitId1 BIGINT = 160;
DECLARE @UnitId2 BIGINT = 161;
DECLARE @UnitId3 BIGINT = 162;
DECLARE @LandlordId BIGINT;
DECLARE @OrganizationId BIGINT;
DECLARE @RecurringExpenseId BIGINT;
DECLARE @CurrentDate DATETIME2 = GETDATE();
DECLARE @DeletedExpensesCount INT = 0;
DECLARE @DeletedRecurringExpensesCount INT = 0;

-- Get LandlordId and OrganizationId from Property
SELECT @LandlordId = LandlordId, @OrganizationId = OrganizationId
FROM Properties
WHERE Id = @PropertyId;

-- Check if property exists
IF @LandlordId IS NULL
BEGIN
    PRINT 'ERROR: Property with ID ' + CAST(@PropertyId AS NVARCHAR(20)) + ' does not exist.';
    RETURN;
END

PRINT 'Property ID: ' + CAST(@PropertyId AS NVARCHAR(20));
PRINT 'Landlord ID: ' + CAST(@LandlordId AS NVARCHAR(20));
PRINT 'Organization ID: ' + ISNULL(CAST(@OrganizationId AS NVARCHAR(20)), 'NULL');

-- Verify units exist and belong to the property
IF NOT EXISTS (SELECT 1 FROM Units WHERE Id = @UnitId1 AND PropertyId = @PropertyId)
BEGIN
    PRINT 'WARNING: Unit ID ' + CAST(@UnitId1 AS NVARCHAR(20)) + ' does not exist or does not belong to Property ' + CAST(@PropertyId AS NVARCHAR(20));
END

IF NOT EXISTS (SELECT 1 FROM Units WHERE Id = @UnitId2 AND PropertyId = @PropertyId)
BEGIN
    PRINT 'WARNING: Unit ID ' + CAST(@UnitId2 AS NVARCHAR(20)) + ' does not exist or does not belong to Property ' + CAST(@PropertyId AS NVARCHAR(20));
END

IF NOT EXISTS (SELECT 1 FROM Units WHERE Id = @UnitId3 AND PropertyId = @PropertyId)
BEGIN
    PRINT 'WARNING: Unit ID ' + CAST(@UnitId3 AS NVARCHAR(20)) + ' does not exist or does not belong to Property ' + CAST(@PropertyId AS NVARCHAR(20));
END

BEGIN TRANSACTION;

BEGIN TRY
    -- ============================================
    -- STEP 1: DELETE PREVIOUSLY SEEDED DATA
    -- ============================================
    PRINT '';
    PRINT '=== DELETING PREVIOUSLY SEEDED DATA ===';

    -- Delete expenses for Property 95 that match our seed pattern
    -- This includes:
    -- 1. HOA expenses (Category = 'HOA') for this property
    -- 2. Expenses for the specific units (160, 161, 162) that match our seed pattern
    DELETE FROM Expenses
    WHERE PropertyId = @PropertyId
      AND (
          -- HOA expenses (property-level or unit-level)
          (Category = 'HOA' AND (UnitId IS NULL OR UnitId IN (@UnitId1, @UnitId2, @UnitId3)))
          OR
          -- Unit-specific expenses for our seeded units
          (UnitId IN (@UnitId1, @UnitId2, @UnitId3) 
           AND (
               -- Match common seed patterns
               Name LIKE '%Plumbing%' OR
               Name LIKE '%HVAC%' OR
               Name LIKE '%Water Bill%' OR
               Name LIKE '%Cleaning%' OR
               Name LIKE '%Paint%' OR
               Name LIKE '%Electrical%' OR
               Name LIKE '%Landscaping%' OR
               Name LIKE '%Internet%' OR
               Name LIKE '%Appliance%' OR
               Name LIKE '%Carpet%' OR
               Name LIKE '%Window%' OR
               Name LIKE '%Trash%' OR
               Name LIKE '%Gutter%' OR
               Name LIKE '%Drywall%' OR
               Name LIKE '%Insurance%'
           ))
      );

    SET @DeletedExpensesCount = @@ROWCOUNT;
    PRINT 'Deleted ' + CAST(@DeletedExpensesCount AS NVARCHAR(20)) + ' expense records';

    -- Delete HOA RecurringExpense templates for Property 95
    DELETE FROM RecurringExpenses
    WHERE PropertyId = @PropertyId
      AND Category = 'HOA'
      AND (UnitId IS NULL OR UnitId IN (@UnitId1, @UnitId2, @UnitId3));

    SET @DeletedRecurringExpensesCount = @@ROWCOUNT;
    PRINT 'Deleted ' + CAST(@DeletedRecurringExpensesCount AS NVARCHAR(20)) + ' recurring expense templates';

    PRINT '=== DELETION COMPLETE ===';
    PRINT '';

    -- ============================================
    -- STEP 2: RE-SEED DATA
    -- ============================================
    PRINT '=== RE-SEEDING DATA ===';

    -- 1. Create HOA RecurringExpense Template for the property (property-level, not unit-specific)
    -- ERecurringFrequency.Monthly = 0
    INSERT INTO RecurringExpenses (
        LandlordId,
        PropertyId,
        UnitId, -- NULL for property-level template
        OrganizationId,
        Name,
        Category,
        Amount,
        Frequency,
        DayOfPeriod,
        StartDate,
        EndDate,
        Notes,
        Vendor,
        PaymentMethod,
        IsTaxDeductible,
        IsPaused,
        LastGeneratedDate,
        NextOccurrenceDate,
        CreatedAt,
        UpdatedAt
    )
    VALUES (
        @LandlordId,
        @PropertyId,
        NULL, -- Property-level template, not unit-specific
        @OrganizationId,
        'Monthly HOA Fee',
        'HOA',
        1050.00, -- Monthly HOA amount for entire property (3 units * 350)
        0, -- Monthly frequency (ERecurringFrequency.Monthly = 0)
        1, -- Day of month (1st of each month)
        DATEADD(MONTH, -6, @CurrentDate), -- Start date 6 months ago
        NULL, -- No end date
        'Monthly Homeowners Association fee for entire property',
        'HOA Management Company',
        'ACH',
        1, -- IsTaxDeductible = true
        0, -- IsPaused = false
        DATEADD(MONTH, -1, @CurrentDate), -- Last generated 1 month ago
        DATEADD(DAY, 1, EOMONTH(@CurrentDate)), -- Next occurrence: 1st of next month
        @CurrentDate,
        NULL
    );

    SET @RecurringExpenseId = SCOPE_IDENTITY();
    PRINT 'Created RecurringExpense template with ID: ' + CAST(@RecurringExpenseId AS NVARCHAR(20));

    -- 2. Create HOA Expense records for the property (property-level, UnitId = NULL)
    -- Past 6 months of HOA payments
    INSERT INTO Expenses (
        LandlordId,
        PropertyId,
        UnitId, -- NULL for property-level expense
        OrganizationId,
        Name,
        Category,
        Amount,
        ExpenseDate,
        Vendor,
        PaymentMethod,
        IsRecurring,
        IsTaxDeductible,
        IsPaid,
        PaidDate,
        BillDate,
        DueDate,
        CreatedAt,
        UpdatedAt
    )
    VALUES
        -- Property-level HOA payments (past 6 months)
        (@LandlordId, @PropertyId, NULL, @OrganizationId, 'HOA Fee - Property', 'HOA', 1050.00, DATEADD(MONTH, -6, @CurrentDate), 'HOA Management Company', 'ACH', 1, 1, 1, DATEADD(MONTH, -6, @CurrentDate), DATEADD(MONTH, -6, @CurrentDate), DATEADD(MONTH, -6, @CurrentDate), DATEADD(MONTH, -6, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, NULL, @OrganizationId, 'HOA Fee - Property', 'HOA', 1050.00, DATEADD(MONTH, -5, @CurrentDate), 'HOA Management Company', 'ACH', 1, 1, 1, DATEADD(MONTH, -5, @CurrentDate), DATEADD(MONTH, -5, @CurrentDate), DATEADD(MONTH, -5, @CurrentDate), DATEADD(MONTH, -5, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, NULL, @OrganizationId, 'HOA Fee - Property', 'HOA', 1050.00, DATEADD(MONTH, -4, @CurrentDate), 'HOA Management Company', 'ACH', 1, 1, 1, DATEADD(MONTH, -4, @CurrentDate), DATEADD(MONTH, -4, @CurrentDate), DATEADD(MONTH, -4, @CurrentDate), DATEADD(MONTH, -4, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, NULL, @OrganizationId, 'HOA Fee - Property', 'HOA', 1050.00, DATEADD(MONTH, -3, @CurrentDate), 'HOA Management Company', 'ACH', 1, 1, 1, DATEADD(MONTH, -3, @CurrentDate), DATEADD(MONTH, -3, @CurrentDate), DATEADD(MONTH, -3, @CurrentDate), DATEADD(MONTH, -3, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, NULL, @OrganizationId, 'HOA Fee - Property', 'HOA', 1050.00, DATEADD(MONTH, -2, @CurrentDate), 'HOA Management Company', 'ACH', 1, 1, 1, DATEADD(MONTH, -2, @CurrentDate), DATEADD(MONTH, -2, @CurrentDate), DATEADD(MONTH, -2, @CurrentDate), DATEADD(MONTH, -2, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, NULL, @OrganizationId, 'HOA Fee - Property', 'HOA', 1050.00, DATEADD(MONTH, -1, @CurrentDate), 'HOA Management Company', 'ACH', 1, 1, 1, DATEADD(MONTH, -1, @CurrentDate), DATEADD(MONTH, -1, @CurrentDate), DATEADD(MONTH, -1, @CurrentDate), DATEADD(MONTH, -1, @CurrentDate), NULL);

    PRINT 'Created 6 HOA expense records for Property (property-level)';

    -- 3. Create random expenses for Unit 160
    INSERT INTO Expenses (
        LandlordId,
        PropertyId,
        UnitId,
        OrganizationId,
        Name,
        Category,
        Amount,
        ExpenseDate,
        Vendor,
        PaymentMethod,
        IsRecurring,
        IsTaxDeductible,
        IsPaid,
        PaidDate,
        BillDate,
        DueDate,
        CreatedAt,
        UpdatedAt
    )
    VALUES
        -- Unit 160 - Random expenses
        (@LandlordId, @PropertyId, @UnitId1, @OrganizationId, 'Plumbing Repair - Kitchen Sink', 'Repairs', 285.50, DATEADD(DAY, -45, @CurrentDate), 'ABC Plumbing Services', 'Credit Card', 0, 1, 1, DATEADD(DAY, -45, @CurrentDate), DATEADD(DAY, -47, @CurrentDate), DATEADD(DAY, -45, @CurrentDate), DATEADD(DAY, -47, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId1, @OrganizationId, 'HVAC Maintenance', 'Maintenance', 150.00, DATEADD(DAY, -30, @CurrentDate), 'Cool Air HVAC', 'Check', 0, 1, 1, DATEADD(DAY, -30, @CurrentDate), DATEADD(DAY, -32, @CurrentDate), DATEADD(DAY, -30, @CurrentDate), DATEADD(DAY, -32, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId1, @OrganizationId, 'Monthly Water Bill', 'Utilities', 85.25, DATEADD(DAY, -20, @CurrentDate), 'City Water Department', 'ACH', 0, 1, 1, DATEADD(DAY, -20, @CurrentDate), DATEADD(DAY, -25, @CurrentDate), DATEADD(DAY, -20, @CurrentDate), DATEADD(DAY, -25, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId1, @OrganizationId, 'Deep Cleaning Service', 'Cleaning', 200.00, DATEADD(DAY, -15, @CurrentDate), 'Sparkle Clean Services', 'Cash', 0, 1, 1, DATEADD(DAY, -15, @CurrentDate), DATEADD(DAY, -17, @CurrentDate), DATEADD(DAY, -15, @CurrentDate), DATEADD(DAY, -17, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId1, @OrganizationId, 'Paint Touch-up - Living Room', 'Maintenance', 125.00, DATEADD(DAY, -10, @CurrentDate), 'Pro Painters Inc', 'Credit Card', 0, 1, 1, DATEADD(DAY, -10, @CurrentDate), DATEADD(DAY, -12, @CurrentDate), DATEADD(DAY, -10, @CurrentDate), DATEADD(DAY, -12, @CurrentDate), NULL);

    PRINT 'Created 5 random expense records for Unit 160';

    -- 4. Create random expenses for Unit 161
    INSERT INTO Expenses (
        LandlordId,
        PropertyId,
        UnitId,
        OrganizationId,
        Name,
        Category,
        Amount,
        ExpenseDate,
        Vendor,
        PaymentMethod,
        IsRecurring,
        IsTaxDeductible,
        IsPaid,
        PaidDate,
        BillDate,
        DueDate,
        CreatedAt,
        UpdatedAt
    )
    VALUES
        -- Unit 161 - Random expenses
        (@LandlordId, @PropertyId, @UnitId2, @OrganizationId, 'Electrical Repair - Outlet Replacement', 'Repairs', 195.75, DATEADD(DAY, -50, @CurrentDate), 'Safe Electric Co', 'Check', 0, 1, 1, DATEADD(DAY, -50, @CurrentDate), DATEADD(DAY, -52, @CurrentDate), DATEADD(DAY, -50, @CurrentDate), DATEADD(DAY, -52, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId2, @OrganizationId, 'Landscaping - Lawn Mowing', 'Landscaping', 75.00, DATEADD(DAY, -35, @CurrentDate), 'Green Thumb Landscaping', 'Cash', 0, 1, 1, DATEADD(DAY, -35, @CurrentDate), DATEADD(DAY, -37, @CurrentDate), DATEADD(DAY, -35, @CurrentDate), DATEADD(DAY, -37, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId2, @OrganizationId, 'Monthly Internet Bill', 'Utilities', 65.00, DATEADD(DAY, -25, @CurrentDate), 'FastNet Internet', 'ACH', 0, 1, 1, DATEADD(DAY, -25, @CurrentDate), DATEADD(DAY, -28, @CurrentDate), DATEADD(DAY, -25, @CurrentDate), DATEADD(DAY, -28, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId2, @OrganizationId, 'Appliance Repair - Dishwasher', 'Repairs', 320.00, DATEADD(DAY, -18, @CurrentDate), 'Appliance Fix Pro', 'Credit Card', 0, 1, 1, DATEADD(DAY, -18, @CurrentDate), DATEADD(DAY, -20, @CurrentDate), DATEADD(DAY, -18, @CurrentDate), DATEADD(DAY, -20, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId2, @OrganizationId, 'Carpet Cleaning', 'Cleaning', 150.00, DATEADD(DAY, -8, @CurrentDate), 'Fresh Carpet Cleaners', 'Check', 0, 1, 1, DATEADD(DAY, -8, @CurrentDate), DATEADD(DAY, -10, @CurrentDate), DATEADD(DAY, -8, @CurrentDate), DATEADD(DAY, -10, @CurrentDate), NULL);

    PRINT 'Created 5 random expense records for Unit 161';

    -- 5. Create random expenses for Unit 162
    INSERT INTO Expenses (
        LandlordId,
        PropertyId,
        UnitId,
        OrganizationId,
        Name,
        Category,
        Amount,
        ExpenseDate,
        Vendor,
        PaymentMethod,
        IsRecurring,
        IsTaxDeductible,
        IsPaid,
        PaidDate,
        BillDate,
        DueDate,
        CreatedAt,
        UpdatedAt
    )
    VALUES
        -- Unit 162 - Random expenses
        (@LandlordId, @PropertyId, @UnitId3, @OrganizationId, 'Window Repair - Broken Glass', 'Repairs', 450.00, DATEADD(DAY, -55, @CurrentDate), 'Window Works', 'Credit Card', 0, 1, 1, DATEADD(DAY, -55, @CurrentDate), DATEADD(DAY, -57, @CurrentDate), DATEADD(DAY, -55, @CurrentDate), DATEADD(DAY, -57, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId3, @OrganizationId, 'Monthly Trash Service', 'Utilities', 45.00, DATEADD(DAY, -28, @CurrentDate), 'Waste Management', 'ACH', 0, 1, 1, DATEADD(DAY, -28, @CurrentDate), DATEADD(DAY, -30, @CurrentDate), DATEADD(DAY, -28, @CurrentDate), DATEADD(DAY, -30, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId3, @OrganizationId, 'Gutter Cleaning', 'Maintenance', 120.00, DATEADD(DAY, -22, @CurrentDate), 'Clean Gutters LLC', 'Cash', 0, 1, 1, DATEADD(DAY, -22, @CurrentDate), DATEADD(DAY, -24, @CurrentDate), DATEADD(DAY, -22, @CurrentDate), DATEADD(DAY, -24, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId3, @OrganizationId, 'Drywall Repair - Bathroom', 'Repairs', 180.50, DATEADD(DAY, -12, @CurrentDate), 'Wall Fix Experts', 'Check', 0, 1, 1, DATEADD(DAY, -12, @CurrentDate), DATEADD(DAY, -14, @CurrentDate), DATEADD(DAY, -12, @CurrentDate), DATEADD(DAY, -14, @CurrentDate), NULL),
        (@LandlordId, @PropertyId, @UnitId3, @OrganizationId, 'Property Insurance Payment', 'Insurance', 350.00, DATEADD(DAY, -5, @CurrentDate), 'Secure Insurance Co', 'ACH', 0, 1, 1, DATEADD(DAY, -5, @CurrentDate), DATEADD(DAY, -7, @CurrentDate), DATEADD(DAY, -5, @CurrentDate), DATEADD(DAY, -7, @CurrentDate), NULL);

    PRINT 'Created 5 random expense records for Unit 162';

    COMMIT TRANSACTION;
    PRINT '';
    PRINT '=== RE-SEEDING COMPLETE ===';
    PRINT 'SUCCESS: HOA template and expense records created successfully!';
    PRINT 'Total expenses created: 21 (6 HOA property-level + 5 per unit)';
    PRINT 'RecurringExpense template ID: ' + CAST(@RecurringExpenseId AS NVARCHAR(20));

END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    PRINT '';
    PRINT '=== ERROR OCCURRED ===';
    PRINT 'ERROR: ' + ERROR_MESSAGE();
    PRINT 'Error Number: ' + CAST(ERROR_NUMBER() AS NVARCHAR(20));
    PRINT 'Error Line: ' + CAST(ERROR_LINE() AS NVARCHAR(20));
    THROW;
END CATCH;
