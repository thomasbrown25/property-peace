using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Services.AccountMappingService;
using brownstone_hub_api.Services.GeneralLedgerService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Tests.Helpers;
using brownstone_hub_api.Utils;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Payments;

public sealed class PaymentLedgerClassificationTests : IDisposable
{
    private readonly Data.DataContext db = DbContextFactory.Create();
    private readonly Mock<IPaymentRepository> repo = new();
    private readonly Mock<IAccountMappingService> mapping = new();
    private readonly Mock<IGeneralLedgerService> ledger = new();

    public void Dispose() => db.Dispose();
    private PaymentService Service() => new(repo.Object, mapping.Object, ledger.Object, db, Mock.Of<ILogger<PaymentService>>());

    private async Task Seed(long? feeId = null, long? depositId = null, long feeLease = 1, long feeOrg = 10)
    {
        db.Properties.Add(new Property { Id = 1, Name = "One", OrganizationId = 10 });
        db.Units.Add(new Unit { Id = 1, Name = "One", PropertyId = 1 });
        db.Leases.Add(new Lease { Id = 1, UnitId = 1, OrganizationId = 10 });
        if (feeLease != 1)
        {
            db.Properties.Add(new Property { Id = 2, Name = "Two", OrganizationId = feeOrg });
            db.Units.Add(new Unit { Id = 2, Name = "Two", PropertyId = 2 });
            db.Leases.Add(new Lease { Id = feeLease, UnitId = 2, OrganizationId = feeOrg });
        }
        if (feeId.HasValue) db.LeaseFees.Add(new LeaseFee { Id = feeId.Value, LeaseId = feeLease, OrganizationId = feeOrg, Name = "Pet fee", Amount = 100, DueDate = DateTime.UtcNow });
        if (depositId.HasValue) db.Deposits.Add(new Deposit { Id = depositId.Value, LeaseId = 1, OrganizationId = 10, Amount = 100, Notes = "Deposit" });
        await db.SaveChangesAsync();
    }

    private void Configure(AddPaymentDto request, long? feeId = null, long? depositId = null)
    {
        db.Payments.Add(new Payment { Id = 99, LeaseId = 1, OrganizationId = 10, Amount = request.Amount, Status = "Completed", PaymentDate = DateTime.UtcNow, FeeId = feeId, DepositId = depositId });
        db.SaveChanges();
        var inserted = new LoadPaymentDto { Id = 99, LeaseId = 1, Status = "Completed", Amount = request.Amount, PaymentDate = DateTime.UtcNow, FeeId = feeId, DepositId = depositId };
        repo.Setup(r => r.AddPaymentWithIdentity(request)).ReturnsAsync((inserted, new List<LoadPaymentDto> { inserted }));
        ledger.Setup(l => l.CreateLedgerEntryAsync(10, It.IsAny<long>(), 99, "Payment", It.IsAny<decimal>(), It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(new ServiceResponse<brownstone_hub_api.Dtos.GeneralLedger.LoadGeneralLedgerEntryDto>());
    }

    [Theory]
    [InlineData("rent", 4000)]
    [InlineData("fee", 4400)]
    [InlineData("deposit", 2100)]
    public async Task CompletedPayment_UsesOnlyItsTypedLedgerAccount(string kind, long accountId)
    {
        await Seed(feeId: 4, depositId: 5);
        var request = new AddPaymentDto { LeaseId = 1, Amount = 25, FeeId = kind == "fee" ? 4 : null, DepositId = kind == "deposit" ? 5 : null };
        Configure(request, request.FeeId, request.DepositId);
        mapping.Setup(m => m.GetRentIncomeAccountAsync(10)).ReturnsAsync(new Account { Id = 4000, OrganizationId = 10, AccountCode = "4000", AccountType = EAccountType.Income });
        mapping.Setup(m => m.GetFeeIncomeAccountAsync(10)).ReturnsAsync(new Account { Id = 4400, OrganizationId = 10, AccountCode = "4400", AccountType = EAccountType.Income });
        mapping.Setup(m => m.GetDepositLiabilityAccountAsync(10)).ReturnsAsync(new Account { Id = 2100, OrganizationId = 10, AccountCode = "2100", AccountType = EAccountType.Liability });

        (await Service().AddPayment(request)).Success.Should().BeTrue();
        ledger.Verify(l => l.CreateLedgerEntryAsync(10, accountId, 99, "Payment", 25, It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()), Times.Once);
        ledger.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task CompletedFee_WithNoSafeAccount_IsRejectedBeforePersistence()
    {
        await Seed(feeId: 4);
        var result = await Service().AddPayment(new AddPaymentDto { LeaseId = 1, Amount = 25, FeeId = 4, Status = "Completed" });
        result.Success.Should().BeFalse();
        repo.Verify(r => r.AddPayment(It.IsAny<AddPaymentDto>()), Times.Never);
    }

    [Fact]
    public async Task CompletedFee_WhenLedgerWriteFails_ReturnsFailureNotSuccess()
    {
        await Seed(feeId: 4);
        var request = new AddPaymentDto { LeaseId = 1, Amount = 25, FeeId = 4, Status = "Completed" };
        Configure(request, feeId: 4);
        mapping.Setup(m => m.GetFeeIncomeAccountAsync(10)).ReturnsAsync(new Account
            { Id = 4400, OrganizationId = 10, AccountCode = "4400", AccountType = EAccountType.Income });
        ledger.Setup(l => l.CreateLedgerEntryAsync(10, 4400, 99, "Payment", It.IsAny<decimal>(), It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(ServiceResponse<brownstone_hub_api.Dtos.GeneralLedger.LoadGeneralLedgerEntryDto>.CreateError("ledger failed"));
        (await Service().AddPayment(request)).Success.Should().BeFalse();
    }

    [Fact]
    public async Task CompletedFee_WhenAccountIsActuallyRentIncome_IsRejected()
    {
        await Seed(feeId: 4);
        mapping.Setup(m => m.GetFeeIncomeAccountAsync(10)).ReturnsAsync(new Account
            { Id = 4000, OrganizationId = 10, AccountCode = "4000", AccountType = EAccountType.Income });
        var result = await Service().AddPayment(new AddPaymentDto { LeaseId = 1, Amount = 25, FeeId = 4 });
        result.Success.Should().BeFalse();
        repo.Verify(r => r.AddPayment(It.IsAny<AddPaymentDto>()), Times.Never);
    }

    [Fact]
    public async Task CompletingExistingFeePayment_BooksFeeNotRent()
    {
        await Seed(feeId: 4);
        db.Payments.Add(new Payment { Id = 8, LeaseId = 1, OrganizationId = 10, FeeId = 4,
            Amount = 25, Status = "Completed", PaymentDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var update = new UpdatePaymentDto { Status = "Completed" };
        repo.Setup(r => r.UpdatePayment(8, update, 10)).ReturnsAsync(new LoadPaymentDto { Id = 8, LeaseId = 1, Status = "Completed" });
        mapping.Setup(m => m.GetFeeIncomeAccountAsync(10)).ReturnsAsync(new Account
            { Id = 4400, OrganizationId = 10, AccountCode = "4400", AccountType = EAccountType.Income });
        ledger.Setup(l => l.CreateLedgerEntryAsync(10, 4400, 8, "Payment", It.IsAny<decimal>(), It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(new ServiceResponse<brownstone_hub_api.Dtos.GeneralLedger.LoadGeneralLedgerEntryDto>());
        (await Service().UpdatePayment(8, update, 10)).Success.Should().BeTrue();
        ledger.Verify(l => l.CreateLedgerEntryAsync(10, 4400, 8, "Payment", 25, It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()), Times.Once);
    }

    [Theory]
    [InlineData(2, 10)]
    [InlineData(2, 99)]
    public async Task ManualFee_FromAnotherLeaseOrOrganization_IsDenied(long feeLease, long feeOrg)
    {
        await Seed(feeId: 4, feeLease: feeLease, feeOrg: feeOrg);
        var result = await Service().AddManualPayment(new AddPaymentDto { LeaseId = 1, Amount = 20, FeeId = 4 }, 10);
        result.Success.Should().BeFalse();
        repo.Verify(r => r.AddPayment(It.IsAny<AddPaymentDto>()), Times.Never);
    }

    [Fact]
    public async Task ManualFee_ValidPartialIsRecordedForSameLease()
    {
        await Seed(feeId: 4);
        db.Payments.Add(new Payment { Id = 7, LeaseId = 1, OrganizationId = 10, FeeId = 4, Amount = 70, Status = "Completed", PaymentDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var request = new AddPaymentDto { LeaseId = 1, FeeId = 4, Amount = 30 };
        var inserted = new LoadPaymentDto { Id = 99, LeaseId = 1, FeeId = 4, Amount = 30, Status = "Completed", PaymentDate = DateTime.UtcNow };
        repo.Setup(r => r.AddPaymentWithIdentity(request)).ReturnsAsync((inserted, new List<LoadPaymentDto> { inserted }));
        ledger.Setup(l => l.CreateLedgerEntryAsync(10, 4400, 99, "Payment", It.IsAny<decimal>(), It.IsAny<DateTime>(), It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(new ServiceResponse<brownstone_hub_api.Dtos.GeneralLedger.LoadGeneralLedgerEntryDto>());
        mapping.Setup(m => m.GetFeeIncomeAccountAsync(10)).ReturnsAsync(new Account
            { Id = 4400, OrganizationId = 10, AccountCode = "4400", AccountType = EAccountType.Income });
        (await Service().AddManualPayment(request, 10)).Success.Should().BeTrue();
        repo.Verify(r => r.AddPaymentWithIdentity(request), Times.Once);
    }

    [Fact]
    public async Task ManualFee_PartialCannotExceedOutstanding()
    {
        await Seed(feeId: 4);
        db.Payments.Add(new Payment { Id = 7, LeaseId = 1, OrganizationId = 10, FeeId = 4, Amount = 70, Status = "Completed", PaymentDate = DateTime.UtcNow });
        await db.SaveChangesAsync();
        var result = await Service().AddManualPayment(new AddPaymentDto { LeaseId = 1, FeeId = 4, Amount = 31 }, 10);
        result.Success.Should().BeFalse();
        repo.Verify(r => r.AddPayment(It.IsAny<AddPaymentDto>()), Times.Never);
    }
}
