using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.PropertyPortfolioService;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.PropertyPortfolio;

public class PropertyCalendarScopingTests
{
    private readonly Mock<IPropertyRepository> _properties = new();
    private readonly Mock<ILeaseRepository> _leases = new();
    private readonly PropertyPortfolioService _service;

    public PropertyCalendarScopingTests()
    {
        _service = new PropertyPortfolioService(_properties.Object, _leases.Object,
            Mock.Of<IPaymentRepository>(), Mock.Of<IExpenseRepository>(), Mock.Of<ILogger<PropertyPortfolioService>>());
    }

    [Fact]
    public async Task PropertyCalendar_ReadsOnlyRequestedPropertyAndItsLeases()
    {
        _properties.Setup(x => x.GetPropertyForCalendarAsync(20, 7)).ReturnsAsync(new LoadPropertyDto
        {
            Id = 20, LandlordId = 7, Name = "Selected", Units = [new LoadUnitDto { Id = 30, Name = "A" }]
        });
        _leases.Setup(x => x.GetLeasesForCalendarAsync(20, new DateTime(2026, 1, 1), new DateTime(2026, 12, 31))).ReturnsAsync([]);

        var result = await _service.GetUnitAvailabilityCalendar(7, 20,
            new DateTime(2026, 1, 1), new DateTime(2026, 12, 31));

        result.Success.Should().BeTrue();
        result.Data!.Units.Should().ContainSingle().Which.PropertyId.Should().Be(20);
        _properties.Verify(x => x.GetPropertiesByLandlordId(It.IsAny<long>(), It.IsAny<long?>()), Times.Never);
        _leases.Verify(x => x.GetLeasesByLandlordId(It.IsAny<long>(), It.IsAny<bool>()), Times.Never);
        _leases.Verify(x => x.GetLeasesForCalendarAsync(20, new DateTime(2026, 1, 1), new DateTime(2026, 12, 31)), Times.Once);
    }

    [Fact]
    public async Task PropertyCalendar_DoesNotLoadLeasesForAnotherLandlordsProperty()
    {
        _properties.Setup(x => x.GetPropertyForCalendarAsync(20, 7)).ReturnsAsync(new LoadPropertyDto { Id = 20, LandlordId = 8 });

        var result = await _service.GetUnitAvailabilityCalendar(7, 20, null, null);

        result.Success.Should().BeTrue();
        result.Data!.Units.Should().BeEmpty();
        _leases.VerifyNoOtherCalls();
        _properties.Verify(x => x.GetPropertiesByLandlordId(It.IsAny<long>(), It.IsAny<long?>()), Times.Never);
    }

    [Fact]
    public async Task PortfolioCalendar_StillReadsLandlordsPropertiesAndLeases()
    {
        _properties.Setup(x => x.GetPropertiesByLandlordId(7, null)).ReturnsAsync(
            [new LoadPropertyDto { Id = 20, LandlordId = 7, Units = [new LoadUnitDto { Id = 30 }] }]);
        _leases.Setup(x => x.GetLeasesByLandlordId(7, false)).ReturnsAsync([]);

        var result = await _service.GetUnitAvailabilityCalendar(7, null, null, null);

        result.Success.Should().BeTrue();
        result.Data!.Units.Should().ContainSingle();
        _leases.Verify(x => x.GetLeasesByLandlordId(7, false), Times.Once);
        _leases.Verify(x => x.GetLeasesByPropertyId(It.IsAny<long>(), It.IsAny<bool>(), It.IsAny<long?>()), Times.Never);
    }
}
