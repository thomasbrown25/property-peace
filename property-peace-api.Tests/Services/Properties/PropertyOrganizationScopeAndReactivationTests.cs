using System.Security.Claims;
using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Infrastructure;
using brownstone_hub_api.Entitlements.Policy;
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

public sealed class PropertyOrganizationScopeAndReactivationTests
{
    private readonly Mock<IPropertyRepository> _properties = new();
    private readonly Mock<IEntitlementDecisionService> _decisions = new();
    private readonly RecordingCoordinator _coordinator = new();

    [Fact]
    public async Task Read_uses_trusted_organization_and_foreign_id_fails_closed()
    {
        _properties.Setup(x => x.GetPropertyById(77, 20)).ReturnsAsync((LoadPropertyDto?)null);

        var response = await Service().GetPropertyById(77);

        Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
        _properties.Verify(x => x.GetPropertyById(77, 20), Times.Once);
        _properties.Verify(x => x.GetPropertyById(77), Times.Never);
    }

    [Fact]
    public async Task Delete_uses_trusted_organization_and_foreign_id_has_no_side_effects()
    {
        _properties.Setup(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((LoadPropertyDto?)null);

        var response = await Service().DeleteProperty(77);

        Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
        _properties.Verify(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()), Times.Once);
        _properties.Verify(x => x.DeleteProperty(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Inactivate_uses_trusted_organization_and_foreign_id_has_no_side_effects()
    {
        _properties.Setup(x => x.GetPropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((LoadPropertyDto?)null);

        var response = await Service().InactivateProperty(77);

        Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
        _properties.Verify(x => x.InactivateProperty(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Reactivate_locates_only_inactive_property_in_trusted_organization_and_charges_all_restored_units()
    {
        _properties.Setup(x => x.GetInactivePropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(InactiveProperty(77, 20, 3));
        _properties.Setup(x => x.ReactivateProperty(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(InactiveProperty(77, 20, 3));
        EntitlementDecisionRequest? request = null;
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .Callback<EntitlementDecisionRequest, CancellationToken>((value, _) => request = value)
            .ReturnsAsync(Decision(true, EntitlementDecisionCategory.Allowed));

        var response = await Service().ReactivateProperty(77);

        Assert.True(response.Success);
        Assert.Equal("42", request!.AuthenticatedUserId);
        Assert.Equal(20, request.OrganizationId);
        Assert.Equal(20, request.ResourceOrganizationId);
        Assert.Equal(3, request.RequestedQuantity);
        Assert.Equal(FeatureKeys.PropertyManagement, request.Feature);
        Assert.True(_coordinator.LastMutationSucceeded);
        _properties.Verify(x => x.ReactivateProperty(77, 20, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Reactivate_foreign_id_fails_closed_before_entitlement_or_mutation()
    {
        _properties.Setup(x => x.GetInactivePropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((LoadPropertyDto?)null);

        var response = await Service().ReactivateProperty(77);

        Assert.Equal(StatusCodes.Status404NotFound, response.StatusCode);
        Assert.False(_coordinator.LastMutationSucceeded);
        _decisions.VerifyNoOtherCalls();
        _properties.Verify(x => x.ReactivateProperty(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Reactivate_quota_denial_rolls_back_without_clearing_IsDeleted()
    {
        _properties.Setup(x => x.GetInactivePropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(InactiveProperty(77, 20, 2));
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Decision(false, EntitlementDecisionCategory.Upgrade));

        var response = await Service().ReactivateProperty(77);

        Assert.Equal(StatusCodes.Status403Forbidden, response.StatusCode);
        Assert.False(_coordinator.LastMutationSucceeded);
        _properties.Verify(x => x.ReactivateProperty(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Reactivate_entitlement_error_rolls_back_and_fails_closed()
    {
        _properties.Setup(x => x.GetInactivePropertyByIdForMutationAsync(77, 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync(InactiveProperty(77, 20, 1));
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("decision unavailable"));

        var response = await Service().ReactivateProperty(77);

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, response.StatusCode);
        Assert.False(_coordinator.LastMutationSucceeded);
        _properties.Verify(x => x.ReactivateProperty(It.IsAny<long>(), It.IsAny<long>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Concurrent_reactivations_are_serialized_so_only_one_can_take_the_last_quota_slot()
    {
        var restored = 0;
        _properties.Setup(x => x.GetInactivePropertyByIdForMutationAsync(It.IsAny<long>(), 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((long id, long _, CancellationToken __) => InactiveProperty(id, 20, 1));
        _decisions.Setup(x => x.DecideAsync(It.IsAny<EntitlementDecisionRequest>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => Volatile.Read(ref restored) == 0
                ? Decision(true, EntitlementDecisionCategory.Allowed)
                : Decision(false, EntitlementDecisionCategory.Upgrade));
        _properties.Setup(x => x.ReactivateProperty(It.IsAny<long>(), 20, It.IsAny<CancellationToken>()))
            .ReturnsAsync((long id, long _, CancellationToken __) =>
            {
                Interlocked.Increment(ref restored);
                return InactiveProperty(id, 20, 1);
            });
        var service = Service();

        var responses = await Task.WhenAll(service.ReactivateProperty(77), service.ReactivateProperty(88));

        Assert.Single(responses, response => response.Success);
        Assert.Single(responses, response => response.StatusCode == StatusCodes.Status403Forbidden);
        Assert.Equal(1, restored);
        _properties.Verify(x => x.ReactivateProperty(It.IsAny<long>(), 20, It.IsAny<CancellationToken>()), Times.Once);
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
            Mock.Of<IImageService<PropertyImage, LoadImageDto, AddImageDto>>(),
            Mock.Of<IMaintenanceRequestRepository>(), Mock.Of<ILeaseRepository>(),
            Mock.Of<IExpenseRepository>(), Mock.Of<IRecurringExpenseRepository>(),
            Mock.Of<IConversationRepository>(), Mock.Of<IApplicationRepository>(),
            Mock.Of<IChecklistRepository>(), Mock.Of<ITenantDocumentRepository>(),
            Mock.Of<IPaymentRepository>(), Mock.Of<IUnitRepository>(),
            Mock.Of<IApplicationInviteRepository>(), Mock.Of<IChecklistService>(),
            Mock.Of<ITenantRepository>(), Mock.Of<BlobServiceClient>(),
            Mock.Of<IAzureBlobService>(), new HttpContextAccessor { HttpContext = context },
            Mock.Of<IListingRepository>(), _decisions.Object, _coordinator,
            Mock.Of<ILogger<PropertyService>>());
    }

    private static LoadPropertyDto InactiveProperty(long id, long organizationId, int unitCount) => new()
    {
        Id = id,
        OrganizationId = organizationId,
        LandlordId = 42,
        Units = Enumerable.Range(1, unitCount).Select(i => new LoadUnitDto { Id = i, PropertyId = id }).ToList()
    };

    private static UnifiedEntitlementDecision Decision(bool allowed, EntitlementDecisionCategory category) => new(
        allowed, category, "test", FeatureKeys.PropertyManagement, PlanKeys.Free,
        allowed ? EntitlementReasonCodes.Allowed : EntitlementReasonCodes.Quota);

    private sealed class RecordingCoordinator : IOrganizationEntitlementMutationCoordinator
    {
        private readonly SemaphoreSlim _mutex = new(1, 1);
        public bool LastMutationSucceeded { get; private set; }

        public async Task<EntitlementMutationOutcome<T>> ExecuteAsync<T>(long organizationId,
            Func<CancellationToken, Task<EntitlementMutationOutcome<T>>> operation,
            CancellationToken cancellationToken = default)
        {
            await _mutex.WaitAsync(cancellationToken);
            try
            {
                var outcome = await operation(cancellationToken);
                LastMutationSucceeded = outcome.MutationSucceeded;
                return outcome;
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
