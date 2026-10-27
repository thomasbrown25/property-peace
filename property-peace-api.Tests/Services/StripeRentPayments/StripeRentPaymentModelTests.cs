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
    public void ChargeIdentityMigration_AddsOnlyNullableColumnToFinancialRentPayments()
    {
        var migration = new TestableChargeIdentityMigration();
        var up = migration.BuildUpOperations();
        var column = up.Should().ContainSingle().Which.Should().BeOfType<AddColumnOperation>().Which;
        column.Name.Should().Be("ChargeId");
        column.Schema.Should().Be("financial");
        column.Table.Should().Be("StripeRentPayments");
        column.IsNullable.Should().BeTrue();
        column.MaxLength.Should().Be(255);
        column.DefaultValue.Should().BeNull();
        column.ColumnType.Should().Be("nvarchar(255)");
        migration.BuildDownOperations().Should().ContainSingle().Which.Should().BeOfType<DropColumnOperation>()
            .Which.Should().Match<DropColumnOperation>(x => x.Name == "ChargeId"
                && x.Schema == "financial" && x.Table == "StripeRentPayments");
    }

    [Fact]
    public void ChargeIdentity_ModelAndSnapshotKeepLegacyRentNullable()
    {
        using var context = StripeRentPaymentFlowTests.CreateContext();
        var entity = context.GetService<IDesignTimeModel>().Model.FindEntityType(typeof(StripeRentPayment));
        entity!.FindProperty(nameof(StripeRentPayment.ChargeId))!.IsNullable.Should().BeTrue();
        entity.FindProperty(nameof(StripeRentPayment.ChargeId))!.GetMaxLength().Should().Be(255);

        var snapshotEntity = new DataContextModelSnapshot().Model.FindEntityType(typeof(StripeRentPayment));
        snapshotEntity.Should().NotBeNull();
        snapshotEntity!.FindProperty(nameof(StripeRentPayment.ChargeId))!.IsNullable.Should().BeTrue();
        snapshotEntity.GetSchema().Should().Be("financial");
        snapshotEntity.GetTableName().Should().Be("StripeRentPayments");
    }

    private sealed class TestableChargeIdentityMigration : AddStripeRentPaymentChargeIdentity
    {
        public IReadOnlyList<MigrationOperation> BuildUpOperations()
        {
            var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
            base.Up(builder);
            return builder.Operations;
        }

        public IReadOnlyList<MigrationOperation> BuildDownOperations()
        {
            var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
            base.Down(builder);
            return builder.Operations;
        }
    }

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
            "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents] AND [DisputeRecoveredAmountCents] <= [AmountCents]");
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

    [Fact]
    public void DisputeRecoveryMigration_AddsDurableRecoveryCountersAndTightensConstraints()
    {
        var operations = new TestableDisputeRecoveryMigration().BuildUpOperations();
        var columns = operations.OfType<AddColumnOperation>()
            .Where(x => x.Table == "StripeRentPayments" && x.Schema == "financial")
            .ToDictionary(x => x.Name);

        columns.Keys.Should().BeEquivalentTo(
            "DisputeRecoveredAmountCents", "DisputeClosedAt", "StripeDisputeStatus");
        columns["DisputeRecoveredAmountCents"].DefaultValue.Should().Be(0L);

        operations.OfType<DropCheckConstraintOperation>().Select(x => x.Name)
            .Should().Contain(["CK_StripeRentPayments_NonnegativeCounters", "CK_StripeRentPayments_LossWithinAmount"]);
        operations.OfType<AddCheckConstraintOperation>()
            .Single(x => x.Name == "CK_StripeRentPayments_LossWithinAmount").Sql
            .Should().Be("[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents] AND [DisputeRecoveredAmountCents] <= [AmountCents]");
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

    private sealed class TestableDisputeRecoveryMigration : HardenStripeRentDisputeRecovery
    {
        public IReadOnlyList<MigrationOperation> BuildUpOperations()
        {
            var builder = new MigrationBuilder("Microsoft.EntityFrameworkCore.SqlServer");
            base.Up(builder);
            return builder.Operations;
        }
    }
}
