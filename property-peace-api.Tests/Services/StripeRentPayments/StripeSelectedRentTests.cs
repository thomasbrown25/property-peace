using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Dtos.Payment;
using Microsoft.Extensions.Logging;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeSelectedRentTests
{
    private static string First => $"rent:44:{new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1).AddMonths(-2):yyyy-MM-dd}";
    private static string Second => $"rent:44:{new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1).AddMonths(-1):yyyy-MM-dd}";
    private static CreateStripeRentPaymentCommand Command(string op, string charge, long cents = 5000, long lease = 44, long org = 9) =>
        new(lease, org, 7, op, cents, "usd", "acct_snapshot", null, ChargeId: charge);
    private static Mock<IStripeRentGateway> Gateway()
    {
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(g => g.CreatePaymentIntentAsync(It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeRentIntentRequest request, CancellationToken _) => new StripeRentIntentResult("pi_" + request.IdempotencyKey, "secret"));
        gateway.Setup(g => g.UpdatePaymentIntentAsync(It.IsAny<string>(), It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((string id, StripeRentIntentRequest _, CancellationToken _) => new StripeRentIntentResult(id, "secret"));
        return gateway;
    }
    private static async Task Seed(DataContext db)
    {
        await StripeRentPaymentFlowTests.SeedLeaseAsync(db, 44, 9, 100m);
        var lease = await db.Leases.SingleAsync();
        lease.StartDate = new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1).AddMonths(-2);
        lease.EndDate = lease.StartDate.Value.AddYears(1).AddDays(-1);
        lease.RentDueDay = 1;
        db.Organizations.Add(new Organization { Id = 9, IsActive = true });
        db.Properties.Add(new Property { Id = 20044, OrganizationId = 9 });
        await db.SaveChangesAsync();
    }
    [Fact]
    public async Task FirstPartial_ThenSecondOnlyAfterFirstPaid_AndAdvanceCreditCannotBeRebilled()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        var gateway = Gateway();
        var service = StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true);
        await ((Func<Task>)(() => service.CreateAsync(Command("second_early", Second))))
            .Should().ThrowAsync<InvalidOperationException>();
        await service.CreateAsync(Command("first", First));
        await service.CreateAsync(Command("first_more", First));
        await ((Func<Task>)(() => service.CreateAsync(Command("oversubscribed", First, 50))))
            .Should().ThrowAsync<InvalidOperationException>();
        await ((Func<Task>)(() => service.CreateAsync(Command("second_reserved", Second))))
            .Should().ThrowAsync<InvalidOperationException>();
        (await db.StripeRentPayments.CountAsync()).Should().Be(2);
        db.Payments.Add(new Payment { LeaseId = 44, OrganizationId = 9, Amount = 100m, Status = "Completed", PaymentDate = DateTime.Today });
        (await db.StripeRentPayments.ToListAsync()).ForEach(p => p.Status = StripeRentPaymentStatus.Canceled);
        await db.SaveChangesAsync();
        await service.CreateAsync(Command("second", Second));
        await ((Func<Task>)(() => service.CreateAsync(Command("second_over", Second, 5001))))
            .Should().ThrowAsync<InvalidOperationException>();
        db.Payments.Add(new Payment { LeaseId = 44, OrganizationId = 9, Amount = 200m, Status = "Completed", PaymentDate = DateTime.Today });
        await db.SaveChangesAsync();
        await ((Func<Task>)(() => service.CreateAsync(Command("advance", Second))))
            .Should().ThrowAsync<InvalidOperationException>();
    }
    [Fact]
    public async Task ReplayUpdateAndForeignIdentityRemainBound()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        var gateway = Gateway();
        var service = StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true);
        var command = Command("op", First, 5000);
        var created = await service.CreateAsync(command);
        await service.CreateAsync(command);
        await service.UpdateAsync(new(created.PaymentIntentId, 44, 7, 10000, null, ChargeId: First));
        await ((Func<Task>)(() => service.CreateAsync(Command("foreign", First.Replace("rent:44:", "rent:45:")))))
            .Should().ThrowAsync<InvalidOperationException>();
        await ((Func<Task>)(() => service.CreateAsync(Command("wrong_org", First, org: 10))))
            .Should().ThrowAsync<InvalidOperationException>();
        await ((Func<Task>)(() => service.UpdateAsync(new(created.PaymentIntentId, 44, 7, 5000, null, ChargeId: Second))))
            .Should().ThrowAsync<InvalidOperationException>();
        (await db.StripeRentPayments.SingleAsync()).AmountCents.Should().Be(10000);
    }
    [Fact]
    public async Task UnsupportedScheduleAndMalformedDatesFailBeforeStripe()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        var gateway = Gateway();
        var service = StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true);
        foreach (var charge in new[] { "rent:44:2026-2-01", "rent:44:2026-02-30", "rent:45:2026-02-01" })
            await ((Func<Task>)(() => service.CreateAsync(Command("bad_" + charge, charge))))
                .Should().ThrowAsync<InvalidOperationException>();
        (await db.Leases.SingleAsync()).RentFrequency = "Weekly";
        await db.SaveChangesAsync();
        await ((Func<Task>)(() => service.CreateAsync(Command("weekly", First))))
            .Should().ThrowAsync<InvalidOperationException>();
        gateway.VerifyNoOtherCalls();
    }
    [Fact]
    public async Task CurrentMonthAndStaleSelectedRentFailBeforeStripeForCreateAndUpdate()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        var gateway = Gateway();
        var service = StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true);
        var created = await service.CreateAsync(Command("eligible", First));
        gateway.Invocations.Clear();
        var current = $"rent:44:{new DateTime(DateTime.Today.Year, DateTime.Today.Month, 1):yyyy-MM-dd}";
        await ((Func<Task>)(() => service.CreateAsync(Command("current", current))))
            .Should().ThrowAsync<InvalidOperationException>();
        await ((Func<Task>)(() => service.UpdateAsync(new(created.PaymentIntentId, 44, 7, 5000, null, ChargeId: current))))
            .Should().ThrowAsync<InvalidOperationException>();
        db.Payments.Add(new Payment { LeaseId = 44, OrganizationId = 9, Amount = 100m,
            Status = "Completed", PaymentDate = DateTime.Today });
        await db.SaveChangesAsync();
        await ((Func<Task>)(() => service.CreateAsync(Command("stale", First))))
            .Should().ThrowAsync<InvalidOperationException>();
        await ((Func<Task>)(() => service.UpdateAsync(new(created.PaymentIntentId, 44, 7, 5000, null, ChargeId: First))))
            .Should().ThrowAsync<InvalidOperationException>();
        gateway.VerifyNoOtherCalls();
    }
    [Fact]
    public async Task CapturePartialSelectedRentWritesLegacyRentRowExactlyOnce()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        var intent = (await StripeRentPaymentFlowTests.CreateService(db, Gateway().Object, true)
            .CreateAsync(Command("capture", First, 5000))).PaymentIntentId;
        var payments = new Mock<IPaymentService>();
        payments.Setup(x => x.AddPayment(It.IsAny<AddPaymentDto>())).ReturnsAsync((AddPaymentDto dto) =>
        {
            var row = new Payment { LeaseId = dto.LeaseId, OrganizationId = 9, Amount = dto.Amount,
                StripePaymentIntentId = dto.StripePaymentIntentId, Reference = dto.Reference, Status = dto.Status,
                PaymentDate = dto.PaymentDate, FeeId = dto.FeeId, DepositId = dto.DepositId };
            db.Payments.Add(row);
            db.SaveChanges();
            db.GeneralLedgerEntries.Add(new GeneralLedgerEntry { OrganizationId = 9, AccountId = 1,
                TransactionId = row.Id, TransactionType = "Payment", Amount = dto.Amount });
            db.SaveChanges();
            return ServiceResponse<List<LoadPaymentDto>>.CreateSuccess([]);
        });
        var allocation = new StripeRentAllocationService(db, payments.Object, Mock.Of<ILogger<StripeRentAllocationService>>());
        var command = new StripeRentAllocationCommand(
            new(intent, "ch_capture", 5000, "usd", 44, 9, 7, "capture", DateTime.UtcNow), null, "card", DateTimeOffset.UtcNow);
        await allocation.AllocateAsync(command);
        await allocation.AllocateAsync(command);
        (await db.Payments.SingleAsync()).FeeId.Should().BeNull();
        (await db.Payments.SingleAsync()).Amount.Should().Be(50m);
        payments.Verify(x => x.AddPayment(It.IsAny<AddPaymentDto>()), Times.Once);
    }
    [Fact]
    public async Task CaptureRejectsStaleSelectedRentWithoutMisattributingReceipt()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        var intent = (await StripeRentPaymentFlowTests.CreateService(db, Gateway().Object, true)
            .CreateAsync(Command("stale", First, 5000))).PaymentIntentId;
        db.Payments.Add(new Payment { LeaseId = 44, OrganizationId = 9, Amount = 100m,
            Status = "Completed", PaymentDate = DateTime.Today });
        await db.SaveChangesAsync();
        var payments = new Mock<IPaymentService>();
        var allocation = new StripeRentAllocationService(db, payments.Object, Mock.Of<ILogger<StripeRentAllocationService>>());
        var authority = new StripeRentPaymentSettlementAuthority(intent, "ch_stale", 5000, "usd", 44, 9, 7, "stale", DateTime.UtcNow);
        await ((Func<Task>)(() => allocation.AllocateAsync(new(authority, null, "card", DateTimeOffset.UtcNow))))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*oldest unpaid*");
        payments.Verify(x => x.AddPayment(It.IsAny<brownstone_hub_api.Dtos.Payment.AddPaymentDto>()), Times.Never);
        (await db.StripeRentPayments.SingleAsync()).AllocationCompletedAt.Should().BeNull();
    }
    [Fact]
    public async Task LegacyRentReservationReducesSelectedAvailableBalance()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        db.StripeRentPayments.Add(new StripeRentPayment { OperationId = "legacy", PaymentIntentId = "pi_legacy",
            LeaseId = 44, OrganizationId = 9, TenantUserId = 7, AmountCents = 6000,
            Currency = "usd", DestinationStripeAccountId = "acct_snapshot", Status = StripeRentPaymentStatus.Created });
        await db.SaveChangesAsync();
        var gateway = Gateway();
        await ((Func<Task>)(() => StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true)
            .CreateAsync(Command("selected", First, 5000))))
            .Should().ThrowAsync<InvalidOperationException>();
        gateway.VerifyNoOtherCalls();
    }
    [Fact]
    public async Task FeeAndRentReservationsOnSameLease_DoNotConsumeEachOthersBalance()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        db.LeaseFees.Add(new LeaseFee { Id = 19, LeaseId = 44, OrganizationId = 9,
            Name = "Pet fee", Amount = 100m, DueDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var service = StripeRentPaymentFlowTests.CreateService(db, Gateway().Object, true);
        await service.CreateAsync(Command("fee", "fee:19", 10000));
        await service.CreateAsync(Command("rent", First, 10000));
        await ((Func<Task>)(() => service.CreateAsync(Command("rent_extra", First, 50))))
            .Should().ThrowAsync<InvalidOperationException>();
        await ((Func<Task>)(() => service.CreateAsync(Command("fee_extra", "fee:19", 50))))
            .Should().ThrowAsync<InvalidOperationException>();
        (await db.StripeRentPayments.CountAsync()).Should().Be(2);
    }

    [Fact]
    public async Task FeeReservationDoesNotConsumeLegacyRentBalance()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        db.LeaseFees.Add(new LeaseFee { Id = 19, LeaseId = 44, OrganizationId = 9,
            Name = "Pet fee", Amount = 100m, DueDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var service = StripeRentPaymentFlowTests.CreateService(db, Gateway().Object, true);
        var rentBalance = await brownstone_hub_api.Utils.RentCalculator.GetOutstandingForTenantAsync(db, 44);
        await service.CreateAsync(Command("fee", "fee:19", 10000));
        await service.CreateAsync(Command("legacy", null!, checked((long)(rentBalance * 100m))));
        (await db.StripeRentPayments.CountAsync()).Should().Be(2);
    }
    [Fact]
    public async Task ConcurrentReservationsCannotOversubscribeInstallment()
    {
        var name = Guid.NewGuid().ToString();
        await using (var seed = StripeRentPaymentFlowTests.CreateContext(name)) await Seed(seed);
        await using var first = StripeRentPaymentFlowTests.CreateContext(name);
        await using var second = StripeRentPaymentFlowTests.CreateContext(name);
        var gateway = Gateway();
        async Task<bool> Attempt(DataContext db, string op)
        {
            try { await StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true).CreateAsync(Command(op, First, 6000)); return true; }
            catch (InvalidOperationException) { return false; }
        }
        (await Task.WhenAll(Attempt(first, "one"), Attempt(second, "two"))).Count(x => x).Should().Be(1);
    }
}
