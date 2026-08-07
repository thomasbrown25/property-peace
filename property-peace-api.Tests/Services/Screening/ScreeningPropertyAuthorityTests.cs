using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.Screening;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningPropertyAuthorityTests
{
    [Fact]
    public async Task Active_capability_is_scoped_to_landlord_or_primary_manager_across_two_properties()
    {
        await using var db = NewDb();
        db.Organizations.Add(new Organization { Id = 10, Name = "Org" });
        db.Users.AddRange(
            new User { Id = 100, Email = "one@test", FirstName = "One", LastName = "Manager" },
            new User { Id = 200, Email = "two@test", FirstName = "Two", LastName = "Manager" });
        db.OrganizationMembers.AddRange(
            new OrganizationMember { Id = 1, OrganizationId = 10, UserId = 100, Role = "Manager", IsActive = true },
            new OrganizationMember { Id = 2, OrganizationId = 10, UserId = 200, Role = "Owner", IsActive = true });
        db.Properties.AddRange(
            Property(20, landlord: 100, primaryManager: null),
            Property(21, landlord: 200, primaryManager: 200));
        await db.SaveChangesAsync();
        var authority = new ScreeningPropertyAuthority(db);

        await authority.EnsurePropertyAuthorityAsync(10, 100, 20);
        await authority.EnsurePropertyAuthorityAsync(10, 200, 21);
        await authority.Invoking(x => x.EnsurePropertyAuthorityAsync(10, 100, 21))
            .Should().ThrowAsync<ScreeningAuthorizationException>("organization role alone cannot cross property boundaries");
        await authority.Invoking(x => x.EnsurePropertyAuthorityAsync(10, 200, 20))
            .Should().ThrowAsync<ScreeningAuthorizationException>("even an organization owner needs durable property assignment");
    }

    [Fact]
    public async Task Departed_employee_is_denied_even_when_still_assigned_to_property()
    {
        await using var db = NewDb();
        db.Organizations.Add(new Organization { Id = 10, Name = "Org" });
        db.Users.Add(new User { Id = 100, Email = "departed@test", FirstName = "Former", LastName = "Manager" });
        db.OrganizationMembers.Add(new OrganizationMember
            { Id = 1, OrganizationId = 10, UserId = 100, Role = "Manager", IsActive = false, CanManageTenants = true });
        db.Properties.Add(Property(20, landlord: 100, primaryManager: 100));
        await db.SaveChangesAsync();

        await new ScreeningPropertyAuthority(db).Invoking(x => x.EnsurePropertyAuthorityAsync(10, 100, 20))
            .Should().ThrowAsync<ScreeningAuthorizationException>();
    }

    private static DataContext NewDb() => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);

    private static Property Property(long id, long landlord, long? primaryManager) => new()
    {
        Id = id, OrganizationId = 10, LandlordId = landlord, PrimaryManagerId = primaryManager,
        State = "CA", StreetAddress = $"{id} Main", City = "X", ZipCode = "00000"
    };
}
