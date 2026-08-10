using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Properties;

public sealed class PropertyRepositoryOrganizationScopeTests : IDisposable
{
    private readonly Data.DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task GetPropertyById_WithOrganizationScope_ReturnsOwnPropertyAndRejectsForeignProperty()
    {
        var own = PropertyWithUnit(101, 10, 1001);
        var foreign = PropertyWithUnit(202, 20, 2002);
        _context.Properties.AddRange(own, foreign);
        await _context.SaveChangesAsync();
        var repository = new PropertyRepository(
            _context,
            NullLogger<PropertyRepository>.Instance,
            MapperFactory.Create());

        var ownResult = await repository.GetPropertyById(own.Id, 10);
        var foreignResult = await repository.GetPropertyById(foreign.Id, 10);

        ownResult.Should().NotBeNull();
        ownResult!.Units.Should().ContainSingle(unit => unit.Id == 1001 && unit.PropertyId == own.Id);
        foreignResult.Should().BeNull();
    }

    [Fact]
    public async Task Inactive_lookup_and_state_mutations_are_organization_scoped()
    {
        var ownActive = PropertyWithUnit(101, 10, 1001);
        var foreignActive = PropertyWithUnit(202, 20, 2002);
        var ownInactive = PropertyWithUnit(303, 10, 3003);
        ownInactive.IsDeleted = true;
        ownInactive.DeletedAt = DateTime.UtcNow;
        var foreignInactive = PropertyWithUnit(404, 20, 4004);
        foreignInactive.IsDeleted = true;
        foreignInactive.DeletedAt = DateTime.UtcNow;
        _context.Properties.AddRange(ownActive, foreignActive, ownInactive, foreignInactive);
        await _context.SaveChangesAsync();
        var repository = new PropertyRepository(
            _context, NullLogger<PropertyRepository>.Instance, MapperFactory.Create());

        var ownInactiveResult = await repository.GetInactivePropertyByIdForMutationAsync(
            ownInactive.Id, 10, CancellationToken.None);
        var foreignInactiveResult = await repository.GetInactivePropertyByIdForMutationAsync(
            foreignInactive.Id, 10, CancellationToken.None);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => repository.InactivateProperty(
            foreignActive.Id, 10, CancellationToken.None));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => repository.ReactivateProperty(
            foreignInactive.Id, 10, CancellationToken.None));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => repository.DeleteProperty(
            foreignActive.Id, 10, CancellationToken.None));

        var inactivated = await repository.InactivateProperty(ownActive.Id, 10, CancellationToken.None);
        var reactivated = await repository.ReactivateProperty(ownInactive.Id, 10, CancellationToken.None);

        ownInactiveResult.Should().NotBeNull();
        ownInactiveResult!.Units.Should().HaveCount(1);
        foreignInactiveResult.Should().BeNull();
        inactivated.IsDeleted.Should().BeTrue();
        reactivated.IsDeleted.Should().BeFalse();
        (await _context.Properties.FindAsync(foreignActive.Id)).Should().NotBeNull();
        (await _context.Properties.FindAsync(foreignInactive.Id))!.IsDeleted.Should().BeTrue();
    }

    private static Property PropertyWithUnit(long propertyId, long organizationId, long unitId)
    {
        var property = new Property
        {
            Id = propertyId,
            LandlordId = 99,
            OrganizationId = organizationId,
            Name = $"Property {propertyId}",
            StreetAddress = $"{propertyId} Test Street"
        };
        property.Units.Add(new Unit
        {
            Id = unitId,
            PropertyId = propertyId,
            Property = property,
            OrganizationId = organizationId,
            Name = "1"
        });
        return property;
    }
}
