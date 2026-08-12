using Xunit;
using System.Security.Claims;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Infrastructure;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Services.ChecklistService;
using brownstone_hub_api.Services.UnitService;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;

namespace brownstone_hub_api.Tests.Services.Units;

public sealed class UnitCreationEntitlementTests
{
    private readonly Mock<IUnitRepository> _units = new();
    private readonly Mock<IPropertyRepository> _properties = new();
    private readonly Mock<IEntitlementDecisionService> _decisions = new();
    private readonly RecordingCoordinator _coordinator = new();

    [Fact]
    public async Task Add_uses_exact_trusted_scope_quantity_and_commits_only_allowed_decision()
    {
        var service = Service(scope: true);
        SetupProperty();
        EntitlementDecisionRequest? request = null;
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .Callback<EntitlementDecisionRequest, CancellationToken>((value, _) => request = value)
            .ReturnsAsync(Decision(true, EntitlementDecisionCategory.Allowed));
        _units.Setup(x => x.AddUnit(It.IsAny<UpdateUnitDto>(), 77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LoadUnitDto { Id = 1 });

        var response = await service.AddOrUpdateUnit(new UpdateUnitDto { PropertyId = 77 });

        Assert.True(response.Success);
        Assert.Equal("42", request!.AuthenticatedUserId);
        Assert.Equal(20, request.OrganizationId);
        Assert.Equal(20, request.ResourceOrganizationId);
        Assert.Equal(1, request.RequestedQuantity);
        Assert.Equal(FeatureKeys.PropertyManagement, request.Feature);
        Assert.True(_coordinator.LastMutationSucceeded);
        _units.Verify(x => x.AddUnit(It.Is<UpdateUnitDto>(u => u.Id == 0), 77, 20, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Bulk_uses_exact_validated_count()
    {
        var service = Service(scope: true);
        SetupProperty();
        EntitlementDecisionRequest? request = null;
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .Callback<EntitlementDecisionRequest, CancellationToken>((value, _) => request = value)
            .ReturnsAsync(Decision(true, EntitlementDecisionCategory.Allowed));
        _units.Setup(x => x.BulkCreateUnits(It.IsAny<BulkCreateUnitsDto>(), 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);
        var dto = new BulkCreateUnitsDto
        {
            PropertyId = 77,
            Units = [new(), new(), new()]
        };

        var response = await service.BulkCreateUnits(dto);

        Assert.True(response.Success);
        Assert.Equal(3, request!.RequestedQuantity);
        Assert.True(_coordinator.LastMutationSucceeded);
    }

    [Theory]
    [InlineData(EntitlementDecisionCategory.Upgrade, 403, "Unit limit reached")]
    [InlineData(EntitlementDecisionCategory.Unauthorized, 403, "Forbidden")]
    [InlineData(EntitlementDecisionCategory.Unavailable, 503, "Unit creation unavailable")]
    [InlineData(EntitlementDecisionCategory.Setup, 503, "Unit creation unavailable")]
    public async Task Denials_are_stable_and_never_mutate(
        EntitlementDecisionCategory category, int status, string message)
    {
        var service = Service(scope: true);
        SetupProperty();
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Decision(false, category));

        var response = await service.AddOrUpdateUnit(new UpdateUnitDto { PropertyId = 77 });

        Assert.False(response.Success);
        Assert.Equal(status, response.StatusCode);
        Assert.Equal(message, response.Message);
        Assert.False(_coordinator.LastMutationSucceeded);
        _units.Verify(x => x.AddUnit(It.IsAny<UpdateUnitDto>(), It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Contradictory_allowed_decision_fails_unavailable()
    {
        var service = Service(scope: true);
        SetupProperty();
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Decision(true, EntitlementDecisionCategory.Upgrade));

        var response = await service.AddOrUpdateUnit(new UpdateUnitDto { PropertyId = 77 });

        Assert.Equal(503, response.StatusCode);
        _units.Verify(x => x.AddUnit(It.IsAny<UpdateUnitDto>(), It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Missing_scope_fails_closed_before_property_or_decision()
    {
        var response = await Service(scope: false).AddOrUpdateUnit(new UpdateUnitDto { PropertyId = 77 });

        Assert.Equal(403, response.StatusCode);
        _properties.Verify(x => x.GetPropertyByIdForMutationAsync(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
        _decisions.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Foreign_or_missing_property_is_generic_and_never_retries_unscoped()
    {
        var service = Service(scope: true);
        _properties.Setup(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>())).ReturnsAsync((LoadPropertyDto?)null);

        var response = await service.AddOrUpdateUnit(new UpdateUnitDto { PropertyId = 77 });

        Assert.Equal(403, response.StatusCode);
        _properties.Verify(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()), Times.Once);
        _properties.Verify(x => x.GetPropertyById(It.IsAny<long>()), Times.Never);
        _properties.Verify(x => x.GetPropertyById(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
        _decisions.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Bulk_foreign_or_missing_property_is_generic_and_never_mutates()
    {
        var service = Service(scope: true);
        _properties.Setup(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((LoadPropertyDto?)null);

        var response = await service.BulkCreateUnits(new BulkCreateUnitsDto
        {
            PropertyId = 77,
            Units = [new()]
        });

        Assert.Equal(403, response.StatusCode);
        Assert.False(_coordinator.LastMutationSucceeded);
        _properties.Verify(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()), Times.Once);
        _properties.Verify(x => x.GetPropertyById(It.IsAny<long>()), Times.Never);
        _properties.Verify(x => x.GetPropertyById(It.IsAny<long>(), It.IsAny<long>()), Times.Never);
        _decisions.VerifyNoOtherCalls();
        _units.Verify(x => x.BulkCreateUnits(
            It.IsAny<BulkCreateUnitsDto>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Empty_bulk_fails_before_coordinator_and_decision()
    {
        var response = await Service(scope: true).BulkCreateUnits(new BulkCreateUnitsDto { PropertyId = 77, Units = [] });

        Assert.Equal(400, response.StatusCode);
        Assert.Equal(0, _coordinator.Calls);
        _decisions.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Decision_exception_is_generic_service_unavailable()
    {
        var service = Service(scope: true);
        SetupProperty();
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("secret diagnostic"));

        var response = await service.AddOrUpdateUnit(new UpdateUnitDto { PropertyId = 77 });

        Assert.Equal(503, response.StatusCode);
        Assert.DoesNotContain("secret", response.Message, StringComparison.OrdinalIgnoreCase);
        _units.Verify(x => x.AddUnit(It.IsAny<UpdateUnitDto>(), It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Cancellation_propagates_and_never_mutates()
    {
        var service = Service(scope: true);
        SetupProperty();
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new OperationCanceledException());

        await Assert.ThrowsAsync<OperationCanceledException>(() =>
            service.AddOrUpdateUnit(new UpdateUnitDto { PropertyId = 77 }, new CancellationToken(canceled: true)));
        _units.Verify(x => x.AddUnit(It.IsAny<UpdateUnitDto>(), It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Existing_same_organization_update_is_not_entitlement_gated()
    {
        _units.Setup(x => x.GetUnitByIdForMutationAsync(9, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LoadUnitDto { Id = 9, PropertyId = 77 });
        _units.Setup(x => x.UpdateUnitForMutationAsync(It.IsAny<UpdateUnitDto>(), 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LoadUnitDto { Id = 9, PropertyId = 77 });

        var response = await Service(scope: true).AddOrUpdateUnit(new UpdateUnitDto { Id = 9, PropertyId = 77 });

        Assert.True(response.Success);
        Assert.Equal(0, _coordinator.Calls);
        _decisions.VerifyNoOtherCalls();
        _units.Verify(x => x.UpdateUnitForMutationAsync(
            It.Is<UpdateUnitDto>(u => u.Id == 9 && u.PropertyId == 77), 20, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Existing_update_requires_trusted_user_and_organization_scope()
    {
        var response = await Service(scope: false).AddOrUpdateUnit(new UpdateUnitDto { Id = 9, PropertyId = 77 });

        Assert.Equal(403, response.StatusCode);
        _units.Verify(x => x.GetUnitByIdForMutationAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
        _units.Verify(x => x.UpdateUnitForMutationAsync(
            It.IsAny<UpdateUnitDto>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Foreign_or_missing_existing_unit_is_generic_and_does_not_fall_back_to_creation()
    {
        _units.Setup(x => x.GetUnitByIdForMutationAsync(9, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((LoadUnitDto?)null);

        var response = await Service(scope: true).AddOrUpdateUnit(new UpdateUnitDto { Id = 9, PropertyId = 77 });

        Assert.Equal(403, response.StatusCode);
        _units.Verify(x => x.GetUnitById(9, null), Times.Never);
        _units.Verify(x => x.UpdateUnitForMutationAsync(
            It.IsAny<UpdateUnitDto>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
        _units.Verify(x => x.AddUnit(
            It.IsAny<UpdateUnitDto>(), It.IsAny<long>(), It.IsAny<long?>(), It.IsAny<CancellationToken>()), Times.Never);
        Assert.Equal(0, _coordinator.Calls);
    }

    [Fact]
    public async Task Existing_unit_cannot_be_moved_to_another_property()
    {
        _units.Setup(x => x.GetUnitByIdForMutationAsync(9, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LoadUnitDto { Id = 9, PropertyId = 77 });

        var response = await Service(scope: true).AddOrUpdateUnit(new UpdateUnitDto { Id = 9, PropertyId = 88 });

        Assert.Equal(403, response.StatusCode);
        _units.Verify(x => x.UpdateUnitForMutationAsync(
            It.IsAny<UpdateUnitDto>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
        _properties.Verify(x => x.GetPropertyByIdForMutationAsync(
            It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
        _decisions.VerifyNoOtherCalls();
    }

    private void SetupProperty() => _properties.Setup(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
        .ReturnsAsync(new LoadPropertyDto { Id = 77, OrganizationId = 20 });

    private UnitService Service(bool scope)
    {
        var context = new DefaultHttpContext();
        if (scope)
        {
            context.Items["OrganizationId"] = 20L;
            context.Items["UserId"] = 42L;
            context.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(ClaimTypes.NameIdentifier, "42")], "test"));
        }

        return new UnitService(
            _units.Object,
            Mock.Of<ILeaseRepository>(),
            Mock.Of<ITenantRepository>(),
            Mock.Of<IMaintenanceRequestRepository>(),
            _properties.Object,
            Mock.Of<IChecklistService>(),
            Mock.Of<IListingRepository>(),
            new HttpContextAccessor { HttpContext = context },
            _decisions.Object,
            _coordinator,
            Mock.Of<ILogger<UnitService>>());
    }

    private static UnifiedEntitlementDecision Decision(bool allowed, EntitlementDecisionCategory category) => new(
        allowed, category, "test", FeatureKeys.PropertyManagement, PlanKeys.Free,
        allowed ? EntitlementReasonCodes.Allowed : EntitlementReasonCodes.Quota);

    private sealed class RecordingCoordinator : IOrganizationEntitlementMutationCoordinator
    {
        public int Calls { get; private set; }
        public bool LastMutationSucceeded { get; private set; }

        public async Task<EntitlementMutationOutcome<T>> ExecuteAsync<T>(
            long organizationId,
            Func<CancellationToken, Task<EntitlementMutationOutcome<T>>> operation,
            CancellationToken cancellationToken = default)
        {
            Calls++;
            var result = await operation(cancellationToken);
            LastMutationSucceeded = result.MutationSucceeded;
            return result;
        }
    }
}
