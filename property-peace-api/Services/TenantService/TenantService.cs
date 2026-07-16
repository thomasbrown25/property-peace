

using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Services.UnitService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Repositories.Users;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.TenantService
{
    public class TenantService(ITenantRepository tenantRepository, IUnitRepository unitRepository, IUnitService unitService, IPropertyRepository propertyRepository, INotificationService notificationService, IUserRepository userRepository, IHttpContextAccessor httpContextAccessor, ILogger<TenantService> logger) : ITenantService
    {
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly IUnitRepository _unitRepository = unitRepository;
        private readonly IUnitService _unitService = unitService;
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<TenantService> _logger = logger;

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
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

                LoadTenantDto newTenant;

                // When adding to a unit (UnitId set), infer LeaseId from that unit's lease so they get linked. Imported/new tenants (no UnitId, no LeaseId) stay org-only.
                if (!tenant.LeaseId.HasValue && tenant.UnitId.HasValue)
                {
                    var unit = await _unitRepository.GetUnitById(tenant.UnitId.Value);
                    if (unit == null)
                    {
                        return ServiceResponse<LoadTenantDto>.CreateError("Invalid unit ID", "The specified unit does not exist.");
                    }
                    if (unit.Lease != null)
                    {
                        tenant.LeaseId = unit.Lease.Id;
                    }
                }

                // Set OrganizationId on the tenant DTO
                tenant.OrganizationId = organizationId.Value;

                var existingTenant = tenant.Id.HasValue ? await _tenantRepository.GetTenantById(tenant.Id.Value) : null;
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

                if (tenant.UserId.HasValue)
                {
                    await _userRepository.UpdateCurrentOrganizationIdAsync(tenant.UserId.Value, organizationId.Value);
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
                return ServiceResponse<LoadTenantDto>.CreateError("An error occurred while adding the tenant", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadTenantDto>>> GetTenantsByLeaseId(long leaseId)
        {
            try
            {
                var tenants = await _tenantRepository.GetTenantsByLeaseId(leaseId);

                return ServiceResponse<List<LoadTenantDto>>.CreateSuccess(
                    tenants,
                    "Tenants retrieved successfully"
                );
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenants by landlord ID");
                return ServiceResponse<List<LoadTenantDto>>.CreateError("An error occurred while retrieving tenants", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadTenantDto>> GetTenantById(long id)
        {
            try
            {
                var tenant = await _tenantRepository.GetTenantById(id);

                return new ServiceResponse<LoadTenantDto>
                {
                    Data = tenant,
                    Message = "Tenant retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenant with ID {Id}", id);
                return ServiceResponse<LoadTenantDto>.CreateError(
                   "Error retrieving tenant",
                   ex.Message,
                   ex.InnerException?.Message
               );
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
                return ServiceResponse<List<LoadTenantDto>>.CreateError("An error occurred while retrieving tenants", ex.Message, ex.InnerException?.Message);
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
                return ServiceResponse<List<LoadTenantDto>>.CreateError("An error occurred while retrieving tenants", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadTenantDto>> DeleteTenant(long id)
        {
            try
            {
                // Get tenant with all related data before removal
                var tenant = await _tenantRepository.GetTenantById(id);
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
                return ServiceResponse<LoadTenantDto>.CreateError(
                    "Error removing tenant",
                    ex.Message,
                    ex.InnerException?.Message
                );
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
                _logger.LogError(ex, "Error checking email existence for {Email}", email);
                return ServiceResponse<bool>.CreateError("Error checking email existence", ex.Message);
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

                var tenant = await _tenantRepository.GetTenantByEmail(email);
                
                if (tenant == null)
                {
                    return ServiceResponse<LoadTenantDto>.CreateError("Tenant not found", $"No tenant found with email {email}");
                }

                return ServiceResponse<LoadTenantDto>.CreateSuccess(tenant);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting tenant by email {Email}", email);
                return ServiceResponse<LoadTenantDto>.CreateError("Error getting tenant", ex.Message);
            }
        }
    }
}