using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.AccountMappingService;
using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Payments;

public sealed class ManualFeeEditReservationTests : IDisposable
{
    private readonly Data.DataContext db = DbContextFactory.Create();
    private readonly Mock<IPaymentRepository> repo = new();
    private readonly Mock<IAccountMappingService> mapping = new();
    private readonly Mock<IGeneralLedgerService> ledger = new();
    private PaymentService Service() => new(repo.Object, mapping.Object, ledger.Object, db, Mock.Of<ILogger<PaymentService>>());
    public void Dispose() => db.Dispose();

    private async Task Seed(string status = "Failed", decimal amount = 30, StripeRentPaymentStatus? reservation = null)
    {
        db.Properties.Add(new Property { Id = 1, Name = "Home", OrganizationId = 10 });
        db.Units.Add(new Unit { Id = 1, Name = "Unit", PropertyId = 1 });
        db.Leases.Add(new Lease { Id = 1, UnitId = 1, OrganizationId = 10 });
        db.LeaseFees.Add(new LeaseFee { Id = 4, LeaseId = 1, OrganizationId = 10, Name = "Fee", Amount = 100, DueDate = DateTime.UtcNow });
        db.Payments.Add(new Payment { Id = 8, LeaseId = 1, OrganizationId = 10, FeeId = 4, Status = status, Amount = amount, PaymentDate = DateTime.UtcNow });
        if (reservation.HasValue) db.StripeRentPayments.Add(new StripeRentPayment { Id = 12, LeaseId = 1, OrganizationId = 10, ChargeId = "fee:4", AmountCents = 8000, Status = reservation.Value, OperationId = "op", PaymentIntentId = "pi" });
        await db.SaveChangesAsync();
    }

    [Theory]
    [InlineData(StripeRentPaymentStatus.Created)]
    [InlineData(StripeRentPaymentStatus.Processing)]
    public async Task FailedToCompleted_CannotConsumeReservedFee_OrReplay(StripeRentPaymentStatus reservation)
    {
        await Seed(reservation: reservation);
        for (var i = 0; i < 2; i++)
        {
            var result = await Service().UpdatePayment(8, new UpdatePaymentDto { Status = "Completed" }, 10);
            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(409);
        }
        repo.Verify(r => r.UpdatePayment(It.IsAny<long>(), It.IsAny<UpdatePaymentDto>(), It.IsAny<long>()), Times.Never);
        db.Payments.Local.Single(p => p.Id == 8).Status.Should().Be("Failed");
    }

    [Fact]
    public async Task CompletedAmountIncrease_CannotConsumeReservation_ButReferenceEditCanProceed()
    {
        await Seed("Completed", 20, StripeRentPaymentStatus.Created);
        var increased = await Service().UpdatePayment(8, new UpdatePaymentDto { Amount = 30 }, 10);
        increased.StatusCode.Should().Be(409);
        repo.Verify(r => r.UpdatePayment(It.IsAny<long>(), It.IsAny<UpdatePaymentDto>(), It.IsAny<long>()), Times.Never);
        var reference = new UpdatePaymentDto { Reference = "check 1" };
        repo.Setup(r => r.UpdatePayment(8, reference, 10)).ReturnsAsync(new LoadPaymentDto { Id = 8, LeaseId = 1, FeeId = 4, Amount = 20, Status = "Completed" });
        mapping.Setup(m => m.GetFeeIncomeAccountAsync(10)).ReturnsAsync(new Account { Id = 44, OrganizationId = 10, AccountCode = "4400", AccountType = EAccountType.Income });
        ledger.Setup(l => l.CreateLedgerEntryAsync(10, 44, 8, "Payment", 20, It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(new ServiceResponse<brownstone_hub_api.Dtos.GeneralLedger.LoadGeneralLedgerEntryDto>());
        (await Service().UpdatePayment(8, reference, 10)).Success.Should().BeTrue();
    }

    [Fact]
    public async Task FeeCap_AccountsForSignedCredits_ExcludesEditedPayment_AndRejectsExcess()
    {
        await Seed("Completed", 30);
        db.Payments.AddRange(
            new Payment { Id = 9, LeaseId = 1, OrganizationId = 10, FeeId = 4, Status = "Completed", Amount = 70, PaymentDate = DateTime.UtcNow },
            new Payment { Id = 10, LeaseId = 1, OrganizationId = 10, FeeId = 4, Status = "Completed", Amount = -20, Method = "Stripe loss adjustment", PaymentDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var result = await Service().UpdatePayment(8, new UpdatePaymentDto { Amount = 51 }, 10);
        result.StatusCode.Should().Be(409);
        repo.Verify(r => r.UpdatePayment(It.IsAny<long>(), It.IsAny<UpdatePaymentDto>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task FeeCap_AllowsExactNetOutstandingAmount_WithoutCountingSelfTwice()
    {
        await Seed("Completed", 30);
        db.Payments.AddRange(
            new Payment { Id = 9, LeaseId = 1, OrganizationId = 10, FeeId = 4, Status = "Completed", Amount = 70, PaymentDate = DateTime.UtcNow },
            new Payment { Id = 10, LeaseId = 1, OrganizationId = 10, FeeId = 4, Status = "Completed", Amount = -20, Method = "Stripe loss adjustment", PaymentDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var update = new UpdatePaymentDto { Amount = 50 };
        repo.Setup(r => r.UpdatePayment(8, update, 10)).ReturnsAsync(() =>
        {
            db.Payments.Local.Single(p => p.Id == 8).Amount = 50;
            return new LoadPaymentDto { Id = 8, LeaseId = 1, FeeId = 4, Status = "Completed", Amount = 50 };
        });
        mapping.Setup(m => m.GetFeeIncomeAccountAsync(10)).ReturnsAsync(new Account
            { Id = 44, OrganizationId = 10, AccountCode = "4400", AccountType = EAccountType.Income });
        ledger.Setup(l => l.CreateLedgerEntryAsync(10, 44, 8, "Payment", 50, It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(new ServiceResponse<brownstone_hub_api.Dtos.GeneralLedger.LoadGeneralLedgerEntryDto>());
        (await Service().UpdatePayment(8, update, 10)).Success.Should().BeTrue();
        repo.Verify(r => r.UpdatePayment(8, update, 10), Times.Once);
    }

    [Fact]
    public async Task ForeignFeeOnPayment_FailsClosedBeforeRepository()
    {
        await Seed();
        db.LeaseFees.Add(new LeaseFee { Id = 5, LeaseId = 999, OrganizationId = 99, Name = "Foreign", Amount = 100, DueDate = DateTime.UtcNow });
        db.Payments.Local.Single(p => p.Id == 8).FeeId = 5;
        await db.SaveChangesAsync();
        var result = await Service().UpdatePayment(8, new UpdatePaymentDto { Status = "Completed" }, 10);
        result.StatusCode.Should().Be(403);
        repo.Verify(r => r.UpdatePayment(It.IsAny<long>(), It.IsAny<UpdatePaymentDto>(), It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task NonFeeEdit_DoesNotUseFeeBalanceGuard()
    {
        await Seed();
        db.Payments.Local.Single(p => p.Id == 8).FeeId = null;
        await db.SaveChangesAsync();
        var update = new UpdatePaymentDto { Status = "Failed", Reference = "retry" };
        repo.Setup(r => r.UpdatePayment(8, update, 10)).ReturnsAsync(new LoadPaymentDto { Id = 8, LeaseId = 1, Status = "Failed" });
        (await Service().UpdatePayment(8, update, 10)).Success.Should().BeTrue();
        repo.Verify(r => r.UpdatePayment(8, update, 10), Times.Once);
    }
}
