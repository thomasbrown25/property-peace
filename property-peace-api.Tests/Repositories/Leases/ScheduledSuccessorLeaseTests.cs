using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Controllers;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Leases;

public sealed class ScheduledSuccessorLeaseTests
{

    [Fact]
    public void OpenEndedCurrentLease_IsOccupiedInUnitProjection()
    {
        var unit = new Unit { Id = 1 };
        unit.Leases.Add(new Lease { Id = 1, Unit = unit, UnitId = 1, IsActive = true,
            StartDate = DateTime.Today.AddDays(-1), EndDate = null });
        var projection = MapperFactory.Create().Map<brownstone_hub_api.Dtos.Unit.LoadUnitDto>(unit);
        projection.IsOccupied.Should().BeTrue();
        projection.Status.Should().Be("occupied");
    }

    [Fact]
    public async Task FixedTermRenewal_BookedSuccessorNeverArchivesIncumbent()
    {
        using var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        property.Units.Add(new Unit { Id = 1, Name = "A", Property = property, PropertyId = 1, OrganizationId = 10, IsOccupied = true });
        db.Properties.Add(property);
        db.Leases.AddRange(
            new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true, AutoRenewLease = true,
                StartDate = new DateTime(2025, 10, 31), EndDate = new DateTime(2026, 10, 31) },
            new Lease { Id = 2, UnitId = 1, OrganizationId = 10, IsActive = true,
                StartDate = new DateTime(2026, 10, 31), EndDate = new DateTime(2027, 10, 31) });
        await db.SaveChangesAsync();
        var repository = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        var renewal = new UpdateLeaseDto { UnitId = 1, PropertyId = 1, IsDrafted = false,
            StartDate = new DateTime(2026, 11, 1), EndDate = new DateTime(2027, 11, 1) };

        (await repository.RenewFixedTermLeaseAsync(1, 10, new DateTime(2026, 10, 31), renewal)).Should().BeFalse();
        db.Leases.Single(l => l.Id == 1).IsActive.Should().BeTrue();
        db.Units.Single().IsOccupied.Should().BeTrue();
        (await db.Leases.CountAsync()).Should().Be(2);
        (await db.LeaseHistories.CountAsync()).Should().Be(0);
    }

    [Fact]
    public async Task FixedTermRenewal_NoSuccessorCreatesFinalizedContractAndArchivesSource()
    {
        using var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        property.Units.Add(new Unit { Id = 1, Name = "A", Property = property, PropertyId = 1, OrganizationId = 10 });
        db.Properties.Add(property);
        db.Leases.Add(new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true,
            AutoRenewLease = true, StartDate = new DateTime(2025, 10, 31), EndDate = new DateTime(2026, 10, 31) });
        await db.SaveChangesAsync();
        var repository = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        var renewal = new UpdateLeaseDto { UnitId = 1, PropertyId = 1, IsDrafted = true,
            StartDate = new DateTime(2026, 11, 1), EndDate = new DateTime(2027, 11, 1) };

        (await repository.RenewFixedTermLeaseAsync(1, 10, new DateTime(2026, 10, 31), renewal)).Should().BeTrue();
        db.Leases.Single(l => l.Id == 1).IsActive.Should().BeFalse();
        var successor = db.Leases.Single(l => l.Id != 1);
        successor.IsActive.Should().BeTrue();
        db.LeaseAgreements.Single(a => a.LeaseId == successor.Id).IsDrafted.Should().BeFalse();
        (await db.LeaseHistories.CountAsync()).Should().Be(1);
    }

    [Fact]
    public void TenantCurrentLease_OutgoingWinsAtBoundaryAndFutureOnlyIsNotCurrent()
    {
        var today = new DateTime(2026, 10, 31);
        var outgoing = new LoadLeaseDto { Id = 1, IsActive = true, StartDate = today.AddYears(-1), EndDate = today };
        var incoming = new LoadLeaseDto { Id = 2, IsActive = true, StartDate = today, EndDate = today.AddYears(1) };
        LeaseController.SelectCurrentTenantLease([incoming, outgoing], today)!.Id.Should().Be(1);
        LeaseController.SelectCurrentTenantLease([new LoadLeaseDto { Id = 3, IsActive = true,
            StartDate = today.AddDays(1), EndDate = today.AddYears(1) }], today).Should().BeNull();
        LeaseController.SelectCurrentTenantLease([incoming, outgoing], today.AddDays(1))!.Id.Should().Be(2);
    }

    [Fact]
    public void PropertyLeaseList_ExposesScopedHttpRoute()
    {
        var action = typeof(LeaseController).GetMethod("GetPropertyLeases");
        action.Should().NotBeNull();
        action!.GetCustomAttributes(typeof(HttpGetAttribute), true)
            .Cast<HttpGetAttribute>().Single().Template.Should().Be("property/{propertyId:long}");
    }

    [Fact]
    public async Task UnitProjection_OutgoingWinsAndScheduledLeaseRemainsDiscoverable()
    {
        using var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        var unit = new Unit { Id = 1, Name = "A", Property = property, PropertyId = 1, OrganizationId = 10 };
        property.Units.Add(unit);
        db.Properties.Add(property);
        db.Leases.AddRange(
            new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true, StartDate = DateTime.Today.AddMonths(-1), EndDate = DateTime.Today },
            new Lease { Id = 2, UnitId = 1, OrganizationId = 10, IsActive = true, StartDate = DateTime.Today, EndDate = DateTime.Today.AddYears(1) });
        await db.SaveChangesAsync();
        var projection = MapperFactory.Create().Map<brownstone_hub_api.Dtos.Unit.LoadUnitDto>(unit);
        projection.Lease!.Id.Should().Be(1);
        projection.IsOccupied.Should().BeTrue();
        projection.Leases.Select(l => l.Id).Should().BeEquivalentTo([1L, 2L]);
    }

    [Fact]
    public async Task MonthToMonthExtension_RefusesBookedSuccessor()
    {
        using var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        property.Units.Add(new Unit { Id = 1, Name = "A", Property = property, PropertyId = 1, OrganizationId = 10 });
        db.Properties.Add(property);
        db.Leases.AddRange(
            new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true, AutoRenewLease = true, LeaseLength = -1, StartDate = new DateTime(2026, 9, 1), EndDate = new DateTime(2026, 10, 31) },
            new Lease { Id = 2, UnitId = 1, OrganizationId = 10, IsActive = true, StartDate = new DateTime(2026, 10, 31), EndDate = new DateTime(2027, 10, 31) });
        await db.SaveChangesAsync();
        var repository = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        (await repository.ExtendMonthToMonthLeaseEndDateAsync(1, 10, new DateTime(2026, 10, 31), new DateTime(2026, 11, 30))).Should().BeFalse();
        db.Leases.Single(l => l.Id == 1).EndDate.Should().Be(new DateTime(2026, 10, 31));
    }
    [Fact]
    public async Task CurrentLookup_OutgoingWinsOnSameDayBoundary()
    {
        using var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        property.Units.Add(new Unit { Id = 1, Name = "A", Property = property, PropertyId = 1, OrganizationId = 10 });
        db.Properties.Add(property);
        db.Leases.AddRange(
            new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true, StartDate = DateTime.Today.AddMonths(-1), EndDate = DateTime.Today },
            new Lease { Id = 2, UnitId = 1, OrganizationId = 10, IsActive = true, StartDate = DateTime.Today, EndDate = DateTime.Today.AddYears(1) });
        await db.SaveChangesAsync();
        var repository = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        (await repository.GetLease(1, 10)).Id.Should().Be(1);
        (await repository.GetLeaseById(2, 10))!.Id.Should().Be(2);
    }

    [Fact]
    public async Task IndefiniteIncumbent_RejectsSuccessorWithoutMutatingLease()
    {
        using var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        var unit = new Unit { Id = 1, Name = "A", Property = property, PropertyId = 1, OrganizationId = 10 };
        property.Units.Add(unit);
        db.Properties.Add(property);
        db.Leases.Add(new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true,
            StartDate = new DateTime(2026, 1, 1), EndDate = null });
        await db.SaveChangesAsync();
        var repository = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.AddLease(new UpdateLeaseDto { UnitId = 1, PropertyId = 1,
            StartDate = new DateTime(2026, 11, 1), EndDate = new DateTime(2027, 11, 1) }, 10));
        (await db.Leases.CountAsync()).Should().Be(1);
    }

    [Fact]
    public async Task DraftCompletion_RejectsCollisionAndRemainsDraft()
    {
        using var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        property.Units.Add(new Unit { Id = 1, Name = "A", Property = property, PropertyId = 1, OrganizationId = 10 });
        db.Properties.Add(property);
        db.Leases.AddRange(
            new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true, StartDate = new DateTime(2026, 1, 1), EndDate = new DateTime(2026, 10, 31) },
            new Lease { Id = 2, UnitId = 1, OrganizationId = 10, IsActive = false, StartDate = new DateTime(2026, 10, 30), EndDate = new DateTime(2027, 10, 30) });
        db.LeaseAgreements.Add(new LeaseAgreement { LeaseId = 2, IsDrafted = true });
        await db.SaveChangesAsync();
        var repository = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.CompleteDraft(2, 10));
        db.Leases.Single(l => l.Id == 2).IsActive.Should().BeFalse();
        db.LeaseAgreements.Single().IsDrafted.Should().BeTrue();
    }

    [Fact]
    public void RelationalModel_AllowsMultipleLeasesPerUnit()
    {
        using var db = DbContextFactory.Create();
        var index = db.Model.FindEntityType(typeof(Lease))!.GetIndexes()
            .Single(i => i.Properties.Select(p => p.Name).SequenceEqual(["UnitId"]));
        index.IsUnique.Should().BeFalse();
    }

    [Theory]
    [InlineData(31, true)]
    [InlineData(30, false)]
    [InlineData(1, true)]
    public async Task Successor_MustNotOverlapIncumbent(int startDay, bool allowed)
    {
        using var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        var unit = new Unit { Id = 1, Name = "A", Property = property, PropertyId = 1, OrganizationId = 10 };
        property.Units.Add(unit);
        db.Properties.Add(property);
        db.Leases.Add(new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true,
            StartDate = new DateTime(2026, 1, 1), EndDate = new DateTime(2026, 10, 31) });
        await db.SaveChangesAsync();
        var repository = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        var start = startDay == 1 ? new DateTime(2026, 11, 1) : new DateTime(2026, 10, startDay);
        var dto = new UpdateLeaseDto { UnitId = 1, PropertyId = 1, StartDate = start,
            EndDate = new DateTime(2027, 10, 31), IsDrafted = false };
        if (allowed)
        {
            var result = await repository.AddLease(dto, 10);
            result.Id.Should().NotBe(1);
            (await db.Leases.CountAsync()).Should().Be(2);
        }
        else
        {
            await Assert.ThrowsAsync<InvalidOperationException>(() => repository.AddLease(dto, 10));
            (await db.Leases.CountAsync()).Should().Be(1);
        }
    }

    [Fact]
    public async Task Successor_DoesNotInheritExistingResidentLinks()
    {
        using var db = DbContextFactory.Create();
        var property = new Property { Id = 1, LandlordId = 99, OrganizationId = 10, Name = "Home", StreetAddress = "1 Main" };
        var unit = new Unit { Id = 1, Name = "A", Property = property, PropertyId = 1, OrganizationId = 10 };
        property.Units.Add(unit);
        db.Properties.Add(property);
        db.Leases.Add(new Lease { Id = 1, UnitId = 1, OrganizationId = 10, IsActive = true,
            StartDate = new DateTime(2026, 1, 1), EndDate = new DateTime(2026, 10, 31) });
        await db.SaveChangesAsync();
        var repository = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        var result = await repository.AddLease(new UpdateLeaseDto { UnitId = 1, PropertyId = 1,
            StartDate = new DateTime(2026, 11, 1), EndDate = new DateTime(2027, 11, 1) }, 10);
        (await db.TenantLeases.CountAsync(t => t.LeaseId == result.Id)).Should().Be(0);
    }
}
