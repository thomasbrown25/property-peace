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

public sealed class ManualPaymentFinanceRegressionTests : IDisposable
{
    private readonly Data.DataContext db = DbContextFactory.Create();
    private readonly Mock<IPaymentRepository> repo = new();
    private readonly Mock<IAccountMappingService> mapping = new();
    private readonly Mock<IGeneralLedgerService> ledger = new();
    private PaymentService Service() => new(repo.Object, mapping.Object, ledger.Object, db, Mock.Of<ILogger<PaymentService>>());
    public void Dispose() => db.Dispose();

    private async Task Seed(bool fee = true)
    {
        db.Properties.Add(new Property { Id = 1, Name = "One", OrganizationId = 10 });
        db.Units.Add(new Unit { Id = 1, Name = "One", PropertyId = 1 });
        db.Leases.Add(new Lease { Id = 1, UnitId = 1, OrganizationId = 10 });
        if (fee) db.LeaseFees.Add(new LeaseFee { Id = 4, LeaseId = 1, OrganizationId = 10, Name = "Pet fee", Amount = 100, DueDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
    }

    [Theory]
    [InlineData(StripeRentPaymentStatus.Created)]
    [InlineData(StripeRentPaymentStatus.Processing)]
    public async Task ManualFee_CannotRaceActiveOnlineReservation_OrReplay(StripeRentPaymentStatus status)
    {
        await Seed();
        db.StripeRentPayments.Add(new StripeRentPayment { Id = 12, LeaseId = 1, OrganizationId = 10,
            ChargeId = "fee:4", AmountCents = 8000, Status = status, OperationId = "op-12", PaymentIntentId = "pi-12" });
        await db.SaveChangesAsync();
        var request = new AddPaymentDto { LeaseId = 1, FeeId = 4, Amount = 30 };
        for (var attempt = 0; attempt < 2; attempt++)
        {
            var result = await Service().AddManualPayment(request, 10);
            result.Success.Should().BeFalse();
            result.StatusCode.Should().Be(409);
        }
        repo.Verify(r => r.AddPaymentWithIdentity(It.IsAny<AddPaymentDto>()), Times.Never);
        ledger.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task AddPayment_PostsExactInsertedId_NotHigherIdFromConcurrentHistory()
    {
        await Seed(false);
        var request = new AddPaymentDto { LeaseId = 1, Amount = 25 };
        var inserted = new LoadPaymentDto { Id = 8, LeaseId = 1, Amount = 25, PaymentDate = DateTime.UtcNow };
        var other = new LoadPaymentDto { Id = 99, LeaseId = 1, Amount = 75, PaymentDate = DateTime.UtcNow };
        repo.Setup(r => r.AddPaymentWithIdentity(request)).ReturnsAsync((inserted, new List<LoadPaymentDto> { other, inserted }));
        mapping.Setup(m => m.GetRentIncomeAccountAsync(10)).ReturnsAsync(new Account
            { Id = 4000, OrganizationId = 10, AccountCode = "4000", AccountType = EAccountType.Income });
        ledger.Setup(l => l.CreateLedgerEntryAsync(10, 4000, 8, "Payment", 25, It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(new ServiceResponse<brownstone_hub_api.Dtos.GeneralLedger.LoadGeneralLedgerEntryDto>());
        (await Service().AddPayment(request)).Success.Should().BeTrue();
        ledger.Verify(l => l.CreateLedgerEntryAsync(10, 4000, 8, "Payment", 25, It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        ledger.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CompletedToFailed_RemovesOnlyItsOwnLedgerEntry_AndReplayIsIdempotent()
    {
        await Seed();
        db.Payments.Add(new Payment { Id = 8, LeaseId = 1, OrganizationId = 10, FeeId = 4,
            Amount = 25, Status = "Completed", PaymentDate = DateTime.UtcNow });
        db.GeneralLedgerEntries.Add(new GeneralLedgerEntry { Id = 18, OrganizationId = 10, AccountId = 4400,
            TransactionId = 8, TransactionType = "Payment", Amount = 25 });
        db.GeneralLedgerEntries.Add(new GeneralLedgerEntry { Id = 19, OrganizationId = 10, AccountId = 4400,
            TransactionId = 9, TransactionType = "Payment", Amount = 75 });
        await db.SaveChangesAsync();
        var update = new UpdatePaymentDto { Status = "Failed" };
        repo.Setup(r => r.UpdatePayment(8, update, 10)).ReturnsAsync(() =>
        {
            db.Payments.Local.Single(p => p.Id == 8).Status = "Failed";
            return new LoadPaymentDto { Id = 8, LeaseId = 1, Status = "Failed" };
        });
        var service = Service();
        (await service.UpdatePayment(8, update, 10)).Success.Should().BeTrue();
        (await service.UpdatePayment(8, update, 10)).Success.Should().BeTrue();
        db.GeneralLedgerEntries.Should().ContainSingle(e => e.TransactionId == 9);
        ledger.VerifyNoOtherCalls();
    }
}
