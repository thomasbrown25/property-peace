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
