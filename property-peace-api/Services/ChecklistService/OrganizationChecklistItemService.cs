using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Users;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.ChecklistService
{
    public class OrganizationChecklistItemService(
        IOrganizationChecklistItemRepository organizationChecklistItemRepository,
        IUserRepository userRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<OrganizationChecklistItemService> logger) : IOrganizationChecklistItemService
    {
        private readonly IOrganizationChecklistItemRepository _organizationChecklistItemRepository = organizationChecklistItemRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<OrganizationChecklistItemService> _logger = logger;

        private async Task<long?> GetCurrentUserIdAsync()
        {
            var user = await _userRepository.GetCurrentUser();
            return user?.Id;
        }

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        public async Task<ServiceResponse<LoadOrganizationChecklistItemDto>> AddOrganizationChecklistItem(AddOrganizationChecklistItemDto item)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadOrganizationChecklistItemDto>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var result = await _organizationChecklistItemRepository.AddOrganizationChecklistItem(item, organizationId.Value);
                
                return new ServiceResponse<LoadOrganizationChecklistItemDto>
                {
                    Success = true,
                    Data = result,
                    Message = "Organization checklist item created successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding organization checklist item");
                return ServiceResponse<LoadOrganizationChecklistItemDto>.CreateError("An error occurred while creating the checklist item", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadOrganizationChecklistItemDto>> GetOrganizationChecklistItemById(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadOrganizationChecklistItemDto>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var item = await _organizationChecklistItemRepository.GetOrganizationChecklistItemById(id);
                
                if (item == null)
                {
                    return new ServiceResponse<LoadOrganizationChecklistItemDto>
                    {
                        Success = false,
                        Message = "Organization checklist item not found"
                    };
                }

                // Verify organization owns this item
                if (item.OrganizationId != organizationId.Value)
                {
                    return new ServiceResponse<LoadOrganizationChecklistItemDto>
                    {
                        Success = false,
                        Message = "Unauthorized access to checklist item"
                    };
                }
                
                return new ServiceResponse<LoadOrganizationChecklistItemDto>
                {
                    Success = true,
                    Data = item
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving organization checklist item");
                return ServiceResponse<LoadOrganizationChecklistItemDto>.CreateError("An error occurred while retrieving the checklist item", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadOrganizationChecklistItemDto>>> GetOrganizationChecklistItems()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadOrganizationChecklistItemDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var items = await _organizationChecklistItemRepository.GetOrganizationChecklistItemsByOrganizationId(organizationId.Value);
                
                return new ServiceResponse<List<LoadOrganizationChecklistItemDto>>
                {
                    Success = true,
                    Data = items
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving organization checklist items");
                return ServiceResponse<List<LoadOrganizationChecklistItemDto>>.CreateError("An error occurred while retrieving checklist items", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadOrganizationChecklistItemDto>> UpdateOrganizationChecklistItem(UpdateOrganizationChecklistItemDto item)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadOrganizationChecklistItemDto>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                // Verify organization owns this item
                var existingItem = await _organizationChecklistItemRepository.GetOrganizationChecklistItemById(item.Id);
                if (existingItem == null || existingItem.OrganizationId != organizationId.Value)
                {
                    return new ServiceResponse<LoadOrganizationChecklistItemDto>
                    {
                        Success = false,
                        Message = "Unauthorized access to checklist item"
                    };
                }

                var result = await _organizationChecklistItemRepository.UpdateOrganizationChecklistItem(item);
                
                return new ServiceResponse<LoadOrganizationChecklistItemDto>
                {
                    Success = true,
                    Data = result,
                    Message = "Organization checklist item updated successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating organization checklist item");
                return ServiceResponse<LoadOrganizationChecklistItemDto>.CreateError("An error occurred while updating the checklist item", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteOrganizationChecklistItem(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                // Verify organization owns this item
                var existingItem = await _organizationChecklistItemRepository.GetOrganizationChecklistItemById(id);
                if (existingItem == null || existingItem.OrganizationId != organizationId.Value)
                {
                    return new ServiceResponse<bool>
                    {
                        Success = false,
                        Message = "Unauthorized access to checklist item"
                    };
                }

                var result = await _organizationChecklistItemRepository.DeleteOrganizationChecklistItem(id);
                
                return new ServiceResponse<bool>
                {
                    Success = true,
                    Data = result,
                    Message = "Organization checklist item deleted successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting organization checklist item");
                return ServiceResponse<bool>.CreateError("An error occurred while deleting the checklist item", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> SeedDefaultChecklistItems()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                await _organizationChecklistItemRepository.SeedDefaultChecklistItems(organizationId.Value);
                
                return new ServiceResponse<bool>
                {
                    Success = true,
                    Data = true,
                    Message = "Default checklist items seeded successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error seeding default checklist items");
                return ServiceResponse<bool>.CreateError("An error occurred while seeding default checklist items", ex.Message);
            }
        }
    }
}

