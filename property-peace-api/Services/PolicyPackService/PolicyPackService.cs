using AutoMapper;
using brownstone_hub_api.Dtos.PolicyPack;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.PolicyPacks;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.PolicyPackService
{
    public class PolicyPackService : IPolicyPackService
    {
        private readonly IPolicyPackRepository _repository;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<PolicyPackService> _logger;
        private readonly IMapper _mapper;

        public PolicyPackService(
            IPolicyPackRepository repository,
            IHttpContextAccessor httpContextAccessor,
            ILogger<PolicyPackService> logger,
            IMapper mapper)
        {
            _repository = repository;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
            _mapper = mapper;
        }

        private long? GetOrganizationIdFromContext()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        private long? GetUserIdFromContext()
        {
            // First try to get from HTTP context Items (set by OrganizationContextMiddleware)
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("UserId", out var userIdObj) == true && userIdObj is long userId)
            {
                return userId;
            }
            
            // Fallback to claims
            var userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                ?? _httpContextAccessor.HttpContext?.User?.FindFirst("userId")?.Value
                ?? _httpContextAccessor.HttpContext?.User?.FindFirst("sub")?.Value;
            
            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                return parsedUserId;
            }
            
            return null;
        }

        public async Task<ServiceResponse<LoadPolicyPackDto>> GetDefaultPolicyPackAsync()
        {
            try
            {
                var pack = await _repository.GetDefaultPolicyPackAsync();
                if (pack == null)
                {
                    return ServiceResponse<LoadPolicyPackDto>.CreateError("Default policy pack not found", "No default policy pack has been configured.");
                }

                return ServiceResponse<LoadPolicyPackDto>.CreateSuccess(_mapper.Map<LoadPolicyPackDto>(pack));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving default policy pack");
                return ServiceResponse<LoadPolicyPackDto>.CreateError("Error retrieving default pack", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadPolicyPackDto>>> GetPolicyPacksByOrganizationAsync()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadPolicyPackDto>>.CreateError("Organization not found", "Unable to determine organization context.");
                }

                var packs = await _repository.GetPolicyPacksByOrganizationAsync(organizationId.Value);
                var dtos = packs.Select(p => _mapper.Map<LoadPolicyPackDto>(p)).ToList();

                return ServiceResponse<List<LoadPolicyPackDto>>.CreateSuccess(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving policy packs for organization");
                return ServiceResponse<List<LoadPolicyPackDto>>.CreateError("Error retrieving policy packs", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadPolicyPackDto>> GetPolicyPackByIdAsync(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var pack = await _repository.GetPolicyPackByIdAsync(id, organizationId);
                if (pack == null)
                {
                    return ServiceResponse<LoadPolicyPackDto>.CreateError("Policy pack not found", "The specified policy pack does not exist or you do not have access to it.");
                }

                return ServiceResponse<LoadPolicyPackDto>.CreateSuccess(_mapper.Map<LoadPolicyPackDto>(pack));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving policy pack {PolicyPackId}", id);
                return ServiceResponse<LoadPolicyPackDto>.CreateError("Error retrieving policy pack", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadPolicyPackDto>> CreatePolicyPackAsync(CreatePolicyPackDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var userId = GetUserIdFromContext();

                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadPolicyPackDto>.CreateError("Organization not found", "Unable to determine organization context.");
                }

                var pack = new PolicyPack
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    OrganizationId = organizationId.Value,
                    CreatedBy = userId,
                    Items = dto.Items.Select((item, index) => new PolicyPackItem
                    {
                        Title = item.Title,
                        Content = item.Content,
                        Category = item.Category,
                        Order = item.Order > 0 ? item.Order : index + 1
                    }).ToList()
                };

                var created = await _repository.CreatePolicyPackAsync(pack);
                return ServiceResponse<LoadPolicyPackDto>.CreateSuccess(_mapper.Map<LoadPolicyPackDto>(created));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating policy pack");
                return ServiceResponse<LoadPolicyPackDto>.CreateError("Error creating policy pack", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadPolicyPackDto>> UpdatePolicyPackAsync(UpdatePolicyPackDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var userId = GetUserIdFromContext();

                var existing = await _repository.GetPolicyPackByIdAsync(dto.Id, organizationId);
                if (existing == null)
                {
                    return ServiceResponse<LoadPolicyPackDto>.CreateError("Policy pack not found", "The specified policy pack does not exist or you do not have access to it.");
                }

                // Don't allow updating system default packs
                if (existing.IsDefault)
                {
                    return ServiceResponse<LoadPolicyPackDto>.CreateError("Cannot update default pack", "System default policy packs cannot be modified.");
                }

                existing.Name = dto.Name;
                existing.Description = dto.Description;
                existing.UpdatedBy = userId;

                // Update items - remove existing and add new
                existing.Items.Clear();
                foreach (var itemDto in dto.Items)
                {
                    var item = new PolicyPackItem
                    {
                        Title = itemDto.Title,
                        Content = itemDto.Content,
                        Category = itemDto.Category,
                        Order = itemDto.Order
                    };
                    existing.Items.Add(item);
                }

                var updated = await _repository.UpdatePolicyPackAsync(existing);
                return ServiceResponse<LoadPolicyPackDto>.CreateSuccess(_mapper.Map<LoadPolicyPackDto>(updated));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating policy pack {PolicyPackId}", dto.Id);
                return ServiceResponse<LoadPolicyPackDto>.CreateError("Error updating policy pack", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeletePolicyPackAsync(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization not found", "Unable to determine organization context.");
                }

                var result = await _repository.DeletePolicyPackAsync(id, organizationId.Value);
                if (!result)
                {
                    return ServiceResponse<bool>.CreateError("Cannot delete policy pack", "Policy pack not found, is a system default, or you do not have permission to delete it.");
                }

                return ServiceResponse<bool>.CreateSuccess(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting policy pack {PolicyPackId}", id);
                return ServiceResponse<bool>.CreateError("Error deleting policy pack", ex.Message);
            }
        }
    }
}
