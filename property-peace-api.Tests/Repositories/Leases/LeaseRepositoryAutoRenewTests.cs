using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Leases;

public sealed class LeaseRepositoryAutoRenewTests : IDisposable
{
    private readonly Data.DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task GetLeasesEndingOnOrBeforeForAutoRenew_IncludesMonthToMonthAtFifteenDaysButNotFixedTerm()
    {
        var asOf = new DateTime(2026, 7, 17);
        _context.Leases.AddRange(
            Lease(1, endDate: new DateTime(2026, 8, 1), leaseLength: -1, autoRenewLength: -1),
            Lease(2, endDate: new DateTime(2026, 8, 1), leaseLength: 12, autoRenewLength: 12),
            Lease(3, endDate: asOf, leaseLength: 12, autoRenewLength: 12),
            Lease(4, endDate: new DateTime(2026, 8, 2), leaseLength: -1, autoRenewLength: -1));
        await _context.SaveChangesAsync();
        var repository = new LeaseRepository(_context, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());

        var result = await repository.GetLeasesEndingOnOrBeforeForAutoRenew(asOf);

        result.Select(lease => lease.Id).Should().BeEquivalentTo([1L, 3L]);
    }

    [Fact]
    public async Task ExtendMonthToMonthLeaseEndDateAsync_UpdatesOnlyExpectedOrganizationAndEndDate()
    {
        var currentEnd = new DateTime(2026, 8, 1);
        _context.Leases.Add(Lease(1, currentEnd, -1, -1));
        await _context.SaveChangesAsync();
        var repository = new LeaseRepository(_context, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());

        var wrongOrganization = await repository.ExtendMonthToMonthLeaseEndDateAsync(1, 99, currentEnd, currentEnd.AddMonths(1));
        var extended = await repository.ExtendMonthToMonthLeaseEndDateAsync(1, 7, currentEnd, currentEnd.AddMonths(1));
        var duplicate = await repository.ExtendMonthToMonthLeaseEndDateAsync(1, 7, currentEnd, currentEnd.AddMonths(1));

        wrongOrganization.Should().BeFalse();
        extended.Should().BeTrue();
        duplicate.Should().BeFalse();
        _context.Leases.Single(lease => lease.Id == 1).EndDate.Should().Be(new DateTime(2026, 9, 1));
    }

    [Fact]
    public async Task UpdateLease_DoesNotRewindAutoRenewedMonthToMonthEndDateFromStaleDto()
    {
        var renewedEndDate = new DateTime(2026, 9, 28);
        _context.Properties.Add(new Property { Id = 1000, LandlordId = 1, OrganizationId = 7 });
        _context.Units.Add(new Unit { Id = 101, PropertyId = 1000, OrganizationId = 7 });
        _context.Leases.Add(Lease(1, renewedEndDate, -1, -1));
        await _context.SaveChangesAsync();
        var repository = new LeaseRepository(_context, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        var staleUpdate = new UpdateLeaseDto
        {
            Id = 1,
            UnitId = 101,
            PropertyId = 1000,
            StartDate = new DateTime(2026, 1, 31),
            EndDate = new DateTime(2026, 2, 28),
            LeaseLength = -1,
            AutoRenewLease = true
        };

        await repository.UpdateLease(staleUpdate);

        _context.Leases.Single(lease => lease.Id == 1).EndDate.Should().Be(renewedEndDate);
    }

    private static Lease Lease(long id, DateTime endDate, int leaseLength, int autoRenewLength) => new()
    {
        Id = id,
        UnitId = 100 + id,
        OrganizationId = 7,
        IsActive = true,
        AutoRenewLease = true,
        LeaseLength = leaseLength,
        AutoRenewLeaseLength = autoRenewLength,
        StartDate = endDate.AddMonths(-1),
        EndDate = endDate
    };
}
