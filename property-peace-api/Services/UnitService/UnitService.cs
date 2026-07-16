
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Services.ChecklistService;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.UnitService
{
    public class UnitService(IUnitRepository unitRepository, ILeaseRepository leaseRepository, ITenantRepository tenantRepository, IMaintenanceRequestRepository maintenanceRequestRepository, IPropertyRepository propertyRepository, IFeatureGateService featureGateService, ISubscriptionRepository subscriptionRepository, IChecklistService checklistService, IListingRepository listingRepository, IHttpContextAccessor httpContextAccessor, ILogger<UnitService> logger) : IUnitService
    {
        private readonly IUnitRepository _unitRepository = unitRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IFeatureGateService _featureGateService = featureGateService;
        private readonly ISubscriptionRepository _subscriptionRepository = subscriptionRepository;
        private readonly IChecklistService _checklistService = checklistService;
        private readonly IListingRepository _listingRepository = listingRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<UnitService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
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

        public async Task<ServiceResponse<LoadUnitDto>> AddOrUpdateUnit(UpdateUnitDto updatedUnit)
        {
            try
            {
                LoadUnitDto newUnit;

                var existingUnit = await _unitRepository.GetUnitById(updatedUnit.Id);
                if (existingUnit != null)
                {
                    // Updating existing unit - no limit check needed
                    newUnit = await _unitRepository.UpdateUnit(updatedUnit);
                }
                else
                {
                    // Adding new unit - check subscription limit
                    var property = await _propertyRepository.GetPropertyById(updatedUnit.PropertyId);
                    if (property == null)
                    {
                        return ServiceResponse<LoadUnitDto>.CreateError(
                            "Property Not Found",
                            $"Property with ID {updatedUnit.PropertyId} not found."
                        );
                    }

                    // Check if user can add unit to this property
                    var canAddUnit = await _featureGateService.CanAddUnitToPropertyAsync(property.LandlordId, updatedUnit.PropertyId);
                    if (!canAddUnit)
                    {
                        // Get subscription to provide helpful error message (subscriptions are organization-only)
                        Models.Subscription? subscription = null;
                        if (property.OrganizationId.HasValue)
                        {
                            subscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(property.OrganizationId.Value);
                        }
                        var maxTotalUnits = subscription?.SubscriptionPlan?.MaxTotalUnits;
                        var currentTotalUnits = await _featureGateService.GetCurrentTotalUnitsAsync(property.LandlordId);

                        var errorMessage = maxTotalUnits.HasValue
                            ? $"You've reached your plan's total unit limit ({currentTotalUnits}/{maxTotalUnits.Value} units). Upgrade your subscription to add more units."
                            : "You've reached your unit limit. Upgrade your subscription to add more units.";

                        return ServiceResponse<LoadUnitDto>.CreateError(
                            "Unit Limit Reached",
                            errorMessage,
                            "",
                            403
                        );
                    }

                    var organizationId = GetOrganizationIdFromContext();
                    newUnit = await _unitRepository.AddUnit(updatedUnit, updatedUnit.PropertyId, organizationId);

                    // Do not auto-create inspections/checklists when units are added.
                    // Users should intentionally create move-in or move-out inspections from the Inspections page.

                }

                return new ServiceResponse<LoadUnitDto>
                {
                    Data = newUnit,
                    Message = "Unit saved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving unit to property: {PropertyId}", updatedUnit.PropertyId);
                return ServiceResponse<LoadUnitDto>.CreateError(
                    "Error saving unit",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

        public async Task<ServiceResponse<List<LoadUnitDto>>> BulkCreateUnits(BulkCreateUnitsDto bulkCreateDto)
        {
            try
            {
                if (bulkCreateDto.Units == null || bulkCreateDto.Units.Count == 0)
                {
                    return ServiceResponse<List<LoadUnitDto>>.CreateError(
                        "No units provided",
                        "At least one unit must be provided for bulk creation."
                    );
                }

                // Check subscription limit before bulk creating
                var property = await _propertyRepository.GetPropertyById(bulkCreateDto.PropertyId);
                if (property == null)
                {
                    return ServiceResponse<List<LoadUnitDto>>.CreateError(
                        "Property Not Found",
                        $"Property with ID {bulkCreateDto.PropertyId} not found."
                    );
                }

                // Get current total units across all properties
                var currentTotalUnits = await _featureGateService.GetCurrentTotalUnitsAsync(property.LandlordId);
                var unitsToAdd = bulkCreateDto.Units.Count;
                var totalUnitsAfterAdd = currentTotalUnits + unitsToAdd;

                // Check if user can add these units (subscriptions are organization-only)
                Models.Subscription? subscription = null;
                if (property.OrganizationId.HasValue)
                {
                    subscription = await _subscriptionRepository.GetSubscriptionByOrganizationIdAsync(property.OrganizationId.Value);
                }
                if (subscription != null && (subscription.Status == "Active" || subscription.Status == "Trial"))
                {
                    var maxTotalUnits = subscription.SubscriptionPlan.MaxTotalUnits;
                    if (maxTotalUnits.HasValue && totalUnitsAfterAdd > maxTotalUnits.Value)
                    {
                        var errorMessage = $"Cannot add {unitsToAdd} unit(s). This would exceed your plan's total unit limit ({currentTotalUnits}/{maxTotalUnits.Value} units). " +
                                          $"Upgrade your subscription to add more units.";

                        return ServiceResponse<List<LoadUnitDto>>.CreateError(
                            "Unit Limit Exceeded",
                            errorMessage,
                            "",
                            403
                        );
                    }
                }

                var organizationId = GetOrganizationIdFromContext();
                var createdUnits = await _unitRepository.BulkCreateUnits(bulkCreateDto, organizationId);

                // Do not auto-create inspections/checklists for newly bulk-created units.
                // Users should intentionally create move-in or move-out inspections from the Inspections page.

                return new ServiceResponse<List<LoadUnitDto>>
                {
                    Data = createdUnits,
                    Message = $"Successfully created {createdUnits.Count} unit(s)"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error bulk creating units for property: {PropertyId}", bulkCreateDto.PropertyId);
                return ServiceResponse<List<LoadUnitDto>>.CreateError(
                    "Error bulk creating units",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

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
