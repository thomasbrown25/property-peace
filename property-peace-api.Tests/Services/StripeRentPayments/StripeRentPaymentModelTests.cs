using brownstone_hub_api.Migrations;
using brownstone_hub_api.Models;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeRentPaymentModelTests
{
    [Fact]
    public void FinancialCounters_AreProtectedByDatabaseCheckConstraints()
    {
        using var context = StripeRentPaymentFlowTests.CreateContext();
        var model = context.GetService<IDesignTimeModel>().Model;
        var entity = model.FindEntityType(typeof(StripeRentPayment));

        entity.Should().NotBeNull();
        var constraintNames = entity!.GetCheckConstraints().Select(x => x.Name).ToList();
        constraintNames.Should().Contain("CK_StripeRentPayments_PositiveAmount");
        constraintNames.Should().Contain("CK_StripeRentPayments_NonnegativeCounters");
        constraintNames.Should().Contain("CK_StripeRentPayments_LossWithinAmount");
        constraintNames.Should().Contain("CK_StripeRentPayments_ReversalWithinAmount");
    }

    [Fact]
    public void LossConstraint_AllowsRefundAndDisputeOverlapByBoundingCountersIndependently()
    {
        using var context = StripeRentPaymentFlowTests.CreateContext();
        var model = context.GetService<IDesignTimeModel>().Model;
        var entity = model.FindEntityType(typeof(StripeRentPayment));

        var constraint = entity!.GetCheckConstraints()
            .Single(x => x.Name == "CK_StripeRentPayments_LossWithinAmount");

        constraint.Sql.Should().Be(
            "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents]");
    }

    [Fact]
    public void CreationMigration_LossConstraintAllowsRefundAndDisputeOverlap()
    {
        var createTable = new TestableCreationMigration().BuildUpOperations()
            .OfType<CreateTableOperation>()
            .Single(x => x.Name == "StripeRentPayments");
        var constraint = createTable.CheckConstraints
            .Single(x => x.Name == "CK_StripeRentPayments_LossWithinAmount");

        constraint.Sql.Should().Be(
            "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents]");
    }

    [Fact]
    public void RiskControlsUpgradeMigration_ReplacesPreviouslyAppliedCombinedLossConstraint()
    {
        var operations = new TestableRiskControlsMigration().BuildUpOperations();

        operations.OfType<DropCheckConstraintOperation>()
            .Should().ContainSingle(x => x.Name == "CK_StripeRentPayments_LossWithinAmount"
                && x.Table == "StripeRentPayments" && x.Schema == "financial");
        operations.OfType<AddCheckConstraintOperation>()
            .Should().ContainSingle(x => x.Name == "CK_StripeRentPayments_LossWithinAmount"
                && x.Table == "StripeRentPayments" && x.Schema == "financial"
                && x.Sql == "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents]");
    }

    private sealed class TestableCreationMigration : AddSeparateChargesDelayedRentTransfers
    {
        public IReadOnlyList<MigrationOperation> BuildUpOperations()
        {
            var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
            base.Up(builder);
            return builder.Operations;
        }
    }

    private sealed class TestableRiskControlsMigration : AddStripeConnectedPayeeRiskControls
    {
        public IReadOnlyList<MigrationOperation> BuildUpOperations()
        {
            var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
            base.Up(builder);
            return builder.Operations;
        }
    }
}
