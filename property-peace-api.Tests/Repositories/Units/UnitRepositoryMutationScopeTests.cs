using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Repositories.Units;

public sealed class UnitRepositoryMutationScopeTests : IDisposable
{
    private readonly Data.DataContext _context = DbContextFactory.Create();

    public void Dispose() => _context.Dispose();

    [Fact]
    public async Task Scoped_update_mutates_only_exact_organization_and_preserves_property_id()
    {
        var ownProperty = PropertyWithUnit(101, 10, 1001, "Original");
        var secondOwnProperty = PropertyWithUnit(102, 10, 1002, "Second");
        _context.Properties.AddRange(ownProperty, secondOwnProperty);
        await _context.SaveChangesAsync();
        var repository = Repository();

        var result = await repository.UpdateUnitForMutationAsync(new UpdateUnitDto
        {
            Id = 1001,
            PropertyId = 102,
            Name = "Updated"
        }, 10);

        result.Should().NotBeNull();
        result!.PropertyId.Should().Be(101);
        var persisted = await _context.Units.AsNoTracking().SingleAsync(unit => unit.Id == 1001);
        persisted.PropertyId.Should().Be(101);
        persisted.Name.Should().Be("Updated");
    }

    [Fact]
    public async Task Scoped_lookup_and_update_hide_foreign_unit_and_do_not_mutate()
    {
        var foreignProperty = PropertyWithUnit(202, 20, 2002, "Foreign");
        _context.Properties.Add(foreignProperty);
        await _context.SaveChangesAsync();
        var repository = Repository();

        var lookup = await repository.GetUnitByIdForMutationAsync(2002, 10);
        var update = await repository.UpdateUnitForMutationAsync(new UpdateUnitDto
        {
            Id = 2002,
            PropertyId = 202,
            Name = "Compromised"
        }, 10);

        lookup.Should().BeNull();
        update.Should().BeNull();
        (await _context.Units.AsNoTracking().SingleAsync(unit => unit.Id == 2002))
            .Name.Should().Be("Foreign");
    }

    private UnitRepository Repository() => new(
        _context,
        NullLogger<UnitRepository>.Instance,
        MapperFactory.Create());

    private static Property PropertyWithUnit(long propertyId, long organizationId, long unitId, string unitName)
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
            Name = unitName
        });
        return property;
    }
}
