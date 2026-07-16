-- Adds the Premium subscription plan ($14.99/month, $179.90/year).
-- Annual price uses same formula as other plans: (MonthlyPrice * 12) + 0.02
-- Premium includes LeaseShield. Run once.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM subscription.SubscriptionPlans WHERE Name = 'Premium')
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
        'Premium',
        'LeaseShield and premium features for landlords who want legal guidance from government sources.',
        NULL,
        NULL,
        14.99,
        179.90,  -- (14.99 * 12) + 0.02
        '["LeaseShield", "Lease & state law Q&A from government sources only", "All Core Features", "Email Support"]',
        1,
        0,
        NULL,
        GETUTCDATE(),
        GETUTCDATE()
    );
    PRINT 'Added Premium plan.';
END
ELSE
    PRINT 'Premium plan already exists.';
