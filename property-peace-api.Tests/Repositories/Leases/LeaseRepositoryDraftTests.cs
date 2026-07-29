using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Leases;

public sealed class LeaseRepositoryDraftTests : IDisposable
{
    private readonly Data.DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task AddLease_PersistsIncompleteDraftWithNullDetailsAndDraftAgreement()
    {
        var property = new Property
        {
            Id = 1,
            LandlordId = 99,
            OrganizationId = 10,
            Name = "Draft Property",
            StreetAddress = "123 Draft Street"
        };
        var unit = new Unit
        {
            Id = 1,
            PropertyId = property.Id,
            Property = property,
            OrganizationId = 10,
            Name = "1"
        };
        property.Units.Add(unit);
        _context.Properties.Add(property);
        await _context.SaveChangesAsync();

        var repository = new LeaseRepository(
            _context,
            NullLogger<LeaseRepository>.Instance,
            MapperFactory.Create());

        await repository.AddLease(new UpdateLeaseDto
        {
            PropertyId = property.Id,
            UnitId = unit.Id,
            StartDate = null,
            EndDate = null,
            RentAmount = null,
            LeaseLength = null,
            RentFrequency = null,
            RentDueDay = null,
            IsDrafted = true,
            IsActive = false
        }, organizationId: 10);

        _context.ChangeTracker.Clear();
        var persisted = await _context.Leases
            .Include(lease => lease.LeaseAgreement)
            .SingleAsync();

        persisted.StartDate.Should().BeNull();
        persisted.EndDate.Should().BeNull();
        persisted.RentAmount.Should().BeNull();
        persisted.LeaseLength.Should().BeNull();
        persisted.RentFrequency.Should().BeNull();
        persisted.RentDueDay.Should().BeNull();
        persisted.IsActive.Should().BeFalse();
        persisted.LeaseAgreement.Should().NotBeNull();
        persisted.LeaseAgreement!.IsDrafted.Should().BeTrue();
    }

    [Fact]
    public async Task AddLease_PersistsProrationAndAllMoveInCharges()
    {
        var property = new Property
        {
            Id = 2, LandlordId = 99, OrganizationId = 10,
            Name = "Move-in Property", StreetAddress = "456 Charge Street"
        };
        var unit = new Unit
        {
            Id = 2, PropertyId = property.Id, Property = property,
            OrganizationId = 10, Name = "1"
        };
        property.Units.Add(unit);
        _context.Properties.Add(property);
        await _context.SaveChangesAsync();
        var repository = new LeaseRepository(_context, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        var start = new DateTime(2026, 8, 17);

        var created = await repository.AddLease(new UpdateLeaseDto
        {
            PropertyId = property.Id,
            UnitId = unit.Id,
            StartDate = start,
            EndDate = start.AddYears(1),
            RentAmount = 1500m,
            RentFrequency = "Monthly",
            RentDueDay = 1,
            ProratedRentDue = true,
            IsProratedRent = true,
            ProrationMethod = "calculated",
            ProratedRentAmount = 725.81m,
            DepositAmount = 1500m,
            PetDepositAmount = 300m,
            Fees =
            [
                new LeaseFeeDto { Name = "Pet Fee", Amount = 125m, DueDate = start },
                new LeaseFeeDto { Name = "Key Fee", Amount = 40m, DueDate = start }
            ],
            LeaseDeposits =
            [
                new LeaseDepositDto { Name = "Cleaning deposit", Amount = 75m, DueDate = start }
            ]
        }, organizationId: 10);

        _context.ChangeTracker.Clear();
        var persisted = await _context.Leases
            .Include(lease => lease.LeaseFees)
            .Include(lease => lease.LeaseDeposits)
            .SingleAsync();

        persisted.ProrationMethod.Should().Be("calculated");
        persisted.ProratedRentAmount.Should().Be(725.81m);
        persisted.DepositAmount.Should().Be(1500m);
        persisted.PetDepositAmount.Should().Be(300m);
        persisted.LeaseFees.Should().HaveCount(2);
        persisted.LeaseDeposits.Should().ContainSingle(d => d.Name == "Cleaning deposit" && d.Amount == 75m);

        _context.ChangeTracker.Clear();
        var loaded = await repository.GetLeaseById(created.Id, 10);
        loaded.ProrationMethod.Should().Be("calculated");
        loaded.ProratedRentAmount.Should().Be(725.81m);
        loaded.DepositAmount.Should().Be(1500m);
        loaded.PetDepositAmount.Should().Be(300m);
        loaded.Fees.Should().Contain(f => f.Name == "Pet Fee" && f.Amount == 125m);
        loaded.Fees.Should().Contain(f => f.Name == "Key Fee" && f.Amount == 40m);
        loaded.LeaseDeposits.Should().ContainSingle(d => d.Name == "Cleaning deposit" && d.Amount == 75m);
    }
}
