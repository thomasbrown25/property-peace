using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.PaymentService;
using brownstone_hub_api.Services.RentCollectionService;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.RentCollection;

public sealed class RentCollectionSettlementSummaryTests : IDisposable
{
    private const long OrganizationId = 41;
    private readonly DataContext _context;
    private readonly Mock<ILeaseRepository> _leases = new();
    private readonly Mock<IPaymentRepository> _payments = new();
    private readonly Mock<IPaymentService> _paymentService = new();
    private readonly RentCollectionService _sut;

    public RentCollectionSettlementSummaryTests()
    {
        _context = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"rent-settlement-summary-{Guid.NewGuid()}").Options);

        _leases.Setup(repository => repository.GetLeasesByOrganizationId(OrganizationId, true))
            .ReturnsAsync([ActiveLease(101), ActiveLease(102)]);
        _payments.Setup(repository => repository.GetLifetimeRentPaymentsByOrganizationId(OrganizationId))
            .ReturnsAsync([]);

        var httpContext = new DefaultHttpContext();
        httpContext.Items["OrganizationId"] = OrganizationId;
        _sut = new RentCollectionService(
            Mock.Of<IPropertyRepository>(),
            _leases.Object,
            _payments.Object,
            _paymentService.Object,
            Mock.Of<IMaintenanceRequestRepository>(),
            Mock.Of<INotificationService>(),
            _context,
            new HttpContextAccessor { HttpContext = httpContext },
            Mock.Of<IUserRepository>(),
            Mock.Of<ILogger<RentCollectionService>>());
    }

    [Fact]
    public async Task GetRentCollection_GroupsExactSettlementAmountsAndCounts_WithinOrganizationAndActiveLeaseScope()
    {
        AddSettlement(1, 101, OrganizationId, StripeRentPaymentStatus.Created, 101);
        AddSettlement(2, 102, OrganizationId, StripeRentPaymentStatus.Processing, 202);
        AddSettlement(3, 101, OrganizationId, StripeRentPaymentStatus.Held, 303, DateTimeOffset.UtcNow.AddDays(2));
        AddSettlement(4, 101, OrganizationId, StripeRentPaymentStatus.Held, 404, DateTimeOffset.UtcNow.AddMinutes(-1));
        AddSettlement(5, 102, OrganizationId, StripeRentPaymentStatus.TransferPending, 505);
        AddSettlement(6, 101, OrganizationId, StripeRentPaymentStatus.Transferred, 606);
        AddSettlement(7, 101, OrganizationId, StripeRentPaymentStatus.Blocked, 707);
        AddSettlement(8, 101, OrganizationId, StripeRentPaymentStatus.TransferReconciliationPending, 808);
        AddSettlement(9, 102, OrganizationId, StripeRentPaymentStatus.ReversalPending, 909);
        AddSettlement(10, 102, OrganizationId, StripeRentPaymentStatus.Reversed, 1_010);
        _context.StripeRentPayments.Local.Single(payment => payment.Id == 9).RefundedAmountCents = 109;
        _context.StripeRentPayments.Local.Single(payment => payment.Id == 9).ReversalTargetAmountCents = 109;
        _context.StripeRentPayments.Local.Single(payment => payment.Id == 10).DisputedAmountCents = 210;
        _context.StripeRentPayments.Local.Single(payment => payment.Id == 10).ReversedAmountCents = 210;
        AddSettlement(11, 102, OrganizationId, StripeRentPaymentStatus.RecoveryFailed, 1_111);

        // Both records are outside the caller's settlement scope and must not affect any bucket.
        AddSettlement(12, 101, 99, StripeRentPaymentStatus.Transferred, 90_000);
        AddSettlement(13, 999, OrganizationId, StripeRentPaymentStatus.Held, 80_000);
        await _context.SaveChangesAsync();

        var result = await _sut.GetRentCollection(OrganizationId);

        result.Success.Should().BeTrue();
        result.Data!.Summary.SettlementProcessing.Should().Be(3.03m);
        result.Data.Summary.SettlementProcessingCount.Should().Be(2);
        result.Data.Summary.SettlementHeld.Should().Be(3.03m);
        result.Data.Summary.SettlementHeldCount.Should().Be(1);
        result.Data.Summary.SettlementAvailable.Should().Be(9.09m);
        result.Data.Summary.SettlementAvailableCount.Should().Be(2);
        result.Data.Summary.SettlementTransferred.Should().Be(6.06m);
        result.Data.Summary.SettlementTransferredCount.Should().Be(1);
        result.Data.Summary.SettlementBlocked.Should().Be(7.07m);
        result.Data.Summary.SettlementBlockedCount.Should().Be(1);
        result.Data.Summary.SettlementReturned.Should().Be(3.19m);
        result.Data.Summary.SettlementReturnedCount.Should().Be(2);
        result.Data.Summary.SettlementReconciliationPending.Should().Be(8.08m);
        result.Data.Summary.SettlementReconciliationPendingCount.Should().Be(1);
        result.Data.Summary.SettlementRecoveryFailed.Should().Be(11.11m);
        result.Data.Summary.SettlementRecoveryFailedCount.Should().Be(1);
    }

    [Fact]
    public async Task AddPayment_CollectedLifetime_OnlySumsFinalizedStatuses()
    {
        var lease = ActiveLease(101);
        lease.StartDate = DateTime.Today.AddMonths(-1);
        lease.EndDate = DateTime.Today.AddMonths(1);
        _leases.Setup(repository => repository.GetLeaseById(101, OrganizationId)).ReturnsAsync(lease);
        _paymentService.Setup(service => service.AddPayment(It.IsAny<AddPaymentDto>()))
            .ReturnsAsync(new ServiceResponse<List<LoadPaymentDto>>
            {
                Data = [new LoadPaymentDto { Id = 9, LeaseId = 101, Amount = 200m, Status = "Processing", PaymentDate = DateTime.UtcNow }]
            });
        _payments.Setup(repository => repository.GetRentPaymentsByLeaseId(101)).ReturnsAsync([
            new LoadPaymentDto { Id = 1, LeaseId = 101, Amount = 100m, Status = "Completed", PaymentDate = DateTime.UtcNow },
            new LoadPaymentDto { Id = 2, LeaseId = 101, Amount = 200m, Status = "Processing", PaymentDate = DateTime.UtcNow },
            new LoadPaymentDto { Id = 3, LeaseId = 101, Amount = 300m, Status = "Failed", PaymentDate = DateTime.UtcNow }
        ]);

        var result = await _sut.AddPayment(new AddPaymentDto
        {
            LeaseId = 101,
            Amount = 200m,
            Status = "Processing",
            PaymentDate = DateTime.UtcNow
        });

        result.Success.Should().BeTrue();
        result.Data!.CollectedLifetime.Should().Be(100m);
    }

    [Fact]
    public async Task GetRentCollection_DoesNotExposeInternalErrors()
    {
        _leases.Setup(repository => repository.GetLeasesByOrganizationId(OrganizationId, true))
            .ThrowsAsync(new InvalidOperationException("database-host=secret.internal; password=hunter2"));

        var result = await _sut.GetRentCollection(OrganizationId);

        result.Success.Should().BeFalse();
        result.Message.Should().Be("Unable to retrieve rent collection right now.");
        result.Message.Should().NotContain("secret.internal").And.NotContain("hunter2");
        result.Errors.Details.Should().NotContain("secret.internal").And.NotContain("hunter2");
        result.Errors.InnerException.Should().NotContain("secret.internal").And.NotContain("hunter2");
    }

    private static LoadLeaseDto ActiveLease(long id) => new()
    {
        Id = id,
        OrganizationId = OrganizationId,
        IsActive = true,
        PropertyId = id,
        PropertyName = $"Property {id}",
        PropertyType = "SingleFamily",
        UnitName = "Main",
        RentAmount = 0m,
        RentFrequency = "Monthly",
        RentDueDay = 1,
        StartDate = DateTime.Today,
        EndDate = DateTime.Today.AddYears(1)
    };

    private void AddSettlement(long id, long leaseId, long organizationId, StripeRentPaymentStatus status, long cents,
        DateTimeOffset? transferEligibleAt = null)
    {
        _context.StripeRentPayments.Add(new StripeRentPayment
        {
            Id = id,
            OperationId = $"op_{id}",
            PaymentIntentId = $"pi_{id}",
            LeaseId = leaseId,
            OrganizationId = organizationId,
            TenantUserId = 501,
            AmountCents = cents,
            DestinationStripeAccountId = "acct_test",
            Status = status,
            TransferEligibleAt = transferEligibleAt,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        });
    }

    public void Dispose() => _context.Dispose();
}
