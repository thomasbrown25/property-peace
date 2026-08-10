using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Payments;

public sealed class PaymentIncomeScopeRepositoryTests : IDisposable
{
    private readonly DataContext _context = DbContextFactory.Create();
    private readonly PaymentRepository _sut;

    public PaymentIncomeScopeRepositoryTests() =>
        _sut = new PaymentRepository(_context, NullLogger<PaymentRepository>.Instance, MapperFactory.Create());

    [Fact]
    public async Task OrganizationAndPropertyQuery_JoinsOwnershipAndAppliesHalfOpenDateRange()
    {
        SeedProperty(101, 1001, 2001, organizationId: 10);
        SeedProperty(102, 1002, 2002, organizationId: 10);
        SeedProperty(202, 1202, 2202, organizationId: 20);

        AddPayment(1, 2001, 101, organizationId: 10, new DateTime(2024, 1, 1), 10m);
        AddPayment(2, 2001, 101, organizationId: 10, new DateTime(2025, 1, 1).AddTicks(-1), 20m);
        AddPayment(3, 2001, 101, organizationId: 10, new DateTime(2025, 1, 1), 30m);
        AddPayment(4, 2002, 102, organizationId: 10, new DateTime(2024, 6, 1), 40m);
        AddPayment(5, 2202, 202, organizationId: 10, new DateTime(2024, 6, 1), 50m); // spoofed denormalized org
        AddPayment(6, 2202, 101, organizationId: 10, new DateTime(2024, 6, 1), 60m); // spoofed denormalized property
        await _context.SaveChangesAsync();

        var result = await _sut.GetPaymentsByOrganizationAndPropertyId(
            10, 101, new DateTime(2024, 1, 1), new DateTime(2025, 1, 1));

        result.Select(x => (x.Id, x.Amount)).Should().BeEquivalentTo(new[] { (1L, 10m), (2L, 20m) });
    }

    [Fact]
    public async Task OrganizationQuery_WithoutProperty_ReturnsOnlyJoinedOrganizationRowsInRange()
    {
        SeedProperty(101, 1001, 2001, organizationId: 10);
        SeedProperty(102, 1002, 2002, organizationId: 10);
        SeedProperty(202, 1202, 2202, organizationId: 20);

        AddPayment(1, 2001, 101, organizationId: 20, new DateTime(2024, 2, 1), 10m); // stale payment org must not hide valid row
        AddPayment(2, 2002, 102, organizationId: null, new DateTime(2024, 3, 1), 20m);
        AddPayment(3, 2202, 202, organizationId: 10, new DateTime(2024, 4, 1), 30m); // spoofed payment org must not leak
        AddPayment(4, 2001, 101, organizationId: 10, new DateTime(2025, 1, 1), 40m);
        await _context.SaveChangesAsync();

        var result = await _sut.GetPaymentsByOrganizationAndPropertyId(
            10, null, new DateTime(2024, 1, 1), new DateTime(2025, 1, 1));

        result.Select(x => (x.Id, x.Amount)).Should().BeEquivalentTo(new[] { (1L, 10m), (2L, 20m) });
    }

    private void SeedProperty(long propertyId, long unitId, long leaseId, long organizationId)
    {
        _context.Properties.Add(new Property
        {
            Id = propertyId,
            Name = $"Property {propertyId}",
            OrganizationId = organizationId
        });
        _context.Units.Add(new Unit { Id = unitId, PropertyId = propertyId, Name = $"Unit {unitId}" });
        _context.Leases.Add(new Lease { Id = leaseId, UnitId = unitId, IsDeleted = false });
    }

    private void AddPayment(
        long id,
        long leaseId,
        long propertyId,
        long? organizationId,
        DateTime paymentDate,
        decimal amount) =>
        _context.Payments.Add(new Payment
        {
            Id = id,
            LeaseId = leaseId,
            PropertyId = propertyId,
            OrganizationId = organizationId,
            PaymentDate = paymentDate,
            Amount = amount,
            Status = "Completed"
        });

    public void Dispose() => _context.Dispose();
}
