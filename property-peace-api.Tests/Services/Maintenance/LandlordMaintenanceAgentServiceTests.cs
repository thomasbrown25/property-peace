using System.Reflection;
using System.Text.Json;
using brownstone_hub_api.Config;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.LandlordMaintenanceAgentService;
using brownstone_hub_api.Tests.Helpers;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Maintenance;

public sealed class LandlordMaintenanceAgentServiceTests
{
    [Theory]
    [InlineData(EPropertyType.SingleFamily, 1, true)]
    [InlineData(EPropertyType.SingleFamily, 0, true)]
    [InlineData(EPropertyType.SingleFamily, 2, false)]
    [InlineData(EPropertyType.MultiUnit, 1, false)]
    [InlineData(EPropertyType.MultiUnit, 2, false)]
    public async Task PropertyUnits_KeepUnitLabelInternalOnlyForSingleFamilyHomes(
        EPropertyType propertyType, int unitCount, bool usesPropertyLevelGreeting)
    {
        await using var context = DbContextFactory.Create();
        var property = new Property
        {
            Id = 42,
            LandlordId = 12,
            PropertyType = propertyType,
            StreetAddress = "123 Main Street"
        };
        context.Properties.Add(property);
        for (var index = 0; index < unitCount; index++)
        {
            context.Units.Add(new Unit { Id = 100 + index, PropertyId = property.Id, Name = $"Unit {index + 1}" });
        }
        await context.SaveChangesAsync();

        var service = new LandlordMaintenanceAgentService(
            context, Mock.Of<IMaintenanceRequestRepository>(), Mock.Of<IUserRepository>(),
            Options.Create(new AnthropicSettings()), NullLogger<LandlordMaintenanceAgentService>.Instance);
        var lookup = typeof(LandlordMaintenanceAgentService)
            .GetMethod("GetPropertyUnitsAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;

        using var result = JsonDocument.Parse(await (Task<string>)lookup.Invoke(service, [0L, 12L, 1])!);
        var payload = result.RootElement;

        Assert.Equal(42, payload.GetProperty("property_id").GetInt64());
        if (usesPropertyLevelGreeting)
        {
            Assert.True(payload.TryGetProperty("is_single_family_home", out var isSingleFamilyHome));
            Assert.True(isSingleFamilyHome.GetBoolean());
            Assert.Equal("123 Main Street", payload.GetProperty("property_name").GetString());
            Assert.False(payload.TryGetProperty("units", out _));
            if (unitCount == 0)
                Assert.Equal(JsonValueKind.Null, payload.GetProperty("default_unit_id").ValueKind);
            else
                Assert.Equal(100, payload.GetProperty("default_unit_id").GetInt64());
        }
        else
        {
            Assert.False(payload.TryGetProperty("is_single_family_home", out _));
            var units = payload.GetProperty("units");
            Assert.Equal(unitCount, units.GetArrayLength());
            Assert.Equal("Unit 1", units[0].GetProperty("name").GetString());
        }
    }
}
