using System.Security.Claims;
using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Infrastructure;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.ApplicationInvites;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.RecurringExpenses;
using brownstone_hub_api.Repositories.TenantDocuments;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.ChecklistService;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Services.PropertyService;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Properties;

public sealed class PropertyCreationEntitlementTests
{
    private readonly Mock<IPropertyRepository> _properties = new();
    private readonly Mock<IUnitRepository> _units = new();
    private readonly Mock<IEntitlementDecisionService> _decisions = new();
    private readonly RecordingCoordinator _coordinator = new();
    private readonly Mock<IImageService<PropertyImage, LoadImageDto, AddImageDto>> _images = new();

    [Fact]
    public async Task Single_family_creation_uses_trusted_scope_exact_quantity_and_ignores_client_landlord()
    {
        SetupPropertyInsert();
        EntitlementDecisionRequest? request = null;
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .Callback<EntitlementDecisionRequest, CancellationToken>((value, _) => request = value)
            .ReturnsAsync(Decision(true, EntitlementDecisionCategory.Allowed, PlanKeys.Free));
        _units.Setup(x => x.AddUnit(It.IsAny<UpdateUnitDto>(), 77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LoadUnitDto { Id = 1, PropertyId = 77, Name = "Unit 1" });
        var dto = new UpdatePropertyDto
        {
            PropertyType = EPropertyType.SingleFamily,
            LandlordId = 999,
            OrganizationId = 999,
            Name = "Home"
        };

        var response = await Service().AddOrUpdateProperty(dto, []);

        Assert.True(response.Success);
        Assert.Equal("42", request!.AuthenticatedUserId);
        Assert.Equal(20, request.OrganizationId);
        Assert.Equal(20, request.ResourceOrganizationId);
        Assert.Equal(1, request.RequestedQuantity);
        Assert.Equal(FeatureKeys.PropertyManagement, request.Feature);
        Assert.Equal(42, dto.LandlordId);
        Assert.Equal(20, dto.OrganizationId);
        Assert.True(_coordinator.LastMutationSucceeded);
        _properties.Verify(x => x.AddProperty(dto, It.IsAny<CancellationToken>()), Times.Once);
        _units.Verify(x => x.AddUnit(It.Is<UpdateUnitDto>(u => u.Name == "Unit 1"), 77, 20, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData("Premium")]
    [InlineData("Lifetime")]
    public async Task Unlimited_plans_create_property_and_all_requested_initial_units(string plan)
    {
        SetupPropertyInsert();
        EntitlementDecisionRequest? request = null;
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .Callback<EntitlementDecisionRequest, CancellationToken>((value, _) => request = value)
            .ReturnsAsync(Decision(true, EntitlementDecisionCategory.Allowed, new PlanKey(plan)));
        _units.Setup(x => x.BulkCreateUnits(It.IsAny<BulkCreateUnitsDto>(), 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync([new(), new(), new()]);

        var response = await Service().AddOrUpdateProperty(new UpdatePropertyDto
        {
            PropertyType = EPropertyType.MultiUnit,
            UnitCount = 3,
            Name = "Triplex"
        }, []);

        Assert.True(response.Success);
        Assert.Equal(3, request!.RequestedQuantity);
        _units.Verify(x => x.BulkCreateUnits(
            It.Is<BulkCreateUnitsDto>(b => b.PropertyId == 77 && b.Units.Count == 3),
            20, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Free_at_quota_rolls_back_without_inserting_property_or_units()
    {
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Decision(false, EntitlementDecisionCategory.Upgrade, PlanKeys.Free));

        var response = await Service().AddOrUpdateProperty(new UpdatePropertyDto
        {
            PropertyType = EPropertyType.SingleFamily,
            Name = "Denied"
        }, []);

        Assert.Equal(403, response.StatusCode);
        Assert.Equal("Unit limit reached", response.Message);
        Assert.False(_coordinator.LastMutationSucceeded);
        _properties.Verify(x => x.AddProperty(It.IsAny<UpdatePropertyDto>(), It.IsAny<CancellationToken>()), Times.Never);
        _properties.Verify(x => x.DeleteProperty(It.IsAny<long>()), Times.Never);
        _units.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(null)]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task Multi_unit_creation_requires_a_positive_unit_count_before_any_mutation(int? unitCount)
    {
        var response = await Service().AddOrUpdateProperty(new UpdatePropertyDto
        {
            PropertyType = EPropertyType.MultiUnit,
            UnitCount = unitCount,
            Name = "Invalid multi-unit"
        }, [Mock.Of<IFormFile>()]);

        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.Equal("Invalid unit count", response.Message);
        Assert.Equal(0, _coordinator.Calls);
        _decisions.VerifyNoOtherCalls();
        _properties.VerifyNoOtherCalls();
        _units.VerifyNoOtherCalls();
        _images.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Duplicate_creation_does_not_write_property_units_or_images()
    {
        _properties.Setup(x => x.PropertyNameExistsInOrganization("Existing", 20, null)).ReturnsAsync(true);

        var response = await Service().AddOrUpdateProperty(
            new UpdatePropertyDto
            {
                PropertyType = EPropertyType.SingleFamily,
                Name = "Existing"
            },
            [Mock.Of<IFormFile>()]);

        Assert.Equal(StatusCodes.Status400BadRequest, response.StatusCode);
        Assert.Equal("Duplicate Property Name", response.Message);
        Assert.False(_coordinator.LastMutationSucceeded);
        _properties.Verify(x => x.AddProperty(It.IsAny<UpdatePropertyDto>(), It.IsAny<CancellationToken>()), Times.Never);
        _units.VerifyNoOtherCalls();
        _images.VerifyNoOtherCalls();
        _decisions.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Foreign_existing_property_update_is_forbidden_and_does_not_consume_quota()
    {
        _properties.Setup(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((LoadPropertyDto?)null);

        var response = await Service().AddOrUpdateProperty(new UpdatePropertyDto
        {
            Id = 77,
            OrganizationId = 999,
            LandlordId = 999,
            Name = "Foreign"
        }, []);

        Assert.Equal(403, response.StatusCode);
        _decisions.VerifyNoOtherCalls();
        _properties.Verify(x => x.UpdatePropertyForMutationAsync(
            It.IsAny<UpdatePropertyDto>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Same_organization_update_is_scoped_and_not_entitlement_gated()
    {
        _properties.Setup(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LoadPropertyDto { Id = 77, OrganizationId = 20, LandlordId = 42 });
        _properties.Setup(x => x.PropertyNameExistsInOrganization("Updated", 20, 77)).ReturnsAsync(false);
        _properties.Setup(x => x.UpdatePropertyForMutationAsync(It.IsAny<UpdatePropertyDto>(), 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new LoadPropertyDto { Id = 77, OrganizationId = 20, LandlordId = 42, Name = "Updated" });

        var response = await Service().AddOrUpdateProperty(new UpdatePropertyDto
        {
            Id = 77,
            OrganizationId = 999,
            LandlordId = 999,
            Name = "Updated"
        }, []);

        Assert.True(response.Success);
        Assert.Equal(20, response.Data!.OrganizationId);
        Assert.Equal(0, _coordinator.Calls);
        _decisions.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Cancellation_propagates_before_any_mutation()
    {
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Service().AddOrUpdateProperty(
            new UpdatePropertyDto { PropertyType = EPropertyType.SingleFamily }, [], cancellation.Token));

        Assert.Equal(0, _coordinator.Calls);
        _properties.VerifyNoOtherCalls();
        _units.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Initial_unit_insert_failure_rolls_back_the_combined_mutation_and_skips_images()
    {
        SetupPropertyInsert();
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Decision(true, EntitlementDecisionCategory.Allowed, PlanKeys.Free));
        _units.Setup(x => x.AddUnit(It.IsAny<UpdateUnitDto>(), 77, 20, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("insert failed"));

        var response = await Service().AddOrUpdateProperty(
            new UpdatePropertyDto { PropertyType = EPropertyType.SingleFamily, Name = "Rollback" },
            [Mock.Of<IFormFile>()]);

        Assert.Equal(503, response.StatusCode);
        Assert.False(_coordinator.LastMutationSucceeded);
        _images.Verify(x => x.AddImages(It.IsAny<long>(), It.IsAny<List<IFormFile>>()), Times.Never);
        _properties.Verify(x => x.DeleteProperty(It.IsAny<long>()), Times.Never);
    }

    [Fact]
    public async Task Concurrent_creations_are_serialized_so_only_one_can_take_the_last_slot()
    {
        var createdUnits = 0;
        var nextPropertyId = 76L;
        _properties.Setup(x => x.PropertyNameExistsInOrganization(It.IsAny<string>(), 20, null))
            .ReturnsAsync(false);
        _properties.Setup(x => x.AddProperty(It.IsAny<UpdatePropertyDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UpdatePropertyDto dto, CancellationToken _) => new LoadPropertyDto
            {
                Id = Interlocked.Increment(ref nextPropertyId),
                Name = dto.Name,
                OrganizationId = 20,
                LandlordId = 42,
                PropertyType = dto.PropertyType
            });
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => Volatile.Read(ref createdUnits) == 0
                ? Decision(true, EntitlementDecisionCategory.Allowed, PlanKeys.Free)
                : Decision(false, EntitlementDecisionCategory.Upgrade, PlanKeys.Free));
        _units.Setup(x => x.AddUnit(It.IsAny<UpdateUnitDto>(), It.IsAny<long>(), 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UpdateUnitDto unit, long propertyId, long? _, CancellationToken __) =>
            {
                Interlocked.Increment(ref createdUnits);
                return new LoadUnitDto { Id = 1, PropertyId = propertyId, Name = unit.Name };
            });
        var service = Service();

        var responses = await Task.WhenAll(
            service.AddOrUpdateProperty(new UpdatePropertyDto
                { PropertyType = EPropertyType.SingleFamily, Name = "One" }, []),
            service.AddOrUpdateProperty(new UpdatePropertyDto
                { PropertyType = EPropertyType.SingleFamily, Name = "Two" }, []));

        Assert.Single(responses, response => response.Success);
        Assert.Single(responses, response => response.StatusCode == StatusCodes.Status403Forbidden);
        Assert.Equal(1, createdUnits);
        _properties.Verify(x => x.AddProperty(It.IsAny<UpdatePropertyDto>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    private void SetupPropertyInsert()
    {
        _properties.Setup(x => x.PropertyNameExistsInOrganization(It.IsAny<string>(), 20, null)).ReturnsAsync(false);
        _properties.Setup(x => x.AddProperty(It.IsAny<UpdatePropertyDto>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((UpdatePropertyDto dto, CancellationToken _) => new LoadPropertyDto
            {
                Id = 77,
                Name = dto.Name,
                OrganizationId = dto.OrganizationId,
                LandlordId = dto.LandlordId,
                PropertyType = dto.PropertyType
            });
    }

    private PropertyService Service()
    {
        var context = new DefaultHttpContext();
        context.Items["OrganizationId"] = 20L;
        context.Items["UserId"] = 42L;
        context.User = new ClaimsPrincipal(new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, "42")], "test"));

        return new PropertyService(
            _properties.Object,
            _images.Object,
            Mock.Of<IMaintenanceRequestRepository>(),
            Mock.Of<ILeaseRepository>(),
            Mock.Of<IExpenseRepository>(),
            Mock.Of<IRecurringExpenseRepository>(),
            Mock.Of<IConversationRepository>(),
            Mock.Of<IApplicationRepository>(),
            Mock.Of<IChecklistRepository>(),
            Mock.Of<ITenantDocumentRepository>(),
            Mock.Of<IPaymentRepository>(),
            _units.Object,
            Mock.Of<IApplicationInviteRepository>(),
            Mock.Of<IChecklistService>(),
            Mock.Of<ITenantRepository>(),
            Mock.Of<BlobServiceClient>(),
            Mock.Of<IAzureBlobService>(),
            new HttpContextAccessor { HttpContext = context },
            Mock.Of<IListingRepository>(),
            _decisions.Object,
            _coordinator,
            Mock.Of<ILogger<PropertyService>>());
    }

    private static UnifiedEntitlementDecision Decision(
        bool allowed, EntitlementDecisionCategory category, PlanKey plan) => new(
        allowed, category, "test", FeatureKeys.PropertyManagement, plan,
        allowed ? EntitlementReasonCodes.Allowed : EntitlementReasonCodes.Quota);

    private sealed class RecordingCoordinator : IOrganizationEntitlementMutationCoordinator
    {
        private readonly SemaphoreSlim _mutex = new(1, 1);
        public int Calls { get; private set; }
        public bool LastMutationSucceeded { get; private set; }

        public async Task<EntitlementMutationOutcome<T>> ExecuteAsync<T>(
            long organizationId,
            Func<CancellationToken, Task<EntitlementMutationOutcome<T>>> operation,
            CancellationToken cancellationToken = default)
        {
            Calls++;
            await _mutex.WaitAsync(cancellationToken);
            try
            {
                var result = await operation(cancellationToken);
                LastMutationSucceeded = result.MutationSucceeded;
                return result;
            }
            catch
            {
                LastMutationSucceeded = false;
                throw;
            }
            finally
            {
                _mutex.Release();
            }
        }
    }
}
