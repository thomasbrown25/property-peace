using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace brownstone_hub_api.Migrations
{
    /// <inheritdoc />
    public partial class AddLifetimeSubscriptionPlan : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                IF NOT EXISTS (SELECT 1 FROM SubscriptionPlans WHERE Name = 'Lifetime Plan')
                BEGIN
                    INSERT INTO SubscriptionPlans
                    (
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
                        StripePriceIdMonthly,
                        StripePriceIdAnnual,
                        StripeProductId,
                        CreatedAt,
                        UpdatedAt
                    )
                    VALUES
                    (
                        'Lifetime Plan',
                        'Internal lifetime premium access plan for admin-assigned accounts.',
                        NULL,
                        NULL,
                        0,
                        0,
                        '[""Unlimited units"", ""Everything in Premium"", ""Lifetime access""]',
                        1,
                        0,
                        NULL,
                        NULL,
                        NULL,
                        NULL,
                        SYSUTCDATETIME(),
                        SYSUTCDATETIME()
                    );
                END
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DELETE FROM SubscriptionPlans
                WHERE Name = 'Lifetime Plan'
                  AND NOT EXISTS (
                      SELECT 1 FROM Subscriptions
                      WHERE SubscriptionPlanId = SubscriptionPlans.Id
                  );
            ");
        }
    }
}
