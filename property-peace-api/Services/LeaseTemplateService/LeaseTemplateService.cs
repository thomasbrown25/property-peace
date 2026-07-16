using AutoMapper;
using brownstone_hub_api.Dtos.LeaseTemplate;
using brownstone_hub_api.Dtos.LeaseGeneration;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.LeaseTemplates;
using brownstone_hub_api.Services.PolicyAIService;
using brownstone_hub_api.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Linq;

namespace brownstone_hub_api.Services.LeaseTemplateService
{
    public class LeaseTemplateService : ILeaseTemplateService
    {
        private readonly ILeaseTemplateRepository _repository;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly ILogger<LeaseTemplateService> _logger;
        private readonly IMapper _mapper;
        private readonly IPolicyAIService _policyAIService;
        private readonly DataContext _dataContext;

        public LeaseTemplateService(
            ILeaseTemplateRepository repository,
            IHttpContextAccessor httpContextAccessor,
            ILogger<LeaseTemplateService> logger,
            IMapper mapper,
            IPolicyAIService policyAIService,
            DataContext dataContext)
        {
            _repository = repository;
            _httpContextAccessor = httpContextAccessor;
            _logger = logger;
            _mapper = mapper;
            _policyAIService = policyAIService;
            _dataContext = dataContext;
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

        public async Task<ServiceResponse<LoadLeaseTemplateDto>> GetDefaultTemplateAsync()
        {
            try
            {
                var template = await _repository.GetDefaultTemplateAsync();
                if (template == null)
                {
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Default template not found", "No default lease template has been configured.");
                }

                return ServiceResponse<LoadLeaseTemplateDto>.CreateSuccess(_mapper.Map<LoadLeaseTemplateDto>(template));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving default lease template");
                return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Error retrieving default template", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadLeaseTemplateDto>>> GetTemplatesByOrganizationAsync()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadLeaseTemplateDto>>.CreateError("Organization not found", "Unable to determine organization context.");
                }

                var templates = await _repository.GetTemplatesByOrganizationAsync(organizationId.Value);
                var dtos = templates.Select(t => _mapper.Map<LoadLeaseTemplateDto>(t)).ToList();

                return ServiceResponse<List<LoadLeaseTemplateDto>>.CreateSuccess(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving templates for organization");
                return ServiceResponse<List<LoadLeaseTemplateDto>>.CreateError("Error retrieving templates", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseTemplateDto>> GetTemplateByIdAsync(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var template = await _repository.GetTemplateByIdAsync(id, organizationId);
                if (template == null)
                {
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Template not found", "The specified template does not exist or you do not have access to it.");
                }

                return ServiceResponse<LoadLeaseTemplateDto>.CreateSuccess(_mapper.Map<LoadLeaseTemplateDto>(template));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving template {TemplateId}", id);
                return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Error retrieving template", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseTemplateDto>> CreateTemplateAsync(CreateLeaseTemplateDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var userId = GetUserIdFromContext();

                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Organization not found", "Unable to determine organization context.");
                }

                var template = new LeaseTemplate
                {
                    Name = dto.Name,
                    Description = dto.Description,
                    State = dto.State,
                    PropertyType = dto.PropertyType,
                    TemplateStructure = dto.TemplateStructure,
                    IsDefaultForLandlord = dto.IsDefaultForLandlord,
                    OrganizationId = organizationId.Value,
                    CreatedBy = userId,
                    Version = "1.0",
                    Policies = dto.Policies.Select((policy, index) => new LeaseTemplatePolicy
                    {
                        Title = policy.Title,
                        Content = policy.Content,
                        Category = policy.Category,
                        Order = policy.Order > 0 ? policy.Order : index + 1
                    }).ToList()
                };

                // If copying from source template
                if (dto.SourceTemplateId.HasValue)
                {
                    var sourceTemplate = await _repository.GetTemplateByIdAsync(dto.SourceTemplateId.Value, organizationId);
                    if (sourceTemplate != null)
                    {
                        template.TemplateStructure = sourceTemplate.TemplateStructure;
                        // Copy policies from source template
                        if (sourceTemplate.Policies != null && sourceTemplate.Policies.Any())
                        {
                            template.Policies = sourceTemplate.Policies.Select(p => new LeaseTemplatePolicy
                            {
                                Title = p.Title,
                                Content = p.Content,
                                Category = p.Category,
                                Order = p.Order
                            }).ToList();
                        }
                        // Copy sections if needed
                    }
                }

                // Validate JSON structure
                try
                {
                    JsonDocument.Parse(template.TemplateStructure);
                }
                catch (JsonException)
                {
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Invalid template structure", "Template structure must be valid JSON.");
                }

                var created = await _repository.CreateTemplateAsync(template);

                // If setting as default, update other templates
                if (dto.IsDefaultForLandlord)
                {
                    await _repository.SetDefaultForLandlordAsync(created.Id, organizationId.Value);
                }

                return ServiceResponse<LoadLeaseTemplateDto>.CreateSuccess(_mapper.Map<LoadLeaseTemplateDto>(created));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating lease template");
                return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Error creating template", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseTemplateDto>> UpdateTemplateAsync(UpdateLeaseTemplateDto dto)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var userId = GetUserIdFromContext();

                var existing = await _repository.GetTemplateByIdAsync(dto.Id, organizationId);
                if (existing == null)
                {
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Template not found", "The specified template does not exist or you do not have access to it.");
                }

                // Don't allow updating system default templates
                if (existing.IsDefault)
                {
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Cannot update default template", "System default templates cannot be modified.");
                }

                existing.Name = dto.Name;
                existing.Description = dto.Description;
                existing.State = dto.State;
                existing.PropertyType = dto.PropertyType;
                existing.TemplateStructure = dto.TemplateStructure;
                existing.IsDefaultForLandlord = dto.IsDefaultForLandlord;
                existing.UpdatedBy = userId;

                // Update policies - clear existing and add new
                existing.Policies.Clear();
                foreach (var policyDto in dto.Policies)
                {
                    var policy = new LeaseTemplatePolicy
                    {
                        Title = policyDto.Title,
                        Content = policyDto.Content,
                        Category = policyDto.Category,
                        Order = policyDto.Order
                    };
                    existing.Policies.Add(policy);
                }

                // Validate JSON structure
                try
                {
                    JsonDocument.Parse(existing.TemplateStructure);
                }
                catch (JsonException)
                {
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Invalid template structure", "Template structure must be valid JSON.");
                }

                var updated = await _repository.UpdateTemplateAsync(existing);

                // If setting as default, update other templates
                if (dto.IsDefaultForLandlord)
                {
                    await _repository.SetDefaultForLandlordAsync(updated.Id, organizationId!.Value);
                }

                return ServiceResponse<LoadLeaseTemplateDto>.CreateSuccess(_mapper.Map<LoadLeaseTemplateDto>(updated));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating lease template {TemplateId}", dto.Id);
                return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Error updating template", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteTemplateAsync(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization not found", "Unable to determine organization context.");
                }

                var result = await _repository.DeleteTemplateAsync(id, organizationId.Value);
                if (!result)
                {
                    return ServiceResponse<bool>.CreateError("Cannot delete template", "Template not found, is a system default, or you do not have permission to delete it.");
                }

                return ServiceResponse<bool>.CreateSuccess(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting lease template {TemplateId}", id);
                return ServiceResponse<bool>.CreateError("Error deleting template", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> SetDefaultTemplateAsync(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("Organization not found", "Unable to determine organization context.");
                }

                var result = await _repository.SetDefaultForLandlordAsync(id, organizationId.Value);
                if (!result)
                {
                    return ServiceResponse<bool>.CreateError("Cannot set default", "Template not found or you do not have access to it.");
                }

                return ServiceResponse<bool>.CreateSuccess(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting default template {TemplateId}", id);
                return ServiceResponse<bool>.CreateError("Error setting default template", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseTemplateDto>> CreateDefaultTemplateForOrganizationAsync(long organizationId, long userId)
        {
            try
            {
                // Create default template structure
                var defaultTemplateStructure = JsonSerializer.Serialize(new
                {
                    sections = new[]
                    {
                        new { sectionName = "Parties", enabled = true, order = 1 },
                        new { sectionName = "Property Description", enabled = true, order = 2 },
                        new { sectionName = "Term", enabled = true, order = 3 },
                        new { sectionName = "Rent", enabled = true, order = 4 },
                        new { sectionName = "Security Deposit", enabled = true, order = 5 },
                        new { sectionName = "Utilities", enabled = true, order = 6 },
                        new { sectionName = "Maintenance", enabled = true, order = 7 },
                        new { sectionName = "Policies", enabled = true, order = 8 },
                        new { sectionName = "Defaults", enabled = true, order = 9 },
                        new { sectionName = "Termination", enabled = true, order = 10 },
                        new { sectionName = "Signatures", enabled = true, order = 11 }
                    },
                    clauseSettings = new
                    {
                        lateFee = new { enabled = true, amount = (decimal?)null, gracePeriodDays = 5 },
                        petDeposit = new { enabled = false, amount = (decimal?)null },
                        smoking = new { enabled = false }
                    }
                });

                // Get default policies from database
                List<LeaseTemplatePolicy> policies = new List<LeaseTemplatePolicy>();
                
                try
                {
                    var defaultPolicies = await _dataContext.LeaseTemplateDefaultPolicies
                        .OrderBy(p => p.Order)
                        .ToListAsync();
                    
                    if (defaultPolicies != null && defaultPolicies.Any())
                    {
                        // Convert default policies to LeaseTemplatePolicy objects
                        policies = defaultPolicies.Select(dp => new LeaseTemplatePolicy
                        {
                            Title = dp.Title,
                            Content = dp.Content,
                            Category = dp.Category,
                            Order = dp.Order
                        }).ToList();
                        
                        _logger.LogInformation("Successfully loaded {Count} default policies for organization {OrganizationId}", 
                            policies.Count, organizationId);
                    }
                    else
                    {
                        _logger.LogWarning("No default policies found in database for organization {OrganizationId}. Creating template without policies.", 
                            organizationId);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error loading default policies for organization {OrganizationId}. Creating template without policies.", 
                        organizationId);
                    // Continue without policies if loading fails
                }

                // Create organization-specific default template
                var orgTemplate = new LeaseTemplate
                {
                    Name = "Standard Residential Lease Agreement",
                    Description = "Default lease template for residential rental properties",
                    State = null,
                    PropertyType = null,
                    TemplateStructure = defaultTemplateStructure,
                    IsDefault = true,
                    IsDefaultForLandlord = true,
                    OrganizationId = organizationId,
                    CreatedBy = userId,
                    Version = "1.0",
                    CreatedAt = DateTime.Now,
                    Policies = policies
                };

                var created = await _repository.CreateTemplateAsync(orgTemplate);
                return ServiceResponse<LoadLeaseTemplateDto>.CreateSuccess(_mapper.Map<LoadLeaseTemplateDto>(created));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating default template for organization {OrganizationId}", organizationId);
                return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Error creating default template", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseTemplateDto>> EnsureDefaultTemplateExistsAsync()
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                var userId = GetUserIdFromContext();

                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Organization not found", "Unable to determine organization context.");
                }

                if (!userId.HasValue)
                {
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateError("User not found", "Unable to determine user context.");
                }

                // Check if organization already has a default template
                var existingTemplates = await _repository.GetTemplatesByOrganizationAsync(organizationId.Value);
                var defaultTemplate = existingTemplates.FirstOrDefault(t => t.IsDefaultForLandlord);

                if (defaultTemplate != null)
                {
                    // Default template already exists, return it
                    return ServiceResponse<LoadLeaseTemplateDto>.CreateSuccess(_mapper.Map<LoadLeaseTemplateDto>(defaultTemplate));
                }

                // No default template exists, create one
                _logger.LogInformation("No default template found for organization {OrganizationId}. Creating default template.", organizationId.Value);
                return await CreateDefaultTemplateForOrganizationAsync(organizationId.Value, userId.Value);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ensuring default template exists");
                return ServiceResponse<LoadLeaseTemplateDto>.CreateError("Error ensuring default template exists", ex.Message);
            }
        }

        private string GetPolicyTitle(string policy)
        {
            // Extract a title from the policy text (first few words or a keyword)
            var words = policy.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (words.Length > 0)
            {
                // Try to find a keyword or use first few words
                var lowerPolicy = policy.ToLower();
                if (lowerPolicy.Contains("rent")) return "Rent Payment";
                if (lowerPolicy.Contains("deposit") || lowerPolicy.Contains("security")) return "Security Deposit";
                if (lowerPolicy.Contains("quiet") || lowerPolicy.Contains("noise")) return "Quiet Hours";
                if (lowerPolicy.Contains("park")) return "Parking";
                if (lowerPolicy.Contains("trash") || lowerPolicy.Contains("garbage")) return "Trash Disposal";
                if (lowerPolicy.Contains("maintenance") || lowerPolicy.Contains("repair")) return "Maintenance";
                if (lowerPolicy.Contains("guest")) return "Guests";
                if (lowerPolicy.Contains("smok")) return "Smoking";
                if (lowerPolicy.Contains("pet")) return "Pets";
                if (lowerPolicy.Contains("key") || lowerPolicy.Contains("lock")) return "Keys and Security";
                if (lowerPolicy.Contains("alter") || lowerPolicy.Contains("modif")) return "Alterations";
                if (lowerPolicy.Contains("move-out") || lowerPolicy.Contains("cleaning")) return "Move-Out";
                if (lowerPolicy.Contains("utilit")) return "Utilities";
                if (lowerPolicy.Contains("sublet") || lowerPolicy.Contains("assign")) return "Subletting";
                if (lowerPolicy.Contains("entry") || lowerPolicy.Contains("inspect")) return "Entry";
                
                // Fallback: use first few words
                return string.Join(" ", words.Take(3));
            }
            return "Policy";
        }

        private string GetPolicyCategory(string policy)
        {
            // Determine category from policy content
            var lowerPolicy = policy.ToLower();
            if (lowerPolicy.Contains("rent")) return "Rent";
            if (lowerPolicy.Contains("deposit") || lowerPolicy.Contains("security")) return "Deposit";
            if (lowerPolicy.Contains("quiet") || lowerPolicy.Contains("noise")) return "QuietHours";
            if (lowerPolicy.Contains("park")) return "Parking";
            if (lowerPolicy.Contains("trash") || lowerPolicy.Contains("garbage")) return "Trash";
            if (lowerPolicy.Contains("maintenance") || lowerPolicy.Contains("repair")) return "Maintenance";
            if (lowerPolicy.Contains("guest")) return "Guests";
            if (lowerPolicy.Contains("smok")) return "Smoking";
            if (lowerPolicy.Contains("pet")) return "Pets";
            if (lowerPolicy.Contains("key") || lowerPolicy.Contains("lock")) return "Keys";
            if (lowerPolicy.Contains("alter") || lowerPolicy.Contains("modif")) return "Alterations";
            if (lowerPolicy.Contains("move-out") || lowerPolicy.Contains("cleaning")) return "Cleaning";
            if (lowerPolicy.Contains("utilit")) return "Utilities";
            if (lowerPolicy.Contains("sublet") || lowerPolicy.Contains("assign")) return "Subletting";
            if (lowerPolicy.Contains("entry") || lowerPolicy.Contains("inspect")) return "Entry";
            
            return "General";
        }
    }
}
