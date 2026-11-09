using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.LeaseAgreement;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Services.KPIReportService;
using brownstone_hub_api.Services.PropertyPortfolioService;
using brownstone_hub_api.Tests.Helpers;
using brownstone_hub_api.Utils;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Occupancy;

public class LeaseOccupancyTests
{
    public static IEnumerable<object[]> Cases()
    {
        yield return ["active", true];
        yield return ["draft", false];
        yield return ["deleted", false];
        yield return ["terminated", false];
        yield return ["future", false];
        yield return ["expired", false];
        yield return ["missingStart", false];
        yield return ["openEnded", true];
        yield return ["monthToMonth", true];
        yield return ["expiredMonthToMonth", false];
        yield return ["endsToday", true];
    }

    private static Lease MakeLease(string kind)
    {
        var day = DateTime.UtcNow.Date;
        var lease = new Lease { Id = 100, UnitId = 30, StartDate = day.AddDays(-20), EndDate = day.AddDays(20) };
        switch (kind)
        {
            case "draft": lease.LeaseAgreement = new LeaseAgreement { IsDrafted = true }; break;
            case "deleted": lease.IsDeleted = true; break;
            case "terminated": lease.IsActive = false; break;
            case "future": lease.StartDate = day.AddDays(1); break;
            case "expired": lease.EndDate = day.AddDays(-1); break;
            case "missingStart": lease.StartDate = null; break;
            case "openEnded": lease.EndDate = null; break;
            case "monthToMonth": lease.LeaseLength = -1; lease.AutoRenewLease = true; break;
            case "expiredMonthToMonth": lease.LeaseLength = -1; lease.AutoRenewLease = true; lease.EndDate = day.AddDays(-1); break;
            case "endsToday": lease.StartDate = day.AddHours(12); lease.EndDate = day.AddHours(18); break;
        }
        lease.Unit = new Unit { Id = 30, PropertyId = 20, Property = new Property { Id = 20 } };
        return lease;
    }

    [Theory]
    [MemberData(nameof(Cases))]
    public void Entity_dto_and_mapping_agree_without_tenants_or_cached_flags(string kind, bool occupied)
    {
        var lease = MakeLease(kind);
        var unit = new Unit { Id = 30, IsOccupied = !occupied, Leases = [lease] };
        var property = new Property { Id = 20, IsOccupied = !occupied, Units = [unit] };
        unit.Property = property;
        lease.Unit = unit;
        var mapper = MapperFactory.Create();
        LeaseOccupancy.IsActiveOn(lease, DateTime.UtcNow).Should().Be(occupied);
        LeaseOccupancy.ActiveOn(DateTime.UtcNow).Compile()(lease).Should().Be(occupied);
        var dto = mapper.Map<LoadUnitDto>(unit);
        dto.IsOccupied.Should().Be(occupied);
        (dto.Lease != null).Should().Be(occupied);
        LeaseOccupancy.IsOccupied(dto, DateTime.UtcNow).Should().Be(occupied);
        mapper.Map<LoadPropertyDto>(property).IsOccupied.Should().Be(occupied);
        dto.Status.Should().Be(occupied ? "occupied" : "vacant");
    }

    [Fact]
    public async Task Repository_reads_load_draft_flags_and_counts_ignore_cached_flags()
    {
        using var db = DbContextFactory.Create();
        foreach (var (kind, id) in new[] { ("draft", 1L), ("active", 2L), ("future", 3L) })
        {
            var property = new Property { Id = id, OrganizationId = 10, LandlordId = 7, Name = kind, IsOccupied = kind != "active" };
            var unit = new Unit { Id = id, OrganizationId = 10, Property = property, PropertyId = id, IsOccupied = kind != "active" };
            var lease = MakeLease(kind);
            lease.Id = id; lease.UnitId = id; lease.Unit = unit;
            if (lease.LeaseAgreement != null) { lease.LeaseAgreement.Id = id; lease.LeaseAgreement.LeaseId = id; }
            unit.Leases.Add(lease); property.Units.Add(unit); db.Properties.Add(property);
        }
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var mapper = MapperFactory.Create();
        var properties = new PropertyRepository(db, NullLogger<PropertyRepository>.Instance, mapper);
        var units = new UnitRepository(db, NullLogger<UnitRepository>.Instance, mapper);
        (await units.GetUnits(1, 10)).Single().IsOccupied.Should().BeFalse();
        (await units.GetUnitsByPropertyIds([1, 2, 3], 10)).Count(x => x.IsOccupied).Should().Be(1);
        (await properties.GetPropertiesByLandlordId(7)).Count(x => x.IsOccupied).Should().Be(1);
        (await properties.GetPropertyById(1, 10))!.IsOccupied.Should().BeFalse();
        (await properties.GetOccupiedPropertiesCountAsync(10)).Should().Be(1);
        (await properties.GetVacantPropertiesCountAsync(10)).Should().Be(2);
        (await properties.GetDashboardCountsAsync(10)).Should().Be((3, 3, 1));
    }

    [Fact]
    public async Task Kpi_counts_active_leases_once_and_ignores_flags_and_tenants()
    {
        var mapper = MapperFactory.Create();
        var leases = Cases().Select(c => mapper.Map<LoadLeaseDto>(MakeLease((string)c[0]))).ToList();
        var units = leases.Select((l, i) => new LoadUnitDto { Id = i + 1, PropertyId = 20, IsOccupied = true, Leases = [l, l] }).ToList();
        units.Add(new LoadUnitDto { Id = 50, PropertyId = 20, IsOccupied = true });
        var properties = new Mock<IPropertyRepository>();
        properties.Setup(x => x.GetPropertiesByOrganizationId(10)).ReturnsAsync([new LoadPropertyDto { Id = 20 }]);
        var repository = new Mock<IUnitRepository>();
        repository.Setup(x => x.GetUnitsByPropertyIds(It.IsAny<List<long>>(), 10)).ReturnsAsync(units);
        var service = new KPIReportService(properties.Object, Mock.Of<ILeaseRepository>(), Mock.Of<IPaymentRepository>(),
            repository.Object, Mock.Of<IExpenseRepository>(), NullLogger<KPIReportService>.Instance);
        var response = await service.GetOccupancyReport(10);
        response.Success.Should().BeTrue();
        response.Data!.OccupiedUnits.Should().Be(4);
        response.Data.VacantUnits.Should().Be(8);
        response.Data.OccupancyByProperty!.Single().OccupiedUnits.Should().Be(4);
    }

    [Fact]
    public async Task Portfolio_current_and_monthly_snapshots_use_the_same_lease_rule()
    {
        var today = DateTime.UtcNow.Date;
        var monthStart = new DateTime(today.Year, today.Month, 1);
        var open = new LoadLeaseDto { Id = 1, UnitId = 30, PropertyId = 20, StartDate = monthStart.AddMonths(-4), EndDate = null };
        var draft = new LoadLeaseDto { Id = 2, UnitId = 31, PropertyId = 20, StartDate = open.StartDate,
            EndDate = today.AddMonths(1), LeaseAgreement = new LoadLeaseAgreementDto { IsDrafted = true } };
        var property = new LoadPropertyDto { Id = 20, LandlordId = 7, Units =
            [new LoadUnitDto { Id = 30, Leases = [open] }, new LoadUnitDto { Id = 31, IsOccupied = true, Leases = [draft] }] };
        var properties = new Mock<IPropertyRepository>();
        properties.Setup(x => x.GetPropertiesByLandlordId(7, null)).ReturnsAsync([property]);
        var leases = new Mock<ILeaseRepository>();
        leases.Setup(x => x.GetLeasesByLandlordId(7, true)).ReturnsAsync([open, draft]);
        var service = new PropertyPortfolioService(properties.Object, leases.Object, Mock.Of<IPaymentRepository>(),
            Mock.Of<IExpenseRepository>(), NullLogger<PropertyPortfolioService>.Instance);
        var response = await service.GetPropertyPortfolioAnalytics(7, null, "3months");
        response.Success.Should().BeTrue();
        response.Data!.OccupancyRate.Should().Be(50m);
        response.Data.OccupancyHistory.Should().NotBeEmpty().And.OnlyContain(x => x.OccupancyRate == 50m);
    }

    [Fact]
    public async Task Calendar_repository_filters_drafts_and_deleted_but_preserves_inactive_history()
    {
        using var db = DbContextFactory.Create();
        var unit = new Unit { Id = 30, PropertyId = 20, Property = new Property { Id = 20 } };
        var kinds = new[] { "active", "terminated", "draft", "deleted", "openEnded" };
        for (var i = 0; i < kinds.Length; i++)
        {
            var lease = MakeLease(kinds[i]);
            lease.Id = i + 1;
            lease.Unit = unit;
            if (lease.LeaseAgreement != null)
            {
                lease.LeaseAgreement.Id = i + 1;
                lease.LeaseAgreement.LeaseId = lease.Id;
            }
            db.Leases.Add(lease);
        }
        await db.SaveChangesAsync();
        db.ChangeTracker.Clear();
        var repository = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, MapperFactory.Create());
        var leases = await repository.GetLeasesForCalendarAsync(20, DateTime.UtcNow.Date, DateTime.UtcNow.Date.AddDays(30));
        leases.Select(l => l.Id).Should().BeEquivalentTo(new long[] { 1, 2, 5 });
        leases.Single(l => l.Id == 2).IsActive.Should().BeFalse();
        leases.Single(l => l.Id == 5).EndDate.Should().BeNull();
    }

    [Fact]
    public async Task Calendar_drafts_deleted_and_terminated_do_not_block_availability_and_open_end_does()
    {
        var start = DateTime.UtcNow.Date;
        var end = start.AddDays(30);
        var properties = new Mock<IPropertyRepository>();
        properties.Setup(x => x.GetPropertyForCalendarAsync(20, 7)).ReturnsAsync(new LoadPropertyDto
        { Id = 20, LandlordId = 7, Units = [new LoadUnitDto { Id = 30 }] });
        var repository = new Mock<ILeaseRepository>();
        var mapper = MapperFactory.Create();
        var leases = new[] { "draft", "deleted", "terminated" }.Select(x => mapper.Map<LoadLeaseDto>(MakeLease(x))).ToList();
        foreach (var lease in leases) lease.PropertyId = 20;
        repository.Setup(x => x.GetLeasesForCalendarAsync(20, start, end)).ReturnsAsync(leases);
        var service = new PropertyPortfolioService(properties.Object, repository.Object, Mock.Of<IPaymentRepository>(),
            Mock.Of<IExpenseRepository>(), NullLogger<PropertyPortfolioService>.Instance);
        var vacant = await service.GetUnitAvailabilityCalendar(7, 20, start, end);
        vacant.Success.Should().BeTrue();
        vacant.Data!.Units.Single().AvailabilityPeriods.Should().ContainSingle(x => x.IsVacant);
        // Inactive history stays visible, but drafts and deleted leases never become periods.
        vacant.Data.Units.Single().LeasePeriods.Should().ContainSingle().Which.IsActive.Should().BeFalse();
        var open = mapper.Map<LoadLeaseDto>(MakeLease("openEnded")); open.PropertyId = 20;
        leases.Add(open);
        var occupied = await service.GetUnitAvailabilityCalendar(7, 20, start, end);
        occupied.Success.Should().BeTrue();
        occupied.Data!.Units.Single().AvailabilityPeriods.Should().ContainSingle(x => !x.IsVacant && x.StartDate == start && x.EndDate == end);
        occupied.Data.Units.Single().LeasePeriods.Should().ContainSingle(x => x.IsActive && x.EndDate == end);
    }
}
