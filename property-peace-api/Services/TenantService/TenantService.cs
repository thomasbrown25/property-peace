

using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.UnitService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.TenantService
{
    public class TenantService(ITenantRepository tenantRepository, IUnitRepository unitRepository, IUnitService unitService, IPropertyRepository propertyRepository, INotificationService notificationService, IUserRepository userRepository, IHttpContextAccessor httpContextAccessor, ILogger<TenantService> logger, DataContext dataContext) : ITenantService
    {
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly IUnitRepository _unitRepository = unitRepository;
        private readonly IUnitService _unitService = unitService;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<TenantService> _logger = logger;
        private readonly DataContext _dataContext = dataContext;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private async Task<bool> CanManageTenantsAsync(long organizationId)
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("UserId", out var userIdObject) != true || userIdObject is not long userId)
                return false;
            return await _dataContext.OrganizationMembers.AsNoTracking().AnyAsync(member =>
                member.UserId == userId && member.OrganizationId == organizationId && member.IsActive
                && member.Organization.IsActive && !member.Organization.IsDeleted
                && (member.Role == "Owner" || member.Role == "Manager" && member.CanManageTenants));
        }

        public async Task<ServiceResponse<LoadTenantDto>> AddOrUpdateTenant(AddTenantDto tenant)
        {
            try
            {
                // Get organization ID from context
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadTenantDto>.CreateError(
                        "Organization context is required",
                        "Organization context is required to create or update tenants.",
                        "",
                        403
                    );
                }

                if (!await CanManageTenantsAsync(organizationId.Value))
                    return ServiceResponse<LoadTenantDto>.CreateError("You do not have permission to manage tenants for this organization", statusCode: 403);

                LoadTenantDto newTenant;

                // Validate relationship IDs inside the selected organization. A lease cannot be attached without its scoped unit.
                if (tenant.LeaseId.HasValue && !tenant.UnitId.HasValue)
                    return ServiceResponse<LoadTenantDto>.CreateError("A unit is required when assigning a lease", statusCode: 400);

                if (tenant.UnitId.HasValue)
                {
                    var requestedLeaseId = tenant.LeaseId;
                    var unit = await _unitRepository.GetUnitById(tenant.UnitId.Value, organizationId.Value);
                    if (unit == null)
                    {
                        return ServiceResponse<LoadTenantDto>.CreateError("Invalid unit ID", "The specified unit does not exist.");
                    }
                    if (requestedLeaseId.HasValue && unit.Lease?.Id != requestedLeaseId.Value)
                        return ServiceResponse<LoadTenantDto>.CreateError("The selected lease does not belong to the selected unit", statusCode: 400);
                    tenant.LeaseId = unit.Lease?.Id;
                }

                // Set OrganizationId on the tenant DTO
                tenant.OrganizationId = organizationId.Value;

                var existingTenant = tenant.Id.HasValue ? await _tenantRepository.GetTenantById(tenant.Id.Value, organizationId.Value) : null;
                if (tenant.Id.HasValue && existingTenant == null)
                    return ServiceResponse<LoadTenantDto>.CreateError("Tenant not found", statusCode: 404);
                if (tenant.UserId.HasValue && tenant.UserId != existingTenant?.UserId)
                    return ServiceResponse<LoadTenantDto>.CreateError("User accounts can only be connected through an accepted tenant invite", statusCode: 400);
                tenant.UserId = existingTenant?.UserId;
                var isNewTenant = existingTenant == null;

                // Note: We allow creating placeholder tenants (UserId = null) even if a tenant with that email exists
                // because placeholders are temporary and will be cleaned up when the invite is accepted.
                // The existing tenant will be updated with the new unitId/leaseId when they accept the invite.

                if (existingTenant != null)
                {
                    newTenant = await _tenantRepository.UpdateTenant(existingTenant.Id, tenant);
                }
                else
                {
                    newTenant = await _tenantRepository.AddTenant(tenant);
                }

                // Create notification for new tenant
                if (isNewTenant && newTenant.PropertyId > 0)
                {
                    try
                    {
                        var property = await _propertyRepository.GetPropertyById((long)newTenant.PropertyId);
                        if (property != null)
                        {
                            var tenantName = $"{newTenant.Firstname} {newTenant.Lastname}".Trim();
                            var notificationDto = new CreateNotificationDto
                            {
                                UserId = property.LandlordId,
                                Type = ENotificationType.Message,
                                Title = "New Tenant Added",
                                Message = $"New tenant {tenantName} has been added to {newTenant.PropertyName}{(string.IsNullOrEmpty(newTenant.UnitName) ? "" : $", {newTenant.UnitName}")}",
                                RelatedId = newTenant.Id,
                                SendEmail = true,
                                SendSMS = true
                            };

                            await _notificationService.CreateNotification(notificationDto);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Failed to create notification for new tenant {TenantId}", newTenant.Id);
                    }
                }

                return ServiceResponse<LoadTenantDto>.CreateSuccess(
                       newTenant,
                       isNewTenant ? "Tenant added successfully" : "Tenant updated successfully"
                   );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding tenant");
                return ServiceResponse<LoadTenantDto>.CreateError("An error occurred while adding the tenant");
            }
        }

        public async Task<ServiceResponse<List<LoadTenantDto>>> GetTenantsByLeaseId(long leaseId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                    return ServiceResponse<List<LoadTenantDto>>.CreateError("Organization context is required", statusCode: 403);
                var tenants = await _tenantRepository.GetTenantsByLeaseId(leaseId, organizationId.Value);

                return ServiceResponse<List<LoadTenantDto>>.CreateSuccess(
                    tenants,
                    "Tenants retrieved successfully"
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenants by landlord ID");
                return ServiceResponse<List<LoadTenantDto>>.CreateError("An error occurred while retrieving tenants");
            }
        }

        public async Task<ServiceResponse<LoadTenantDto>> GetTenantById(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                    return ServiceResponse<LoadTenantDto>.CreateError("Organization context is required", statusCode: 403);
                var tenant = await _tenantRepository.GetTenantById(id, organizationId.Value);

                return new ServiceResponse<LoadTenantDto>
                {
                    Data = tenant,
                    Message = "Tenant retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenant with ID {Id}", id);
                return ServiceResponse<LoadTenantDto>.CreateError("Error retrieving tenant");
            }
        }

        public async Task<ServiceResponse<List<LoadTenantDto>>> GetAllTenantsByLandlord(long landlordId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadTenantDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var tenants = await _tenantRepository.GetAllTenantsByOrganizationId(organizationId.Value);

                return ServiceResponse<List<LoadTenantDto>>.CreateSuccess(
                    tenants,
                    "Tenants retrieved successfully"
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenants by landlord ID");
                return ServiceResponse<List<LoadTenantDto>>.CreateError("An error occurred while retrieving tenants");
            }
        }

        public async Task<ServiceResponse<List<LoadTenantDto>>> GetAllTenantsByOrganizationId(long organizationId)
        {
            try
            {
                var tenants = await _tenantRepository.GetAllTenantsByOrganizationId(organizationId);

                return ServiceResponse<List<LoadTenantDto>>.CreateSuccess(
                    tenants,
                    "Tenants retrieved successfully"
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenants by organization ID {OrganizationId}", organizationId);
                return ServiceResponse<List<LoadTenantDto>>.CreateError("An error occurred while retrieving tenants");
            }
        }

        public async Task<ServiceResponse<LoadTenantDto>> DeleteTenant(long id)
        {
            try
            {
                // Get tenant with all related data before removal
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                    return ServiceResponse<LoadTenantDto>.CreateError("Organization context is required", statusCode: 403);
                if (!await CanManageTenantsAsync(organizationId.Value))
                    return ServiceResponse<LoadTenantDto>.CreateError("You do not have permission to manage tenants for this organization", statusCode: 403);
                var tenant = await _tenantRepository.GetTenantById(id, organizationId.Value);
                if (tenant == null)
                {
                    return ServiceResponse<LoadTenantDto>.CreateError(
                        "Tenant not found",
                        $"No tenant found with ID {id}."
                    );
                }

                // Note: User account is preserved - we only remove the tenant record from the landlord's portfolio
                // This allows the tenant to retain access to historical documents and conversations

                // Perform tenant removal (this will handle cascading deletes for TenantInvites via DB config)
                // TenantDocuments and Conversations are preserved per user requirement
                var removedTenant = await _tenantRepository.DeleteTenant(id);

                if (removedTenant == null)
                {
                    return ServiceResponse<LoadTenantDto>.CreateError(
                        "Tenant not found",
                        $"No tenant found with ID {id}."
                    );
                }

                return new ServiceResponse<LoadTenantDto>
                {
                    Data = removedTenant,
                    Message = "Tenant removed from portfolio successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing tenant with ID {Id}", id);
                return ServiceResponse<LoadTenantDto>.CreateError("Error removing tenant");
            }
        }

        public async Task<ServiceResponse<bool>> CheckEmailExists(string email)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(email))
                {
                    return new ServiceResponse<bool> { Data = false };
                }

                // Check if email exists in Users table
                bool existsInUsers = await _userRepository.UserExists(email);

                // Check if email exists in Tenants table
                bool existsInTenants = await _tenantRepository.TenantEmailExists(email);

                bool emailExists = existsInUsers || existsInTenants;

                return new ServiceResponse<bool> { Data = emailExists };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking tenant email existence");
                return ServiceResponse<bool>.CreateError("Error checking email existence");
            }
        }

        public async Task<ServiceResponse<LoadTenantDto>> GetTenantByEmail(string email)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(email))
                {
                    return ServiceResponse<LoadTenantDto>.CreateError("Email is required");
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                    return ServiceResponse<LoadTenantDto>.CreateError("Organization context is required", statusCode: 403);
                var tenant = await _tenantRepository.GetTenantByEmail(email, organizationId.Value);

                if (tenant == null)
                {
                    return ServiceResponse<LoadTenantDto>.CreateError("Tenant not found");
                }

                return ServiceResponse<LoadTenantDto>.CreateSuccess(tenant);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant by email");
                return ServiceResponse<LoadTenantDto>.CreateError("Error getting tenant");
            }
        }
    }
}