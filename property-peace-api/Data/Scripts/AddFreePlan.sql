-- Adds the Free subscription plan for tenants (LeaseShield requires Premium upgrade).
-- Run once. Required for tenant registration (EnsureTenantFreeSubscriptionAsync).

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM subscription.SubscriptionPlans WHERE Name = 'Free')
BEGIN
    INSERT INTO subscription.SubscriptionPlans (
        Name,
        Description,
        MaxProperties,
        MaxTotalUnits,
        MonthlyPrice,
        AnnualPrice,
        Features,
        IsActive,
        IsTrial,
        TrialDays,
        CreatedAt,
        UpdatedAt
    )
    VALUES (
        'Free',
        'Free tier for tenants. Upgrade to Premium for LeaseShield.',
        NULL,
        NULL,
        0,
        0,
        '["Basic access", "Upgrade to Premium for LeaseShield"]',
        1,
        0,
        NULL,
        GETUTCDATE(),
        GETUTCDATE()
    );
    PRINT 'Added Free plan.';
END
ELSE
    PRINT 'Free plan already exists.';
