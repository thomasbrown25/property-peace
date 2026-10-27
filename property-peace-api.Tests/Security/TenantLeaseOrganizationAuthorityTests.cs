using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Security;
using AutoMapper;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Security;

public sealed class TenantLeaseOrganizationAuthorityTests
{
    [Theory]
    [InlineData(false, false, false, false, true)]
    [InlineData(true, false, false, false, false)]
    [InlineData(false, true, false, false, false)]
    [InlineData(false, false, true, false, false)]
    [InlineData(false, false, false, true, false)]
    public async Task TenantLeaseListRejectsStaleLinksButKeepsEndedLeases(
        bool deletedTenant, bool mismatchedTenant, bool mismatchedProperty, bool inactiveOrg, bool visible)
    {
        await using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        db.Organizations.AddRange(new Organization { Id = 101, IsActive = !inactiveOrg }, new Organization { Id = 202 });
        db.Users.Add(new User { Id = 888 });
        var property = new Property { Id = 301, LandlordId = 888, OrganizationId = mismatchedProperty ? 202 : 101 };
        var lease = new Lease { Id = 501, Unit = new Unit { Id = 401, Property = property, OrganizationId = 101 },
            OrganizationId = 101, IsActive = false };
        db.TenantLeases.Add(new TenantLease { Lease = lease, Tenant = new Tenant { Id = 601,
            UserId = 42, Firstname = "A", Lastname = "B", OrganizationId = mismatchedTenant ? 202 : 101,
            IsDeleted = deletedTenant } });
        await db.SaveChangesAsync();
        var mapper = new Mock<IMapper>();
        mapper.Setup(m => m.Map<List<LoadLeaseDto>>(It.IsAny<List<Lease>>()))
            .Returns((List<Lease> source) => source.Select(l => new LoadLeaseDto { Id = l.Id, OrganizationId = l.OrganizationId }).ToList());
        var repo = new LeaseRepository(db, NullLogger<LeaseRepository>.Instance, mapper.Object);
        var result = await repo.GetLeasesByTenantUserId(42);
        result.Select(x => x.Id).Should().BeEquivalentTo(visible ? [501L] : Array.Empty<long>());
    }
    [Theory]
    [InlineData(false, false, false, false, false, false, true)]
    [InlineData(true, false, false, false, false, false, false)]
    [InlineData(false, true, false, false, false, false, true)]
    [InlineData(false, false, true, false, false, false, false)]
    [InlineData(false, false, false, true, false, false, false)]
    [InlineData(false, false, false, false, true, false, false)]
    [InlineData(false, false, false, false, false, true, false)]
    public async Task AuthorityRequiresAlignedActiveNondeletedTenantLeasePropertyAndOrganization(
        bool deletedTenant, bool inactiveLease, bool deletedLease, bool deletedProperty,
        bool mismatchedProperty, bool inactiveOrg, bool authorized)
    {
        await using var db = new DataContext(new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var organization = new Organization { Id = 101, IsActive = !inactiveOrg };
        var other = new Organization { Id = 202 };
        db.Organizations.AddRange(organization, other);
        var property = new Property { Id = 301, LandlordId = 888, OrganizationId = mismatchedProperty ? 202 : 101,
            IsDeleted = deletedProperty };
        var unit = new Unit { Id = 401, Property = property, OrganizationId = 101 };
        var lease = new Lease { Id = 501, Unit = unit, UnitId = 401, OrganizationId = 101,
            IsActive = !inactiveLease, IsDeleted = deletedLease };
        var tenant = new Tenant { Id = 601, Firstname = "Tenant", Lastname = "Self", UserId = 42,
            OrganizationId = 101, IsDeleted = deletedTenant };
        db.TenantLeases.Add(new TenantLease { Tenant = tenant, Lease = lease });
        await db.SaveChangesAsync();
        var authority = new OrganizationAuthorityResolver(db);
        (await authority.GetTenantLeaseOrganizationIdsAsync(42)).Should().BeEquivalentTo(authorized ? [101L] : Array.Empty<long>());
        (await authority.HasTenantLeaseInOrganizationAsync(42, 501, 101)).Should().Be(authorized);
        (await authority.HasTenantLeaseInOrganizationAsync(42, 501, 202)).Should().BeFalse();
        (await authority.GetTenantLeaseOrganizationIdsAsync(99)).Should().BeEmpty();
    }
}
