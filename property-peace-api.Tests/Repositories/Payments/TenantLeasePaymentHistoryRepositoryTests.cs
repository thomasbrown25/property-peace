using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Payments;

public sealed class TenantLeasePaymentHistoryRepositoryTests : IDisposable
{
    private readonly DataContext _context = DbContextFactory.Create();
    private readonly PaymentRepository _sut;

    public TenantLeasePaymentHistoryRepositoryTests() =>
        _sut = new PaymentRepository(_context, NullLogger<PaymentRepository>.Instance, MapperFactory.Create());

    [Fact]
    public async Task Projection_IncludesPreAllocationAttempts_AndDeduplicatesAllocatedAggregateWithPayment()
    {
        await SeedAuthorizedLease();
        AddAttempt(1, "pi_created", StripeRentPaymentStatus.Created, 100_00, 5);
        AddAttempt(2, "pi_processing", StripeRentPaymentStatus.Processing, 200_00, 4);
        AddAttempt(3, "pi_failed", StripeRentPaymentStatus.Failed, 300_00, 3);
        AddAttempt(4, "pi_canceled", StripeRentPaymentStatus.Canceled, 400_00, 2);
        AddAttempt(5, "pi_allocated", StripeRentPaymentStatus.Held, 500_00, 1);
        _context.Payments.Add(new Payment
        {
            Id = 51, LeaseId = 10, PropertyId = 30, OrganizationId = 40, Amount = 500m,
            PaymentDate = DateTime.UtcNow, Status = "Completed", Method = "Online Payment",
            StripePaymentIntentId = "pi_allocated", CompletedAt = DateTime.UtcNow
        });
        await _context.SaveChangesAsync();

        var result = await _sut.GetTenantLeasePaymentHistory(10, 20, 40);

        result.Should().HaveCount(5);
        result.Select(item => item.Status).Should().BeEquivalentTo("Created", "Processing", "Failed", "Canceled", "Completed");
        result.Count(item => item.Amount == 500m).Should().Be(1);
        result.Single(item => item.Amount == 500m).CreditsRent.Should().BeTrue();
    }

    [Theory]
    [InlineData("Completed", true)]
    [InlineData("Paid", true)]
    [InlineData("Processing", false)]
    [InlineData("Created", false)]
    [InlineData("Failed", false)]
    [InlineData("Canceled", false)]
    [InlineData("mystery-provider-state", false)]
    [InlineData("", false)]
    public async Task Projection_OnlyExplicitFinalStatusesCreditRent(string status, bool expected)
    {
        await SeedAuthorizedLease();
        _context.Payments.Add(new Payment
        {
            Id = 70, LeaseId = 10, PropertyId = 30, OrganizationId = 40, Amount = 100m,
            PaymentDate = DateTime.UtcNow, Status = status!, Method = "Manual Entry"
        });
        await _context.SaveChangesAsync();

        var result = await _sut.GetTenantLeasePaymentHistory(10, 20, 40);

        result.Should().ContainSingle().Which.CreditsRent.Should().Be(expected);
        if (string.IsNullOrWhiteSpace(status) || status == "mystery-provider-state") result[0].Status.Should().Be("NeedsReview");
    }

    [Theory]
    [InlineData(21, 10, 40)]
    [InlineData(20, 11, 40)]
    [InlineData(20, 10, 41)]
    public async Task Projection_DeniesCrossTenantLeaseAndOrganizationScope(long userId, long leaseId, long organizationId)
    {
        await SeedAuthorizedLease();
        AddAttempt(1, "pi_private", StripeRentPaymentStatus.Created, 100_00, 1);
        await _context.SaveChangesAsync();

        var result = await _sut.GetTenantLeasePaymentHistory(leaseId, userId, organizationId);

        result.Should().BeEmpty();
    }

    private async Task SeedAuthorizedLease()
    {
        _context.Properties.Add(new Property { Id = 30, Name = "Tenant Home", OrganizationId = 40 });
        _context.Units.Add(new Unit { Id = 31, Name = "Main", PropertyId = 30 });
        _context.Leases.Add(new Lease { Id = 10, UnitId = 31, IsDeleted = false });
        _context.Tenants.Add(new Tenant
        {
            Id = 22, UserId = 20, OrganizationId = 40, Firstname = "Authorized",
            Lastname = "Tenant", Email = "tenant@example.test"
        });
        _context.TenantLeases.Add(new TenantLease { TenantId = 22, LeaseId = 10 });
        await _context.SaveChangesAsync();
    }

    private void AddAttempt(long id, string intentId, StripeRentPaymentStatus status, long cents, int minutesAgo)
    {
        var timestamp = DateTimeOffset.UtcNow.AddMinutes(-minutesAgo);
        _context.StripeRentPayments.Add(new StripeRentPayment
        {
            Id = id, OperationId = $"op_{id}", PaymentIntentId = intentId, LeaseId = 10,
            OrganizationId = 40, TenantUserId = 20, AmountCents = cents, Currency = "usd",
            DestinationStripeAccountId = "acct_private", Status = status,
            CreatedAt = timestamp, UpdatedAt = timestamp
        });
    }

    public void Dispose() => _context.Dispose();
}
