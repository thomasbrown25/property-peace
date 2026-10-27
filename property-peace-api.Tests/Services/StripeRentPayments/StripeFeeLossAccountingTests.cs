using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeFeeLossAccountingTests
{
    private static StripeRentLossAccountingService Service(Data.DataContext db) =>
        new(db, Mock.Of<ILogger<StripeRentLossAccountingService>>());

    private static async Task<StripeRentPayment> SeedFee(Data.DataContext db, long refund = 0, long dispute = 0,
        bool chargeIdentity = true)
    {
        var aggregate = await StripeRentLossAccountingTests.SeedCompletedPaymentAsync(db, refund, dispute);
        if (chargeIdentity) aggregate.ChargeId = "fee:19";
        db.Accounts.Add(new Account { Id = 440, OrganizationId = 2, AccountCode = "4400",
            AccountName = "Fee income", AccountType = brownstone_hub_api.Enums.EAccountType.Income });
        (await db.GeneralLedgerEntries.SingleAsync()).AccountId = 440;
        db.LeaseFees.Add(new LeaseFee { Id = 19, LeaseId = 1, OrganizationId = 2,
            Name = "Pet fee", Amount = 100m, DueDate = DateTime.UtcNow });
        (await db.Payments.SingleAsync()).FeeId = 19;
        await db.SaveChangesAsync();
        return aggregate;
    }

    [Theory]
    [InlineData(3000L, "PartiallyRefunded", -30)]
    [InlineData(10000L, "Refunded", -100)]
    public async Task Refund_ReopensFeeNotRent_AndReversesOriginalFeeAccount(long cents, string status, decimal expected)
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await SeedFee(db, refund: cents);
        var service = Service(db);
        var beforeRent = await Utils.RentCalculator.GetOutstandingForTenantAsync(db, 1);
        var now = DateTimeOffset.UtcNow;
        await service.ApplyAsync(new("pi_loss", StripeRentPaymentBlockKind.Refund, now));
        await service.ApplyAsync(new("pi_loss", StripeRentPaymentBlockKind.Refund, now));
        (await db.Payments.SingleAsync(p => p.Amount > 0)).Status.Should().Be(status);
        var loss = await db.Payments.SingleAsync(p => p.Amount < 0);
        loss.Amount.Should().Be(expected);
        loss.FeeId.Should().Be(19);
        loss.DepositId.Should().BeNull();
        loss.LeaseId.Should().Be(1);
        loss.OrganizationId.Should().Be(2);
        loss.StripePaymentIntentId.Should().Be("pi_loss");
        var gl = await db.GeneralLedgerEntries.SingleAsync(e => e.TransactionType == "PaymentLossReversal");
        gl.AccountId.Should().Be((await db.GeneralLedgerEntries.SingleAsync(e => e.TransactionType == "Payment")).AccountId);
        gl.OrganizationId.Should().Be(2);
        gl.Amount.Should().Be(expected);
        (await Utils.RentCalculator.GetOutstandingForTenantAsync(db, 1)).Should().Be(beforeRent);
        (brownstone_hub_api.Services.Payments.FeeCollection.Credited(await db.Payments.Where(p => p.FeeId == 19).ToListAsync()))
            .Should().Be(100m + expected);
    }

    [Fact]
    public async Task DisputeRecovery_WithOverlappingRefund_PreservesFeeIdentityAndTransferRisk()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        var aggregate = await SeedFee(db, refund: 3000);
        aggregate.StripeTransferId = "tr_in_flight";
        aggregate.ReversalTargetAmountCents = 10000;
        aggregate.ReversalIncrementAmountCents = 7000;
        await db.SaveChangesAsync();
        var service = Service(db);
        await service.ApplyDisputeCreatedAsync(new("pi_loss", "ch_loss", "dp_fee", 8000,
            DateTimeOffset.UtcNow, "dispute"));
        await service.ApplyDisputeCreatedAsync(new("pi_loss", "ch_loss", "dp_fee", 8000,
            DateTimeOffset.UtcNow, "dispute"));
        (await db.Payments.Where(p => p.Amount < 0).SumAsync(p => p.Amount)).Should().Be(-100m);
        aggregate.Status.Should().Be(StripeRentPaymentStatus.ReversalPending);
        await service.RecoverWonDisputeAsync("pi_loss", "ch_loss", "dp_fee", 8000, "usd", DateTimeOffset.UtcNow);
        await service.RecoverWonDisputeAsync("pi_loss", "ch_loss", "dp_fee", 8000, "usd", DateTimeOffset.UtcNow);
        db.ChangeTracker.Clear();
        aggregate = await db.StripeRentPayments.SingleAsync();
        aggregate.Status.Should().Be(StripeRentPaymentStatus.RecoveryFailed);
        aggregate.ReversalTargetAmountCents.Should().Be(10000);
        aggregate.ReversalIncrementAmountCents.Should().Be(7000);
        aggregate.StripeTransferId.Should().Be("tr_in_flight");
        var adjustments = await db.Payments.Where(p => p.Method == "Stripe loss adjustment"
            || p.Method == "Stripe dispute recovery adjustment").ToListAsync();
        adjustments.Should().HaveCount(2);
        adjustments.Should().OnlyContain(p => p.FeeId == 19 && p.OrganizationId == 2 && p.DepositId == null);
        adjustments.Sum(p => p.Amount).Should().Be(-30m);
        (await db.GeneralLedgerEntries.Where(e => e.TransactionType == "PaymentLossReversal"
            || e.TransactionType == "PaymentLossRecovery").SumAsync(e => e.Amount)).Should().Be(-30m);
        (await db.Payments.SingleAsync(p => p.Amount == 100m)).Status.Should().Be("PartiallyRefunded");
    }

    [Fact]
    public async Task RefundAfterWonDispute_DoesNotMistakeRecoveryRowForSecondOriginal()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        var aggregate = await SeedFee(db, dispute: 5000);
        aggregate.StripeDisputeId = "dp_fee";
        await db.SaveChangesAsync();
        var service = Service(db);
        await service.ApplyAsync(new("pi_loss", StripeRentPaymentBlockKind.Dispute, DateTimeOffset.UtcNow));
        await service.RecoverWonDisputeAsync("pi_loss", "ch_loss", "dp_fee", 5000, "usd", DateTimeOffset.UtcNow);
        aggregate.RefundedAmountCents = 3000;
        await db.SaveChangesAsync();
        await service.ApplyAsync(new("pi_loss", StripeRentPaymentBlockKind.Refund, DateTimeOffset.UtcNow));
        var rows = await db.Payments.Where(p => p.FeeId == 19).ToListAsync();
        brownstone_hub_api.Services.Payments.FeeCollection.Credited(rows).Should().Be(70m);
        rows.Should().HaveCount(4);
    }

    [Fact]
    public async Task LegacyNullCharge_FeeOnOriginalStillReconciles()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await SeedFee(db, refund: 5000, chargeIdentity: false);
        await Service(db).ApplyAsync(new("pi_loss", StripeRentPaymentBlockKind.Refund, DateTimeOffset.UtcNow));
        (await db.Payments.SingleAsync(p => p.Amount == -50m)).FeeId.Should().Be(19);
    }

    [Fact]
    public async Task ChargeAndOriginalFeeOrOrganizationMismatch_FailsWithoutAccounting()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        var aggregate = await SeedFee(db, refund: 3000);
        aggregate.ChargeId = "fee:20";
        await db.SaveChangesAsync();
        await ((Func<Task>)(() => Service(db).ApplyAsync(new("pi_loss", StripeRentPaymentBlockKind.Refund, DateTimeOffset.UtcNow))))
            .Should().ThrowAsync<InvalidOperationException>();
        aggregate.ChargeId = "fee:19";
        (await db.Payments.SingleAsync()).OrganizationId = 99;
        await db.SaveChangesAsync();
        await ((Func<Task>)(() => Service(db).ApplyAsync(new("pi_loss", StripeRentPaymentBlockKind.Refund, DateTimeOffset.UtcNow))))
            .Should().ThrowAsync<InvalidOperationException>();
        (await db.Payments.CountAsync()).Should().Be(1);
        (await db.GeneralLedgerEntries.CountAsync(e => e.TransactionType == "PaymentLossReversal")).Should().Be(0);
    }
}
