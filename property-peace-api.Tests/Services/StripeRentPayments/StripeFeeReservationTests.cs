using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.StripeRentPayments;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.StripeRentPayments;

public sealed class StripeFeeReservationTests
{
    private static Mock<IStripeRentGateway> Gateway()
    {
        var gateway = new Mock<IStripeRentGateway>();
        gateway.Setup(g => g.CreatePaymentIntentAsync(It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((StripeRentIntentRequest request, CancellationToken _) =>
                new StripeRentIntentResult(request.IdempotencyKey == "rent-payment:fee_op"
                    ? "pi_fee" : $"pi_{request.IdempotencyKey}", "secret"));
        gateway.Setup(g => g.UpdatePaymentIntentAsync(It.IsAny<string>(), It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new StripeRentIntentResult("pi_fee", "secret"));
        return gateway;
    }

    private static CreateStripeRentPaymentCommand Command(string operation = "fee_op", long amount = 5000,
        string charge = "fee:19", long lease = 44, long org = 9) =>
        new(lease, org, 7, operation, amount, "usd", "acct_snapshot", null, ChargeId: charge);

    private static async Task Seed(DataContext db, long feeLease = 44, long feeOrg = 9, decimal feeAmount = 100m)
    {
        await StripeRentPaymentFlowTests.SeedLeaseAsync(db, 44, 9);
        db.LeaseFees.Add(new LeaseFee { Id = 19, LeaseId = feeLease, OrganizationId = feeOrg,
            Name = "Pet fee", Amount = feeAmount, DueDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }

    [Fact]
    public async Task SameOrgFee_CompletedCreditAndCreatedReservationLimitNewIntent()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db);
        db.Payments.Add(new Payment { LeaseId = 44, OrganizationId = 9, FeeId = 19,
            Amount = 40m, Status = "Completed", PaymentDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var gateway = Gateway();
        var service = StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true);
        await service.CreateAsync(Command(amount: 3500));
        (await db.StripeRentPayments.SingleAsync()).ChargeId.Should().Be("fee:19");
        await service.CreateAsync(Command("second", 2500));
        await ((Func<Task>)(() => service.CreateAsync(Command("third", 50))))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*outstanding balance*");
        gateway.Verify(g => g.CreatePaymentIntentAsync(It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
    }

    [Theory]
    [InlineData(44, 10)]
    [InlineData(45, 9)]
    public async Task ForeignFee_IsDeniedBeforeStripe(long feeLease, long feeOrg)
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db, feeLease, feeOrg);
        var gateway = Gateway();
        await ((Func<Task>)(() => StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true)
            .CreateAsync(Command()))).Should().ThrowAsync<InvalidOperationException>().WithMessage("*authorized lease and organization*");
        gateway.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ConcurrentFeeReservations_CannotOversubscribe()
    {
        var name = Guid.NewGuid().ToString();
        await using (var setup = StripeRentPaymentFlowTests.CreateContext(name)) await Seed(setup, feeAmount: 50m);
        await using var first = StripeRentPaymentFlowTests.CreateContext(name);
        await using var second = StripeRentPaymentFlowTests.CreateContext(name);
        var gateway = Gateway();
        var attempts = await Task.WhenAll(Attempt(first, gateway.Object, Command("one", 3000)),
            Attempt(second, gateway.Object, Command("two", 3000)));
        attempts.Count(x => x).Should().Be(1);
        await using var verify = StripeRentPaymentFlowTests.CreateContext(name);
        (await verify.StripeRentPayments.CountAsync()).Should().Be(1);
        gateway.Verify(g => g.CreatePaymentIntentAsync(It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    private static async Task<bool> Attempt(DataContext db, IStripeRentGateway gateway, CreateStripeRentPaymentCommand command)
    {
        try { await StripeRentPaymentFlowTests.CreateService(db, gateway, true).CreateAsync(command); return true; }
        catch (InvalidOperationException) { return false; }
    }

    [Fact]
    public async Task OverpayMinimumAndEditedFee_RejectedBeforeStripeOnCreateReplayAndUpdate()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db, feeAmount: 50m);
        var gateway = Gateway();
        var service = StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true);
        await ((Func<Task>)(() => service.CreateAsync(Command("over", 5001))))
            .Should().ThrowAsync<InvalidOperationException>();
        await ((Func<Task>)(() => service.CreateAsync(Command("tiny", 49))))
            .Should().ThrowAsync<ArgumentOutOfRangeException>();
        gateway.VerifyNoOtherCalls();
        await service.CreateAsync(Command(amount: 3000));
        var fee = await db.LeaseFees.SingleAsync();
        fee.Amount = 20m;
        await db.SaveChangesAsync();
        await ((Func<Task>)(() => service.CreateAsync(Command(amount: 3000))))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*outstanding balance*");
        await ((Func<Task>)(() => service.UpdateAsync(new("pi_fee", 44, 7, 3000, null, ChargeId: "fee:19"))))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*outstanding balance*");
        gateway.Verify(g => g.CreatePaymentIntentAsync(It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()), Times.Once);
        gateway.Verify(g => g.UpdatePaymentIntentAsync(It.IsAny<string>(), It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ReplayMustMatchChargeAndUpdateExcludesOwnReservation()
    {
        await using var db = StripeRentPaymentFlowTests.CreateContext();
        await Seed(db, feeAmount: 50m);
        var gateway = Gateway();
        var service = StripeRentPaymentFlowTests.CreateService(db, gateway.Object, true);
        await service.CreateAsync(Command(amount: 3000));
        await ((Func<Task>)(() => service.CreateAsync(Command(amount: 3000, charge: "fee:20"))))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*different authorization data*");
        await ((Func<Task>)(() => service.UpdateAsync(new("pi_fee", 44, 7, 3000, null, ChargeId: "fee:20"))))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("*charge*does not match*");
        await service.UpdateAsync(new("pi_fee", 44, 7, 5000, null, ChargeId: "fee:19"));
        (await db.StripeRentPayments.SingleAsync()).AmountCents.Should().Be(5000);
        gateway.Verify(g => g.UpdatePaymentIntentAsync(It.IsAny<string>(), It.IsAny<StripeRentIntentRequest>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
