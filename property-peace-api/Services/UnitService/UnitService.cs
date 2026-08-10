
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Services.ChecklistService;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Infrastructure;
using brownstone_hub_api.Entitlements.Policy;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace brownstone_hub_api.Services.UnitService
{
    public class UnitService(IUnitRepository unitRepository, ILeaseRepository leaseRepository, ITenantRepository tenantRepository, IMaintenanceRequestRepository maintenanceRequestRepository, IPropertyRepository propertyRepository, IChecklistService checklistService, IListingRepository listingRepository, IHttpContextAccessor httpContextAccessor, IEntitlementDecisionService entitlementDecisionService, IOrganizationEntitlementMutationCoordinator mutationCoordinator, ILogger<UnitService> logger) : IUnitService
    {
        private readonly IUnitRepository _unitRepository = unitRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IChecklistService _checklistService = checklistService;
        private readonly IListingRepository _listingRepository = listingRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly IEntitlementDecisionService _entitlementDecisionService = entitlementDecisionService;
        private readonly IOrganizationEntitlementMutationCoordinator _mutationCoordinator = mutationCoordinator;
        private readonly ILogger<UnitService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private bool TryGetTrustedCreationScope(out long userId, out long organizationId)
        {
            userId = 0;
            organizationId = 0;
            var context = _httpContextAccessor.HttpContext;
            if (context?.Items.TryGetValue("OrganizationId", out var organizationValue) != true ||
                organizationValue is not long selectedOrganizationId || selectedOrganizationId <= 0 ||
                context.Items.TryGetValue("UserId", out var userValue) != true ||
                userValue is not long selectedUserId || selectedUserId <= 0 ||
                !long.TryParse(context.User.FindFirstValue(ClaimTypes.NameIdentifier), out var subjectUserId) ||
                subjectUserId != selectedUserId)
            {
                return false;
            }

            userId = selectedUserId;
            organizationId = selectedOrganizationId;
            return true;
        }

        public async Task<ServiceResponse<List<LoadUnitDto>>> GetUnits(long propertyId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var units = await _unitRepository.GetUnits(propertyId, organizationId);

                return new ServiceResponse<List<LoadUnitDto>>
                {
                    Data = units,
                    Message = "Units retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving units for property: {propertyId}", propertyId);
                return ServiceResponse<List<LoadUnitDto>>.CreateError(
                    "Error retrieving units",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

        public async Task<ServiceResponse<LoadUnitDto>> AddOrUpdateUnit(
            UpdateUnitDto updatedUnit,
            CancellationToken cancellationToken = default)
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();

                if (!TryGetTrustedCreationScope(out var userId, out var organizationId))
                {
                    return Forbidden<LoadUnitDto>();
                }

                if (updatedUnit.Id > 0)
                {
                    var existingUnit = await _unitRepository.GetUnitByIdForMutationAsync(
                        updatedUnit.Id, organizationId, cancellationToken);
                    if (existingUnit is null || existingUnit.PropertyId != updatedUnit.PropertyId)
                    {
                        return Forbidden<LoadUnitDto>();
                    }

                    var updated = await _unitRepository.UpdateUnitForMutationAsync(
                        updatedUnit, organizationId, cancellationToken);
                    return updated is null
                        ? Forbidden<LoadUnitDto>()
                        : ServiceResponse<LoadUnitDto>.CreateSuccess(updated, "Unit saved successfully");
                }

                var outcome = await _mutationCoordinator.ExecuteAsync(
                    organizationId,
                    async token =>
                    {
                        var property = await _propertyRepository.GetPropertyByIdForMutationAsync(updatedUnit.PropertyId, organizationId, token);
                        if (property?.OrganizationId != organizationId)
                        {
                            return EntitlementMutationOutcome<ServiceResponse<LoadUnitDto>>.Rollback(Forbidden<LoadUnitDto>());
                        }

                        var decision = await _entitlementDecisionService.DecideAsync(
                            new EntitlementDecisionRequest(
                                userId.ToString(System.Globalization.CultureInfo.InvariantCulture),
                                organizationId,
                                FeatureKeys.PropertyManagement,
                                RequestedQuantity: 1,
                                ResourceOrganizationId: organizationId),
                            token);

                        var denial = MapDecisionDenial<LoadUnitDto>(decision);
                        if (denial is not null)
                        {
                            return EntitlementMutationOutcome<ServiceResponse<LoadUnitDto>>.Rollback(denial);
                        }

                        // Repository insert is deliberately inside the serializable transaction.
                        updatedUnit.Id = 0;
                        var created = await _unitRepository.AddUnit(updatedUnit, updatedUnit.PropertyId, organizationId, token);
                        return EntitlementMutationOutcome<ServiceResponse<LoadUnitDto>>.Commit(
                            ServiceResponse<LoadUnitDto>.CreateSuccess(created, "Unit saved successfully"));
                    },
                    cancellationToken);

                return outcome.Value;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unit creation is unavailable for property {PropertyId}", updatedUnit.PropertyId);
                return Unavailable<LoadUnitDto>();
            }
        }

        public async Task<ServiceResponse<List<LoadUnitDto>>> BulkCreateUnits(
            BulkCreateUnitsDto bulkCreateDto,
            CancellationToken cancellationToken = default)
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (bulkCreateDto?.Units is null || bulkCreateDto.Units.Count <= 0)
                {
                    return ServiceResponse<List<LoadUnitDto>>.CreateError(
                        "Invalid unit quantity",
                        "A positive unit quantity is required.",
                        statusCode: StatusCodes.Status400BadRequest,
                        suppressDetailedErrors: true);
                }

                // Count is materialized and validated before the policy call; checked conversion
                // prevents a future non-List DTO implementation from silently overflowing.
                int unitsToAdd;
                try
                {
                    unitsToAdd = checked(bulkCreateDto.Units.Count);
                }
                catch (OverflowException)
                {
                    return ServiceResponse<List<LoadUnitDto>>.CreateError(
                        "Invalid unit quantity", statusCode: StatusCodes.Status400BadRequest,
                        suppressDetailedErrors: true);
                }

                if (!TryGetTrustedCreationScope(out var userId, out var organizationId))
                {
                    return Forbidden<List<LoadUnitDto>>();
                }

                var outcome = await _mutationCoordinator.ExecuteAsync(
                    organizationId,
                    async token =>
                    {
                        var property = await _propertyRepository.GetPropertyByIdForMutationAsync(bulkCreateDto.PropertyId, organizationId, token);
                        if (property?.OrganizationId != organizationId)
                        {
                            return EntitlementMutationOutcome<ServiceResponse<List<LoadUnitDto>>>.Rollback(Forbidden<List<LoadUnitDto>>());
                        }

                        var decision = await _entitlementDecisionService.DecideAsync(
                            new EntitlementDecisionRequest(
                                userId.ToString(System.Globalization.CultureInfo.InvariantCulture),
                                organizationId,
                                FeatureKeys.PropertyManagement,
                                RequestedQuantity: unitsToAdd,
                                ResourceOrganizationId: organizationId),
                            token);

                        var denial = MapDecisionDenial<List<LoadUnitDto>>(decision);
                        if (denial is not null)
                        {
                            return EntitlementMutationOutcome<ServiceResponse<List<LoadUnitDto>>>.Rollback(denial);
                        }

                        var created = await _unitRepository.BulkCreateUnits(bulkCreateDto, organizationId, token);
                        return EntitlementMutationOutcome<ServiceResponse<List<LoadUnitDto>>>.Commit(
                            ServiceResponse<List<LoadUnitDto>>.CreateSuccess(
                                created,
                                $"Successfully created {created.Count} unit(s)"));
                    },
                    cancellationToken);

                return outcome.Value;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unit creation is unavailable for property {PropertyId}", bulkCreateDto?.PropertyId);
                return Unavailable<List<LoadUnitDto>>();
            }
        }

        private static ServiceResponse<T>? MapDecisionDenial<T>(UnifiedEntitlementDecision? decision)
        {
            if (decision is not null && decision.IsAllowed && decision.Category == EntitlementDecisionCategory.Allowed)
            {
                return null;
            }

            if (decision is not null && !decision.IsAllowed && decision.Category == EntitlementDecisionCategory.Upgrade)
            {
                return ServiceResponse<T>.CreateError(
                    "Unit limit reached",
                    "Upgrade your plan to add more units.",
                    statusCode: StatusCodes.Status403Forbidden,
                    suppressDetailedErrors: true);
            }

            if (decision is not null && !decision.IsAllowed && decision.Category == EntitlementDecisionCategory.Unauthorized)
            {
                return Forbidden<T>();
            }

            // Includes null, contradictory/malformed decisions, setup, expired, and unavailable facts/policy.
            return Unavailable<T>();
        }

        private static ServiceResponse<T> Forbidden<T>() => ServiceResponse<T>.CreateError(
            "Forbidden",
            statusCode: StatusCodes.Status403Forbidden,
            suppressDetailedErrors: true);

        private static ServiceResponse<T> Unavailable<T>() => ServiceResponse<T>.CreateError(
            "Unit creation unavailable",
            statusCode: StatusCodes.Status503ServiceUnavailable,
            suppressDetailedErrors: true);

        public async Task<ServiceResponse<LoadUnitDto>> GetUnitById(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var unit = await _unitRepository.GetUnitById(id, organizationId);

                return new ServiceResponse<LoadUnitDto>
                {
                    Data = unit,
                    Message = "Unit retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving unit with ID {Id}", id);
                return ServiceResponse<LoadUnitDto>.CreateError(
                   "Error retrieving units",
                   ex.Message,
                   ex.InnerException?.Message
               );
            }
        }

        public async Task<ServiceResponse<LoadUnitDto>> DeleteUnit(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var lease = await _leaseRepository.GetLease(id, organizationId);

                // Get tenants BEFORE deleting the lease
                long? leaseId = lease?.Id;
                var tenants = leaseId.HasValue ? await _tenantRepository.GetTenantsByLeaseId(leaseId.Value) : null;

                if (tenants != null && tenants.Count > 0)
                {
                    foreach (var tenant in tenants)
                    {
                        await _tenantRepository.DeleteTenant(tenant.Id);
                    }
                }

                // Delete the lease (this will cascade delete payments and deposits)
                if (lease != null)
                {
                    await _leaseRepository.DeleteLease(lease.Id);
                }

                // Delete maintenance requests for this unit
                var maintenanceRequests = await _maintenanceRequestRepository.GetMaintenanceRequestsByUnitId(id);
                if (maintenanceRequests != null && maintenanceRequests.Count > 0)
                {
                    foreach (var request in maintenanceRequests)
                    {
                        await _maintenanceRequestRepository.DeleteMaintenanceRequest(request.Id);
                    }
                }

                // Delete listings for this unit (must happen before unit delete due to FK_Listings_Units_UnitId)
                var listings = await _listingRepository.GetListingsByUnitId(id);
                foreach (var listing in listings)
                {
                    await _listingRepository.DeleteListing(listing.Id);
                }

                var unit = await _unitRepository.DeleteUnit(id);
                if (unit == null)
                {
                    return ServiceResponse<LoadUnitDto>.CreateError(
                        "Unit not found",
                        $"No unit found with ID {id}."
                    );
                }

                return new ServiceResponse<LoadUnitDto>
                {
                    Data = unit,
                    Message = "Unit deleted successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting unit with ID {Id}", id);
                return ServiceResponse<LoadUnitDto>.CreateError(
                    "Error deleting unit",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

    }
}
