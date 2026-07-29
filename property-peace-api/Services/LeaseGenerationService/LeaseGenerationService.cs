using AutoMapper;
using brownstone_hub_api.Dtos.LeaseGeneration;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.LeaseInstances;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.LeaseTemplates;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.OpenAIService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace brownstone_hub_api.Services.LeaseGenerationService
{
    public class LeaseGenerationService : ILeaseGenerationService
    {
        private readonly ILeaseInstanceRepository _leaseInstanceRepository;
        private readonly ILeaseRepository _leaseRepository;
        private readonly IPropertyRepository _propertyRepository;
        private readonly ITenantRepository _tenantRepository;
        private readonly ILeaseTemplateRepository _templateRepository;
        private readonly IUserRepository _userRepository;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly IOpenAIService _openAIService;
        private readonly IStateRequiredDisclosureService _stateRequiredDisclosureService;
        private readonly ILogger<LeaseGenerationService> _logger;
        private readonly IMapper _mapper;

        public LeaseGenerationService(
            ILeaseInstanceRepository leaseInstanceRepository,
            ILeaseRepository leaseRepository,
            IPropertyRepository propertyRepository,
            ITenantRepository tenantRepository,
            ILeaseTemplateRepository templateRepository,
            IUserRepository userRepository,
            IHttpContextAccessor httpContextAccessor,
            IOpenAIService openAIService,
            IStateRequiredDisclosureService stateRequiredDisclosureService,
            ILogger<LeaseGenerationService> logger,
            IMapper mapper)
        {
            _leaseInstanceRepository = leaseInstanceRepository;
            _leaseRepository = leaseRepository;
            _propertyRepository = propertyRepository;
            _tenantRepository = tenantRepository;
            _templateRepository = templateRepository;
            _userRepository = userRepository;
            _httpContextAccessor = httpContextAccessor;
            _openAIService = openAIService;
            _stateRequiredDisclosureService = stateRequiredDisclosureService;
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

        public async Task<ServiceResponse<PlaceholderCatalogDto>> GetPlaceholderCatalogAsync()
        {
            try
            {
                var catalog = new PlaceholderCatalogDto
                {
                    Groups = new List<PlaceholderGroupDto>
                    {
                        new PlaceholderGroupDto
                        {
                            GroupName = "Tenant",
                            Description = "Tenant information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Tenant.FullNameList", Placeholder = "{{Tenant.FullNameList}}", Type = "String", Description = "Comma-separated list of tenant names", IsRequired = true, Example = "John Doe, Jane Doe" },
                                new PlaceholderItemDto { Key = "Tenant.FullNameListWithAnd", Placeholder = "{{Tenant.FullNameListWithAnd}}", Type = "String", Description = "Tenant names with 'and' separator", IsRequired = false, Example = "John Doe and Jane Doe" }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Property",
                            Description = "Property information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Property.AddressLine1", Placeholder = "{{Property.AddressLine1}}", Type = "String", Description = "Street address", IsRequired = true, Example = "123 Main St" },
                                new PlaceholderItemDto { Key = "Property.FullAddress", Placeholder = "{{Property.FullAddress}}", Type = "String", Description = "Complete address", IsRequired = true, Example = "123 Main St, City, ST 12345" },
                                new PlaceholderItemDto { Key = "Property.City", Placeholder = "{{Property.City}}", Type = "String", Description = "City", IsRequired = false },
                                new PlaceholderItemDto { Key = "Property.State", Placeholder = "{{Property.State}}", Type = "String", Description = "State", IsRequired = false },
                                new PlaceholderItemDto { Key = "Property.ZipCode", Placeholder = "{{Property.ZipCode}}", Type = "String", Description = "ZIP code", IsRequired = false }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Unit",
                            Description = "Unit information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Unit.Number", Placeholder = "{{Unit.Number}}", Type = "String", Description = "Unit number or name", IsRequired = false, Example = "Apt 101" },
                                new PlaceholderItemDto { Key = "Unit.Bedrooms", Placeholder = "{{Unit.Bedrooms}}", Type = "String", Description = "Number of bedrooms", IsRequired = false },
                                new PlaceholderItemDto { Key = "Unit.Bathrooms", Placeholder = "{{Unit.Bathrooms}}", Type = "String", Description = "Number of bathrooms", IsRequired = false },
                                new PlaceholderItemDto { Key = "Unit.SquareFeet", Placeholder = "{{Unit.SquareFeet}}", Type = "Number", Description = "Square footage", IsRequired = false }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Lease",
                            Description = "Lease terms",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Lease.StartDate", Placeholder = "{{Lease.StartDate}}", Type = "Date", Description = "Lease start date", IsRequired = true, Example = "01/01/2024" },
                                new PlaceholderItemDto { Key = "Lease.EndDate", Placeholder = "{{Lease.EndDate}}", Type = "Date", Description = "Lease end date", IsRequired = true, Example = "12/31/2024" },
                                new PlaceholderItemDto { Key = "Lease.MonthlyRent", Placeholder = "{{Lease.MonthlyRent}}", Type = "Currency", Description = "Monthly rent amount", IsRequired = true, Example = "$1,500.00" },
                                new PlaceholderItemDto { Key = "Lease.SecurityDeposit", Placeholder = "{{Lease.SecurityDeposit}}", Type = "Currency", Description = "Security deposit amount", IsRequired = false, Example = "$1,500.00" },
                                new PlaceholderItemDto { Key = "Lease.RentDueDay", Placeholder = "{{Lease.RentDueDay}}", Type = "Number", Description = "Day of month rent is due", IsRequired = false, Example = "1" }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Landlord",
                            Description = "Landlord information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Landlord.LegalName", Placeholder = "{{Landlord.LegalName}}", Type = "String", Description = "Landlord's legal name", IsRequired = true, Example = "John Smith" },
                                new PlaceholderItemDto { Key = "Landlord.MailingAddress", Placeholder = "{{Landlord.MailingAddress}}", Type = "String", Description = "Landlord's mailing address", IsRequired = false }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Lease Extended",
                            Description = "Extended lease terms",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Lease.RentFrequency", Placeholder = "{{Lease.RentFrequency}}", Type = "String", Description = "Rent payment frequency", IsRequired = false, Example = "Monthly" },
                                new PlaceholderItemDto { Key = "Lease.AutoRenew", Placeholder = "{{Lease.AutoRenew}}", Type = "String", Description = "Whether lease auto-renews", IsRequired = false, Example = "Yes" },
                                new PlaceholderItemDto { Key = "Lease.AutoRenewIncrement", Placeholder = "{{Lease.AutoRenewIncrement}}", Type = "String", Description = "Rent increment on auto-renew", IsRequired = false, Example = "3%" },
                                new PlaceholderItemDto { Key = "Lease.ProratedRent", Placeholder = "{{Lease.ProratedRent}}", Type = "String", Description = "Whether prorated rent applies", IsRequired = false, Example = "Yes" },
                                new PlaceholderItemDto { Key = "Lease.PetDeposit", Placeholder = "{{Lease.PetDeposit}}", Type = "Currency", Description = "Pet deposit amount", IsRequired = false, Example = "$300.00" },
                                new PlaceholderItemDto { Key = "Lease.RentCollectionMethods", Placeholder = "{{Lease.RentCollectionMethods}}", Type = "String", Description = "Accepted rent payment methods", IsRequired = false, Example = "Platform, Check" },
                                new PlaceholderItemDto { Key = "Lease.EarlyTerminationClause", Placeholder = "{{Lease.EarlyTerminationClause}}", Type = "String", Description = "Early termination clause text", IsRequired = false },
                                new PlaceholderItemDto { Key = "Lease.AdditionalTerms", Placeholder = "{{Lease.AdditionalTerms}}", Type = "String", Description = "Additional lease terms", IsRequired = false }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "LateFee",
                            Description = "Late fee information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "LateFee.Amount", Placeholder = "{{LateFee.Amount}}", Type = "Currency", Description = "Late fee amount", IsRequired = false, Example = "$50.00" },
                                new PlaceholderItemDto { Key = "LateFee.GracePeriodDays", Placeholder = "{{LateFee.GracePeriodDays}}", Type = "Number", Description = "Grace period in days", IsRequired = false, Example = "5" }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Fees",
                            Description = "All lease fees",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Fees.Summary", Placeholder = "{{Fees.Summary}}", Type = "String", Description = "Formatted list of all lease fees", IsRequired = false, Example = "Late Fee: $50.00\nApplication Fee: $75.00" }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Tenant Extended",
                            Description = "Extended tenant information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Tenant.MailingAddress", Placeholder = "{{Tenant.MailingAddress}}", Type = "String", Description = "Tenant mailing address if different from property", IsRequired = false },
                                new PlaceholderItemDto { Key = "Tenant.OccupantList", Placeholder = "{{Tenant.OccupantList}}", Type = "String", Description = "List of additional occupants", IsRequired = false, Example = "Jane Smith, Bob Jones" },
                                new PlaceholderItemDto { Key = "Tenant.CoSignerList", Placeholder = "{{Tenant.CoSignerList}}", Type = "String", Description = "List of co-signers", IsRequired = false, Example = "Mary Doe" }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Pets",
                            Description = "Pet policy information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Pets.Allowed", Placeholder = "{{Pets.Allowed}}", Type = "String", Description = "Whether pets are allowed", IsRequired = false, Example = "Yes" },
                                new PlaceholderItemDto { Key = "Pets.PolicySummary", Placeholder = "{{Pets.PolicySummary}}", Type = "String", Description = "Approved pets list with details", IsRequired = false, Example = "Dog, Labrador, 60 lbs, Age 3" }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Smoking",
                            Description = "Smoking policy",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Smoking.Policy", Placeholder = "{{Smoking.Policy}}", Type = "String", Description = "Full smoking policy statement", IsRequired = false, Example = "No smoking is permitted on the premises." }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Parking",
                            Description = "Parking information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Parking.Summary", Placeholder = "{{Parking.Summary}}", Type = "String", Description = "Parking rules and types", IsRequired = false }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Utilities",
                            Description = "Utilities information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Utilities.IncludedList", Placeholder = "{{Utilities.IncludedList}}", Type = "List", Description = "List of utilities included in rent", IsRequired = false, Example = "Water, Sewer, Trash" },
                                new PlaceholderItemDto { Key = "Utilities.ResponsibilityTable", Placeholder = "{{Utilities.ResponsibilityTable}}", Type = "String", Description = "Who is responsible for each utility", IsRequired = false, Example = "Electricity: Tenant\nWater: Landlord" },
                                new PlaceholderItemDto { Key = "Utilities.SharedDisclosure", Placeholder = "{{Utilities.SharedDisclosure}}", Type = "String", Description = "Shared utilities disclosure text", IsRequired = false }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Maintenance",
                            Description = "Maintenance responsibilities",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Maintenance.ResponsibilityList", Placeholder = "{{Maintenance.ResponsibilityList}}", Type = "String", Description = "Who is responsible for each maintenance item", IsRequired = false, Example = "Lawn Care: Tenant\nHVAC Filter: Tenant" },
                                new PlaceholderItemDto { Key = "Maintenance.NotificationMethods", Placeholder = "{{Maintenance.NotificationMethods}}", Type = "String", Description = "How tenant should report maintenance issues", IsRequired = false, Example = "Platform, Email" }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "Keys",
                            Description = "Key information",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "Keys.Summary", Placeholder = "{{Keys.Summary}}", Type = "String", Description = "Keys provided to tenant", IsRequired = false, Example = "Front Door Key: 2 key(s)\nMailbox Key: 1 key(s)" }
                            }
                        },
                        new PlaceholderGroupDto
                        {
                            GroupName = "LeadPaint",
                            Description = "Lead-based paint disclosure",
                            Placeholders = new List<PlaceholderItemDto>
                            {
                                new PlaceholderItemDto { Key = "LeadPaint.Disclosure", Placeholder = "{{LeadPaint.Disclosure}}", Type = "String", Description = "Full lead-based paint disclosure text (required for pre-1978 properties)", IsRequired = false }
                            }
                        }
                    }
                };

                return ServiceResponse<PlaceholderCatalogDto>.CreateSuccess(catalog);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving placeholder catalog");
                return ServiceResponse<PlaceholderCatalogDto>.CreateError("Error retrieving placeholder catalog", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseInstanceDto>> CreateLeaseInstanceAsync(CreateLeaseInstanceDto dto, long organizationId)
        {
            var userId = GetUserIdFromContext();
            if (!userId.HasValue)
            {
                _logger.LogWarning("Unable to determine user context for organization {OrgId}", organizationId);
                return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Authentication required", "Unable to determine user context.", statusCode: 403);
            }
            return await CreateLeaseInstanceInternalAsync(dto, organizationId, userId.Value);
        }

        public async Task<ServiceResponse<LoadLeaseInstanceDto>> CreateLeaseInstanceAsync(CreateLeaseInstanceDto dto, long organizationId, long userId)
        {
            return await CreateLeaseInstanceInternalAsync(dto, organizationId, userId);
        }

        private async Task<ServiceResponse<LoadLeaseInstanceDto>> CreateLeaseInstanceInternalAsync(CreateLeaseInstanceDto dto, long organizationId, long userId)
        {
            try
            {
                var lease = await _leaseRepository.GetLeaseById(dto.LeaseId, organizationId);
                if (lease == null)
                {
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Lease not found", "The specified lease does not exist or you do not have access to it.");
                }

                // Get template
                var template = await _templateRepository.GetTemplateByIdAsync(dto.LeaseTemplateId, organizationId);
                if (template == null)
                {
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Template not found", "The specified template does not exist or you do not have access to it.");
                }

                // Check for warnings
                var warnings = new List<string>();
                
                // Check template structure
                warnings.AddRange(LeaseWarningService.CheckForWarnings(template.TemplateStructure));
                
                // Check custom policies
                if (dto.CustomPolicies != null)
                {
                    foreach (var policy in dto.CustomPolicies)
                    {
                        warnings.AddRange(LeaseWarningService.CheckForWarnings(policy));
                    }
                }

                // Check lease terms
                var clauseSettings = dto.ClauseSettings;
                decimal? lateFeeAmount = null;
                int? gracePeriodDays = null;
                
                if (clauseSettings != null && clauseSettings.TryGetValue("lateFee", out var lateFeeObj))
                {
                    if (lateFeeObj is JsonElement lateFeeElement)
                    {
                        if (lateFeeElement.TryGetProperty("amount", out var amountElement))
                        {
                            lateFeeAmount = amountElement.GetDecimal();
                        }
                        if (lateFeeElement.TryGetProperty("gracePeriodDays", out var graceElement))
                        {
                            gracePeriodDays = graceElement.GetInt32();
                        }
                    }
                }

                warnings.AddRange(LeaseWarningService.CheckLeaseTerms(
                    dto.MonthlyRent,
                    dto.SecurityDeposit,
                    lateFeeAmount,
                    gracePeriodDays
                ));

                // Create instance
                var instance = new LeaseInstance
                {
                    LeaseId = dto.LeaseId,
                    LeaseTemplateId = dto.LeaseTemplateId,
                    TemplateVersion = template.Version,
                    IsDraft = true,
                    IsFinalized = false,
                    GeneratedBy = userId,
                    Warnings = warnings.Any() ? JsonSerializer.Serialize(warnings) : null
                };

                // Resolve placeholders
                await ResolvePlaceholdersForInstance(instance, lease, dto, organizationId);

                // Ensure tenants are linked to the lease
                if (dto.TenantIds != null && dto.TenantIds.Any())
                {
                    try
                    {
                        // Get existing tenants for this lease
                        var existingTenants = await _tenantRepository.GetTenantsByLeaseId(lease.Id);
                        var existingTenantIds = existingTenants.Select(t => t.Id).ToHashSet();

                        // Link tenants that aren't already linked
                        foreach (var tenantId in dto.TenantIds)
                        {
                            if (!existingTenantIds.Contains(tenantId))
                            {
                                var tenant = await _tenantRepository.GetTenantById(tenantId);
                                // The lease is organization-scoped; require the tenant to belong to
                                // that lease's property rather than inventing an OrganizationId DTO field.
                                if (tenant != null && lease.PropertyId > 0 && tenant.PropertyId == lease.PropertyId)
                                {
                                    var tenantOrganizationId = organizationId;

                                    // Update tenant to link to this lease
                                    var updateDto = new AddTenantDto
                                    {
                                        Id = tenant.Id,
                                        LeaseId = lease.Id, // Explicitly set LeaseId to link tenant to lease
                                        UnitId = lease.UnitId, // Ensure UnitId matches the lease's unit
                                        Firstname = tenant.Firstname,
                                        Lastname = tenant.Lastname,
                                        Email = tenant.Email,
                                        PhoneNumber = tenant.PhoneNumber,
                                        UserId = tenant.UserId, // Preserve existing UserId
                                        OrganizationId = tenantOrganizationId // Use organizationId from context
                                    };
                                    await _tenantRepository.UpdateTenant(tenantId, updateDto);
                                    _logger.LogInformation("Linked tenant {TenantId} to lease {LeaseId} during instance creation", tenantId, lease.Id);
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error linking tenants to lease {LeaseId} during instance creation. This may cause issues during finalization.", lease.Id);
                        // Don't fail instance creation if tenant linking fails - we'll try again at finalization
                    }
                }

                // Create policy section if provided
                if (dto.CustomPolicies != null && dto.CustomPolicies.Any())
                {
                    instance.PolicySection = new LeasePolicySection
                    {
                        OriginalPolicies = JsonSerializer.Serialize(dto.CustomPolicies),
                        Tone = "Neutral"
                    };
                }

                var created = await _leaseInstanceRepository.CreateLeaseInstanceAsync(instance, organizationId);
                return ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(_mapper.Map<LoadLeaseInstanceDto>(created));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating lease instance");
                return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Error creating lease instance", ex.Message);
            }
        }

        private async Task ResolvePlaceholdersForInstance(LeaseInstance instance, LoadLeaseDto lease, CreateLeaseInstanceDto dto, long organizationId)
        {
            var variables = new List<LeaseVariable>();

            // Get property and unit. The repository has no scoped by-id API, so verify its organization here.
            var property = await _propertyRepository.GetPropertyById(lease.PropertyId);
            if (property?.OrganizationId != organizationId)
                property = null;
            var unit = property?.Units?.FirstOrDefault(u => u.Id == lease.UnitId);

            // Get tenants
            var tenants = new List<LoadTenantDto>();
            if (dto.TenantIds.Any())
            {
                foreach (var tenantId in dto.TenantIds)
                {
                    var tenant = await _tenantRepository.GetTenantById(tenantId);
                    // property was explicitly verified against organizationId above.
                    if (tenant != null && property != null && tenant.PropertyId == property.Id)
                    {
                        tenants.Add(tenant);
                    }
                }
            }

            // Resolve tenant placeholders
            if (tenants.Any())
            {
                var tenantNames = tenants.Select(t => $"{t.Firstname} {t.Lastname}").ToList();
                variables.Add(new LeaseVariable { VariableKey = "Tenant.FullNameList", VariableValue = string.Join(", ", tenantNames), VariableType = "String" });
                variables.Add(new LeaseVariable { VariableKey = "Tenant.FullNameListWithAnd", VariableValue = string.Join(" and ", tenantNames), VariableType = "String" });
            }

            // Resolve property placeholders
            if (property != null)
            {
                variables.Add(new LeaseVariable { VariableKey = "Property.AddressLine1", VariableValue = property.StreetAddress, VariableType = "String" });
                variables.Add(new LeaseVariable { VariableKey = "Property.City", VariableValue = property.City, VariableType = "String" });
                variables.Add(new LeaseVariable { VariableKey = "Property.State", VariableValue = property.State, VariableType = "String" });
                variables.Add(new LeaseVariable { VariableKey = "Property.ZipCode", VariableValue = property.ZipCode, VariableType = "String" });
                variables.Add(new LeaseVariable { VariableKey = "Property.FullAddress", VariableValue = $"{property.StreetAddress}, {property.City}, {property.State} {property.ZipCode}".Trim(), VariableType = "String" });
            }

            // Resolve unit placeholders
            if (unit != null)
            {
                variables.Add(new LeaseVariable { VariableKey = "Unit.Number", VariableValue = unit.Name, VariableType = "String" });
                variables.Add(new LeaseVariable { VariableKey = "Unit.Bedrooms", VariableValue = unit.Bedrooms, VariableType = "String" });
                variables.Add(new LeaseVariable { VariableKey = "Unit.Bathrooms", VariableValue = unit.Baths, VariableType = "String" });
                variables.Add(new LeaseVariable { VariableKey = "Unit.SquareFeet", VariableValue = unit.SquareFeet.ToString(), VariableType = "Number" });
            }

            // Resolve lease placeholders
            var startDate = dto.StartDate ?? lease.StartDate;
            var endDate = dto.EndDate ?? lease.EndDate;
            var monthlyRent = dto.MonthlyRent ?? lease.RentAmount;
            var securityDeposit = dto.SecurityDeposit ?? lease.DepositAmount;
            var rentDueDay = dto.RentDueDay ?? lease.RentDueDay;

            if (startDate.HasValue)
                variables.Add(new LeaseVariable { VariableKey = "Lease.StartDate", VariableValue = startDate.Value.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture), VariableType = "Date" });
            if (endDate.HasValue)
                variables.Add(new LeaseVariable { VariableKey = "Lease.EndDate", VariableValue = endDate.Value.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture), VariableType = "Date" });
            if (monthlyRent.HasValue)
                variables.Add(new LeaseVariable { VariableKey = "Lease.MonthlyRent", VariableValue = monthlyRent.Value.ToString("C", CultureInfo.InvariantCulture), VariableType = "Currency" });
            if (securityDeposit.HasValue)
                variables.Add(new LeaseVariable { VariableKey = "Lease.SecurityDeposit", VariableValue = securityDeposit.Value.ToString("C", CultureInfo.InvariantCulture), VariableType = "Currency" });
            if (rentDueDay.HasValue)
                variables.Add(new LeaseVariable { VariableKey = "Lease.RentDueDay", VariableValue = rentDueDay.Value.ToString(CultureInfo.InvariantCulture), VariableType = "Number" });

            // Resolve landlord placeholders
            if (property != null && property.LandlordId > 0)
            {
                var landlord = await _userRepository.GetUser(property.LandlordId);
                if (landlord != null)
                {
                    var landlordName = $"{landlord.FirstName} {landlord.LastName}".Trim();
                    variables.Add(new LeaseVariable { VariableKey = "Landlord.LegalName", VariableValue = landlordName, VariableType = "String" });
                }
            }

            // Resolve landlord mailing address from LeaseLandlords if available
            if (lease.LeaseLandlords?.Any() == true)
            {
                var primaryLandlord = lease.LeaseLandlords.FirstOrDefault();
                if (primaryLandlord != null && !string.IsNullOrWhiteSpace(primaryLandlord.StreetAddress))
                {
                    var parts = new[] { primaryLandlord.StreetAddress, primaryLandlord.City, primaryLandlord.State, primaryLandlord.ZipCode };
                    variables.Add(new LeaseVariable { VariableKey = "Landlord.MailingAddress", VariableValue = string.Join(", ", parts.Where(p => !string.IsNullOrWhiteSpace(p))), VariableType = "String" });
                }
            }

            // Resolve utilities included in unit
            if (unit?.IncludedUtility != null && unit.IncludedUtility.Any())
            {
                var utilityNames = unit.IncludedUtility.Select(u => u.Label ?? u.Value).ToList();
                variables.Add(new LeaseVariable { VariableKey = "Utilities.IncludedList", VariableValue = string.Join(", ", utilityNames), VariableType = "List" });
            }

            // ── Extended lease terms ──────────────────────────────────────────────────
            if (!string.IsNullOrWhiteSpace(lease.RentFrequency))
                variables.Add(new LeaseVariable { VariableKey = "Lease.RentFrequency", VariableValue = lease.RentFrequency, VariableType = "String" });
            variables.Add(new LeaseVariable { VariableKey = "Lease.AutoRenew", VariableValue = lease.AutoRenewLease ? "Yes" : "No", VariableType = "String" });
            if (lease.AutoRenewLease && lease.AutoRenewRentIncrement == true && lease.AutoRenewRentIncrementValue.HasValue)
            {
                var incType = lease.AutoRenewRentIncrementType ?? "percentage";
                var incVal = lease.AutoRenewRentIncrementValue.Value;
                var incStr = incType == "percentage" ? $"{incVal}%" : incVal.ToString("C");
                variables.Add(new LeaseVariable { VariableKey = "Lease.AutoRenewIncrement", VariableValue = incStr, VariableType = "String" });
            }
            variables.Add(new LeaseVariable { VariableKey = "Lease.ProratedRent", VariableValue = lease.IsProratedRent == true ? "Yes" : "No", VariableType = "String" });
            if ((lease.IsProratedRent == true || lease.ProratedRentDue == true) && lease.ProratedRentAmount.HasValue)
            {
                variables.Add(new LeaseVariable { VariableKey = "Lease.ProratedRentAmount", VariableValue = lease.ProratedRentAmount.Value.ToString("C"), VariableType = "Currency" });
                if (!string.IsNullOrWhiteSpace(lease.ProrationMethod))
                    variables.Add(new LeaseVariable { VariableKey = "Lease.ProrationMethod", VariableValue = lease.ProrationMethod, VariableType = "String" });
            }
            if (lease.PetDepositAmount.HasValue && lease.PetDepositAmount > 0)
                variables.Add(new LeaseVariable { VariableKey = "Lease.PetDeposit", VariableValue = lease.PetDepositAmount.Value.ToString("C"), VariableType = "Currency" });
            if (!string.IsNullOrWhiteSpace(lease.RentCollectionOtherOptions))
            {
                try
                {
                    var methods = JsonSerializer.Deserialize<List<string>>(lease.RentCollectionOtherOptions);
                    if (methods?.Any() == true)
                        variables.Add(new LeaseVariable { VariableKey = "Lease.RentCollectionMethods", VariableValue = string.Join(", ", methods), VariableType = "String" });
                }
                catch { /* ignore malformed JSON */ }
            }
            if (lease.IncludeEarlyTerminationClause == true && !string.IsNullOrWhiteSpace(lease.EarlyTerminationClauseText))
                variables.Add(new LeaseVariable { VariableKey = "Lease.EarlyTerminationClause", VariableValue = lease.EarlyTerminationClauseText, VariableType = "String" });
            if (!string.IsNullOrWhiteSpace(lease.AdditionalTerms))
                variables.Add(new LeaseVariable { VariableKey = "Lease.AdditionalTerms", VariableValue = lease.AdditionalTerms, VariableType = "String" });

            // ── Fees ─────────────────────────────────────────────────────────────────
            if (lease.Fees?.Any() == true)
            {
                var feeLines = lease.Fees.Select(f => $"{f.Name}: {f.Amount:C}").ToList();
                variables.Add(new LeaseVariable { VariableKey = "Fees.Summary", VariableValue = string.Join("\n", feeLines), VariableType = "String" });
                var lateFeeEntry = lease.Fees.FirstOrDefault(f => f.Name?.Contains("late", StringComparison.OrdinalIgnoreCase) == true);
                if (lateFeeEntry != null)
                    variables.Add(new LeaseVariable { VariableKey = "LateFee.Amount", VariableValue = lateFeeEntry.Amount.ToString("C"), VariableType = "Currency" });
            }
            // Fall back to clauseSettings for late fee if not found in fees list
            if (variables.All(v => v.VariableKey != "LateFee.Amount") && dto.ClauseSettings != null
                && dto.ClauseSettings.TryGetValue("lateFee", out var lateFeeObj) && lateFeeObj is JsonElement lateFeeEl)
            {
                if (lateFeeEl.TryGetProperty("amount", out var amtEl))
                    variables.Add(new LeaseVariable { VariableKey = "LateFee.Amount", VariableValue = amtEl.GetDecimal().ToString("C"), VariableType = "Currency" });
                if (lateFeeEl.TryGetProperty("gracePeriodDays", out var graceEl))
                    variables.Add(new LeaseVariable { VariableKey = "LateFee.GracePeriodDays", VariableValue = graceEl.GetInt32().ToString(), VariableType = "Number" });
            }

            // ── People – occupants & co-signers ──────────────────────────────────────
            if (lease.LeaseOccupants?.Any() == true)
            {
                var occupantNames = lease.LeaseOccupants.Select(o => $"{o.FirstName} {o.LastName}".Trim()).Where(n => !string.IsNullOrWhiteSpace(n)).ToList();
                if (occupantNames.Any())
                    variables.Add(new LeaseVariable { VariableKey = "Tenant.OccupantList", VariableValue = string.Join(", ", occupantNames), VariableType = "String" });
            }
            if (lease.LeaseCoSigners?.Any() == true)
            {
                var coSignerNames = lease.LeaseCoSigners.Select(c => $"{c.FirstName} {c.LastName}".Trim()).Where(n => !string.IsNullOrWhiteSpace(n)).ToList();
                if (coSignerNames.Any())
                    variables.Add(new LeaseVariable { VariableKey = "Tenant.CoSignerList", VariableValue = string.Join(", ", coSignerNames), VariableType = "String" });
            }
            if (lease.TenantMailingAddressDiffers && !string.IsNullOrWhiteSpace(lease.TenantMailingStreetAddress))
            {
                var mailingParts = new[] { lease.TenantMailingStreetAddress, lease.TenantMailingCity, lease.TenantMailingState, lease.TenantMailingZipCode };
                variables.Add(new LeaseVariable { VariableKey = "Tenant.MailingAddress", VariableValue = string.Join(", ", mailingParts.Where(p => !string.IsNullOrWhiteSpace(p))), VariableType = "String" });
            }

            // ── Pets ─────────────────────────────────────────────────────────────────
            var petsAllowed = lease.PetsAllowed;
            if (petsAllowed.HasValue)
                variables.Add(new LeaseVariable { VariableKey = "Pets.Allowed", VariableValue = petsAllowed.Value ? "Yes" : "No", VariableType = "String" });
            if (petsAllowed == true && lease.Pets?.Any() == true)
            {
                var petLines = lease.Pets.Select(p =>
                {
                    var parts = new List<string>();
                    if (!string.IsNullOrWhiteSpace(p.Type)) parts.Add(p.Type);
                    if (!string.IsNullOrWhiteSpace(p.Breed)) parts.Add($"Breed: {p.Breed}");
                    if (p.Weight.HasValue) parts.Add($"{p.Weight} lbs");
                    if (p.Age.HasValue) parts.Add($"Age {p.Age}");
                    return string.Join(", ", parts);
                }).ToList();
                variables.Add(new LeaseVariable { VariableKey = "Pets.PolicySummary", VariableValue = string.Join("\n", petLines), VariableType = "String" });
            }

            // ── Smoking ──────────────────────────────────────────────────────────────
            var smokingText = lease.SmokingAllowed?.Trim().ToLowerInvariant() switch
            {
                "yes" => "Smoking is permitted on the premises.",
                "outsideonly" => "Smoking is permitted outside the premises only. Smoking inside the unit or building is strictly prohibited.",
                "no" => "No smoking is permitted on the premises, including balconies and common areas.",
                _ => null
            };
            if (smokingText != null)
                variables.Add(new LeaseVariable { VariableKey = "Smoking.Policy", VariableValue = smokingText, VariableType = "String" });

            // ── Parking ──────────────────────────────────────────────────────────────
            if (lease.Parking != null && lease.Parking.IncludeParkingRules)
            {
                var parkingParts = new List<string>();
                if (!string.IsNullOrWhiteSpace(lease.Parking.ParkingTypes))
                {
                    try
                    {
                        var types = JsonSerializer.Deserialize<List<string>>(lease.Parking.ParkingTypes);
                        if (types?.Any() == true) parkingParts.Add("Parking types: " + string.Join(", ", types));
                    }
                    catch { /* ignore */ }
                }
                if (!string.IsNullOrWhiteSpace(lease.Parking.CustomRules)) parkingParts.Add(lease.Parking.CustomRules);
                if (parkingParts.Any())
                    variables.Add(new LeaseVariable { VariableKey = "Parking.Summary", VariableValue = string.Join("\n\n", parkingParts), VariableType = "String" });
            }

            // ── Utilities responsibility ──────────────────────────────────────────────
            if (lease.UtilityServiceResponsibilities?.Any() == true)
            {
                var utilLines = lease.UtilityServiceResponsibilities.Select(u => $"{u.Name}: {u.Responsibility}").ToList();
                variables.Add(new LeaseVariable { VariableKey = "Utilities.ResponsibilityTable", VariableValue = string.Join("\n", utilLines), VariableType = "String" });
            }
            if (lease.HasSharedUtilities == true && !string.IsNullOrWhiteSpace(lease.SharedUtilitiesDisclosure))
                variables.Add(new LeaseVariable { VariableKey = "Utilities.SharedDisclosure", VariableValue = lease.SharedUtilitiesDisclosure, VariableType = "String" });

            // ── Maintenance ──────────────────────────────────────────────────────────
            if (lease.MaintenanceResponsibilities?.Any() == true)
            {
                var maintLines = lease.MaintenanceResponsibilities.Select(m => $"{m.Name}: {m.Responsibility}").ToList();
                variables.Add(new LeaseVariable { VariableKey = "Maintenance.ResponsibilityList", VariableValue = string.Join("\n", maintLines), VariableType = "String" });
            }
            if (!string.IsNullOrWhiteSpace(lease.MaintenanceNotificationMethods))
            {
                try
                {
                    var methods = JsonSerializer.Deserialize<List<string>>(lease.MaintenanceNotificationMethods);
                    if (methods?.Any() == true)
                        variables.Add(new LeaseVariable { VariableKey = "Maintenance.NotificationMethods", VariableValue = string.Join(", ", methods), VariableType = "String" });
                }
                catch { /* ignore */ }
            }

            // ── Keys ─────────────────────────────────────────────────────────────────
            if (lease.LeaseKeys?.Any() == true)
            {
                var keyLines = lease.LeaseKeys.Select(k => $"{k.KeyType}: {k.Copies} key(s)").ToList();
                variables.Add(new LeaseVariable { VariableKey = "Keys.Summary", VariableValue = string.Join("\n", keyLines), VariableType = "String" });
            }

            // ── Lead-based paint disclosure ───────────────────────────────────────────
            if (lease.BuiltBefore1978 == true)
            {
                var leadContent = new System.Text.StringBuilder("This property was built prior to January 1, 1978. Federal law requires Landlord to provide the pamphlet \"Protect Your Family From Lead In Your Home\" to Tenant(s).");
                if (lease.AwareOfLeadPaint == true && !string.IsNullOrWhiteSpace(lease.LeadPaintExplanation))
                    leadContent.Append($"\n\nLandlord is aware of lead-based paint and/or lead-based paint hazards. Explanation: {lease.LeadPaintExplanation}");
                if (lease.HasLeadPaintRecords == true && !string.IsNullOrWhiteSpace(lease.LeadPaintRecordsExplanation))
                    leadContent.Append($"\n\nRecords/reports regarding lead-based paint: {lease.LeadPaintRecordsExplanation}");
                variables.Add(new LeaseVariable { VariableKey = "LeadPaint.Disclosure", VariableValue = leadContent.ToString(), VariableType = "String" });
            }

            instance.Variables = variables;
        }

        public async Task<ServiceResponse<LoadLeaseInstanceDto>> ResolvePlaceholdersAsync(long instanceId, long organizationId)
        {
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(instanceId, organizationId);
                
                if (instance == null)
                {
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Instance not found", "The specified lease instance does not exist.");
                }

                if (instance.IsFinalized)
                {
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Cannot modify finalized instance", "This lease instance has been finalized and cannot be modified.");
                }

                var lease = await _leaseRepository.GetLeaseById(instance.LeaseId, organizationId);
                if (lease == null)
                {
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Lease not found", "The associated lease does not exist.");
                }

                // Re-resolve placeholders (this would need the original dto, so for now we'll just update existing)
                // In a real implementation, you'd want to store the original CreateLeaseInstanceDto or re-fetch tenants
                
                var updated = await _leaseInstanceRepository.UpdateLeaseInstanceAsync(instance, organizationId);
                return ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(_mapper.Map<LoadLeaseInstanceDto>(updated));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resolving placeholders for instance {InstanceId}", instanceId);
                return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Error resolving placeholders", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<string>>> ValidatePlaceholdersAsync(long instanceId, long organizationId)
        {
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(instanceId, organizationId);
                
                if (instance == null)
                {
                    return ServiceResponse<List<string>>.CreateError("Instance not found", "The specified lease instance does not exist.");
                }

                var missingPlaceholders = new List<string>();
                var template = await _templateRepository.GetTemplateByIdAsync(instance.LeaseTemplateId, organizationId);
                
                if (template != null)
                {
                    // Extract placeholders from template structure
                    var placeholders = ExtractPlaceholders(template.TemplateStructure);
                    var resolvedKeys = instance.Variables.Select(v => v.VariableKey).ToHashSet();
                    
                    foreach (var placeholder in placeholders)
                    {
                        if (!resolvedKeys.Contains(placeholder))
                        {
                            missingPlaceholders.Add(placeholder);
                        }
                    }
                }

                return ServiceResponse<List<string>>.CreateSuccess(missingPlaceholders);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating placeholders for instance {InstanceId}", instanceId);
                return ServiceResponse<List<string>>.CreateError("Error validating placeholders", ex.Message);
            }
        }

        private List<string> ExtractPlaceholders(string templateStructure)
        {
            var placeholders = new List<string>();
            var regex = new Regex(@"\{\{([^}]+)\}\}");
            var matches = regex.Matches(templateStructure);
            
            foreach (Match match in matches)
            {
                if (match.Groups.Count > 1)
                {
                    placeholders.Add(match.Groups[1].Value.Trim());
                }
            }
            
            return placeholders.Distinct().ToList();
        }

        private async Task<string?> ValidateFinalizationTermsAsync(LeaseInstance instance, long organizationId)
        {
            var values = instance.Variables?
                .GroupBy(v => v.VariableKey)
                .ToDictionary(g => g.Key, g => g.Last().VariableValue, StringComparer.Ordinal)
                ?? new Dictionary<string, string>(StringComparer.Ordinal);

            if (!values.TryGetValue("Lease.StartDate", out var startText) ||
                !DateTime.TryParseExact(startText, "MM/dd/yyyy", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var startDate) || startDate == DateTime.MinValue)
                return "A real lease start date is required.";
            if (!values.TryGetValue("Lease.EndDate", out var endText) ||
                !DateTime.TryParseExact(endText, "MM/dd/yyyy", CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var endDate) || endDate == DateTime.MinValue)
                return "A real lease end date is required.";
            if (endDate <= startDate)
                return "The lease end date must be after the start date.";

            if (!TryParseCurrency(values, "Lease.MonthlyRent", out var monthlyRent) || monthlyRent <= 0)
                return "Monthly rent is required and must be greater than zero.";
            if (!TryParseCurrency(values, "Lease.SecurityDeposit", out var securityDeposit) || securityDeposit < 0)
                return "Security deposit is required and cannot be negative (zero is valid).";
            if (!values.TryGetValue("Lease.RentDueDay", out var dueDayText) ||
                !int.TryParse(dueDayText, NumberStyles.None, CultureInfo.InvariantCulture, out var dueDay) ||
                dueDay is < 1 or > 31)
                return "Rent due day is required and must be an integer from 1 through 31.";

            var template = await _templateRepository.GetTemplateByIdAsync(instance.LeaseTemplateId, organizationId);
            if (template == null)
                return "The lease template could not be loaded for finalization validation.";
            var enabledTemplateText = template.Sections.Count > 0
                ? string.Join("\n", template.Sections.Where(s => s.IsEnabled).Select(s => s.Content ?? string.Empty))
                : template.TemplateStructure;
            if (enabledTemplateText.Contains("{{Pets.", StringComparison.Ordinal) &&
                !values.ContainsKey("Pets.Allowed"))
                return "An explicit pet policy is required by the enabled lease template sections.";
            if (enabledTemplateText.Contains("{{Smoking.", StringComparison.Ordinal) &&
                !values.ContainsKey("Smoking.Policy"))
                return "An explicit smoking policy is required by the enabled lease template sections.";

            return null;
        }

        private static bool TryParseCurrency(
            IReadOnlyDictionary<string, string> values, string key, out decimal amount)
        {
            amount = default;
            return values.TryGetValue(key, out var text) &&
                decimal.TryParse(text, NumberStyles.Currency, CultureInfo.InvariantCulture, out amount);
        }

        public async Task<ServiceResponse<LoadLeaseInstanceDto>> PrepareLeaseInstanceForFinalizationAsync(long instanceId, long organizationId)
        {
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(instanceId, organizationId);
                if (instance == null)
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Instance not found", "The specified lease instance does not exist.", statusCode: 404);

                // Finalization itself is idempotent so retrying artifact publication is safe.
                if (instance.IsFinalized)
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(_mapper.Map<LoadLeaseInstanceDto>(instance));

                var termValidationError = await ValidateFinalizationTermsAsync(instance, organizationId);
                if (termValidationError != null)
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError(
                        "Invalid lease terms", termValidationError, statusCode: 422);

                var disclosureKeys = instance.Variables?.Select(v => v.VariableKey).ToHashSet() ?? [];
                if (!disclosureKeys.Contains("State.RequiredDisclosures") ||
                    !disclosureKeys.Contains("State.RequiredDisclosureCitations") ||
                    !disclosureKeys.Contains("State.RequiredDisclosureSnapshotUtc") ||
                    disclosureKeys.Contains("State.Note"))
                {
                    var lease = await _leaseRepository.GetLeaseById(instance.LeaseId, organizationId);
                    var property = lease?.PropertyId > 0 ? await _propertyRepository.GetPropertyById(lease.PropertyId) : null;
                    var state = property?.OrganizationId == organizationId ? property.State : string.Empty;
                    var disclosureResponse = await InjectStateRequiredPoliciesAsync(instanceId, state, organizationId);
                    if (!disclosureResponse.Success)
                        return ServiceResponse<LoadLeaseInstanceDto>.CreateError(
                            disclosureResponse.Message,
                            disclosureResponse.Errors?.Details ?? "A trustworthy state-law determination could not be made.",
                            statusCode: disclosureResponse.StatusCode);

                    instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(instanceId, organizationId);
                    if (instance == null)
                        return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Instance not found", "The lease instance disappeared while attaching state disclosures.");
                }

                var validation = await ValidatePlaceholdersAsync(instanceId, organizationId);
                if (!validation.Success)
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError(
                        validation.Message ?? "Placeholder validation failed",
                        validation.Errors?.Details ?? "Placeholders could not be safely validated.",
                        statusCode: validation.StatusCode);
                if (validation.Data != null && validation.Data.Any())
                {
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Missing required placeholders",
                        $"The following placeholders are missing: {string.Join(", ", validation.Data)}");
                }

                // Preparation intentionally leaves the instance mutable. Artifact publication must
                // complete before the final database state transition.
                return ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(_mapper.Map<LoadLeaseInstanceDto>(instance));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error preparing lease instance {InstanceId} for finalization", instanceId);
                return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Error preparing lease instance for finalization", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseInstanceDto>> FinalizeLeaseInstanceAsync(long instanceId, long organizationId)
        {
            var prepared = await PrepareLeaseInstanceForFinalizationAsync(instanceId, organizationId);
            if (!prepared.Success)
                return prepared;

            try
            {
                var finalized = await _leaseInstanceRepository.MarkFinalizedAsync(instanceId, organizationId);
                return ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(_mapper.Map<LoadLeaseInstanceDto>(finalized));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error marking lease instance {InstanceId} finalized", instanceId);
                return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Error finalizing lease instance", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseInstanceDto>> GetLeaseInstanceByIdAsync(long id, long organizationId)
        {
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(id, organizationId);
                
                if (instance == null)
                {
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Instance not found", "The specified lease instance does not exist or you do not have access to it.", statusCode: 404);
                }

                return ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(_mapper.Map<LoadLeaseInstanceDto>(instance));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease instance {InstanceId}", id);
                return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Error retrieving lease instance", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadLeaseInstanceDto>>> GetLeaseInstancesByLeaseIdAsync(long leaseId, long organizationId)
        {
            try
            {
                // Verify lease belongs to organization
                var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId);
                if (lease == null)
                {
                    return ServiceResponse<List<LoadLeaseInstanceDto>>.CreateError("Lease not found", "The specified lease does not exist.", statusCode: 404);
                }

                var instances = await _leaseInstanceRepository.GetLeaseInstancesByLeaseIdAsync(leaseId, organizationId);
                var dtos = instances.Select(i => _mapper.Map<LoadLeaseInstanceDto>(i)).ToList();

                return ServiceResponse<List<LoadLeaseInstanceDto>>.CreateSuccess(dtos);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease instances for lease {LeaseId}", leaseId);
                return ServiceResponse<List<LoadLeaseInstanceDto>>.CreateError("Error retrieving lease instances", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadLeaseInstanceDto>> FinishLeaseAgreementAsync(long leaseId, long organizationId)
        {
            try
            {
                var lease = await _leaseRepository.GetLeaseById(leaseId, organizationId);
                if (lease == null)
                {
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Lease not found", "The specified lease does not exist or you do not have access to it.", statusCode: 404);
                }

                // A finalized instance is the canonical output for a lease. Returning it lets callers
                // retry artifact publication without creating another immutable instance.
                var existingFinalized = await _leaseInstanceRepository.GetFinalizedLeaseInstanceByLeaseIdAsync(leaseId, organizationId);
                if (existingFinalized != null)
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(_mapper.Map<LoadLeaseInstanceDto>(existingFinalized));

                // A failed artifact run leaves this draft as the retry token. Never create a new
                // instance until this latest draft has either finalized or been explicitly removed.
                var existingDraft = await _leaseInstanceRepository.GetLatestDraftLeaseInstanceByLeaseIdAsync(leaseId, organizationId);
                if (existingDraft != null)
                    return await PrepareLeaseInstanceForFinalizationAsync(existingDraft.Id, organizationId);

                // Get template: prefer default for org, else first template for organization
                var templates = await _templateRepository.GetTemplatesByOrganizationAsync(organizationId);
                var template = templates.FirstOrDefault(t => t.IsDefaultForLandlord) ?? templates.FirstOrDefault();
                if (template == null)
                {
                    template = await _templateRepository.GetDefaultTemplateAsync();
                }
                if (template == null)
                {
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("No template", "No lease template found for your organization. Please contact support.");
                }

                // lease was loaded with organizationId, so tenants reached through that parent are scoped.
                var tenantIds = lease.Tenants?.Select(t => t.Id).ToList() ?? new List<long>();
                if (!tenantIds.Any())
                {
                    var tenantsFromDb = await _tenantRepository.GetTenantsByLeaseId(lease.Id);
                    // This lease id was already verified in the current organization.
                    tenantIds = tenantsFromDb.Select(t => t.Id).ToList();
                }

                var dto = new CreateLeaseInstanceDto
                {
                    LeaseId = lease.Id,
                    LeaseTemplateId = template.Id,
                    PropertyId = lease.PropertyId,
                    UnitId = lease.UnitId,
                    TenantIds = tenantIds,
                    StartDate = lease.StartDate,
                    EndDate = lease.EndDate,
                    MonthlyRent = lease.RentAmount,
                    SecurityDeposit = lease.DepositAmount,
                    RentDueDay = lease.RentDueDay
                };

                var userId = GetUserIdFromContext();
                if (!userId.HasValue)
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Authentication required", "Unable to determine user context.", statusCode: 403);

                var createResponse = await CreateLeaseInstanceInternalAsync(dto, organizationId, userId.Value);
                if (!createResponse.Success || createResponse.Data == null)
                {
                    var errDetails = createResponse.Errors?.Details ?? createResponse.Errors?.Message ?? "Unknown error";
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError(createResponse.Message ?? "Failed to create instance", errDetails);
                }

                var instanceId = createResponse.Data.Id;

                // A lease cannot become immutable until its state disclosures are grounded and validated.
                var propertyForState = lease.PropertyId > 0 ? await _propertyRepository.GetPropertyById(lease.PropertyId) : null;
                var propertyState = propertyForState?.OrganizationId == organizationId ? propertyForState.State ?? string.Empty : string.Empty;
                var disclosureResponse = await InjectStateRequiredPoliciesAsync(instanceId, propertyState, organizationId);
                if (!disclosureResponse.Success)
                {
                    var details = disclosureResponse.Errors?.Details ?? disclosureResponse.Errors?.Message ?? "A trustworthy state-law determination could not be made.";
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError(disclosureResponse.Message, details, statusCode: disclosureResponse.StatusCode);
                }

                var preparedResponse = await PrepareLeaseInstanceForFinalizationAsync(instanceId, organizationId);
                if (!preparedResponse.Success || preparedResponse.Data == null)
                {
                    var errDetails = preparedResponse.Errors?.Details ?? preparedResponse.Errors?.Message ?? "Unknown error";
                    return ServiceResponse<LoadLeaseInstanceDto>.CreateError(preparedResponse.Message ?? "Failed to prepare finalization", errDetails);
                }

                return ServiceResponse<LoadLeaseInstanceDto>.CreateSuccess(preparedResponse.Data);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error finishing lease agreement for lease {LeaseId}", leaseId);
                return ServiceResponse<LoadLeaseInstanceDto>.CreateError("Error finishing lease agreement", ex.Message);
            }
        }

        public async Task<ServiceResponse<LeaseReviewResultDto>> ReviewLeaseInstanceAsync(long instanceId, long organizationId)
        {
            try
            {
                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(instanceId, organizationId);
                if (instance == null)
                    return ServiceResponse<LeaseReviewResultDto>.CreateError("Not found", "Lease instance not found.", statusCode: 404);

                var variables = instance.Variables?.ToDictionary(v => v.VariableKey, v => v.VariableValue)
                                ?? new Dictionary<string, string>();

                var state = instance.Lease?.Unit?.Property?.State ?? string.Empty;
                var tenants = variables.GetValueOrDefault("Tenant.FullNameList", "(unknown)");
                var landlord = variables.GetValueOrDefault("Landlord.LegalName", "(unknown)");
                var address = variables.GetValueOrDefault("Property.FullAddress", "(unknown)");
                var startDate = variables.GetValueOrDefault("Lease.StartDate", "(not set)");
                var endDate = variables.GetValueOrDefault("Lease.EndDate", "(not set)");
                var rent = variables.GetValueOrDefault("Lease.MonthlyRent", "(not set)");
                var deposit = variables.GetValueOrDefault("Lease.SecurityDeposit", "(not set)");
                var petsAllowed = variables.GetValueOrDefault("Pets.Allowed", "No");
                var smokingPolicy = variables.GetValueOrDefault("Smoking.Policy", "(not set)");
                var utilities = variables.GetValueOrDefault("Utilities.ResponsibilityTable", "(not set)");
                var lateFee = variables.GetValueOrDefault("LateFee.Amount", "(not set)");
                var lateFeeGrace = variables.GetValueOrDefault("LateFee.GracePeriodDays", "(not set)");
                var earlyTermination = variables.GetValueOrDefault("Lease.EarlyTerminationClause", "(not included)");
                var additionalTerms = variables.GetValueOrDefault("Lease.AdditionalTerms", "(none)");
                var leadPaint = variables.GetValueOrDefault("LeadPaint.Disclosure", "(not set)");
                var stateDisclosures = variables.GetValueOrDefault("State.RequiredDisclosures", string.Empty);

                // Build a text summary of the lease for the AI to review
                var leaseSummary = new StringBuilder();
                leaseSummary.AppendLine($"State/Jurisdiction: {(string.IsNullOrEmpty(state) ? "Unknown" : state)}");
                leaseSummary.AppendLine($"Landlord: {landlord}");
                leaseSummary.AppendLine($"Tenant(s): {tenants}");
                leaseSummary.AppendLine($"Property: {address}");
                leaseSummary.AppendLine($"Lease Term: {startDate} to {endDate}");
                leaseSummary.AppendLine($"Monthly Rent: {rent}");
                leaseSummary.AppendLine($"Security Deposit: {deposit}");
                leaseSummary.AppendLine($"Late Fee: {lateFee} (grace period: {lateFeeGrace} days)");
                leaseSummary.AppendLine($"Pets Allowed: {petsAllowed}");
                leaseSummary.AppendLine($"Smoking Policy: {smokingPolicy}");
                leaseSummary.AppendLine($"Utilities Responsibility: {utilities}");
                leaseSummary.AppendLine($"Early Termination Clause: {earlyTermination}");
                leaseSummary.AppendLine($"Lead Paint Disclosure: {leadPaint}");
                leaseSummary.AppendLine($"State-Required Disclosures: {(string.IsNullOrEmpty(stateDisclosures) ? "(not injected)" : stateDisclosures)}");
                leaseSummary.AppendLine($"Additional Terms: {additionalTerms}");

                // Check for any remaining unfilled placeholders in variables
                var unfilledKeys = variables.Where(kv => kv.Value.Contains("[") || kv.Value.Contains("(not set)") || string.IsNullOrWhiteSpace(kv.Value))
                                            .Select(kv => kv.Key).ToList();
                if (unfilledKeys.Any())
                    leaseSummary.AppendLine($"Unfilled placeholders detected: {string.Join(", ", unfilledKeys)}");

                var prompt = $@"You are a residential lease agreement review assistant. Review the following lease summary and identify issues.

LEASE SUMMARY:
{leaseSummary}

Return a JSON object with this exact structure:
{{
  ""summary"": ""One or two sentence plain-English overview of the lease quality"",
  ""issues"": [
    {{
      ""severity"": ""error"" | ""warning"" | ""suggestion"",
      ""category"": ""Missing Clause"" | ""Unfilled Placeholder"" | ""Risky Language"" | ""State Compliance"" | ""Best Practice"",
      ""message"": ""Concise description of the issue"",
      ""section"": ""Which section of the lease this relates to (optional, can be null)""
    }}
  ]
}}

Rules:
- severity ""error"": the lease is likely invalid or missing legally required content
- severity ""warning"": the lease may have problems or expose the landlord to risk
- severity ""suggestion"": a best-practice improvement that would make the lease stronger
- If jurisdiction is known, flag any state-specific required disclosures that appear to be missing
- Flag any fields that show (not set), (unknown), or appear empty
- Flag security deposits that exceed 2x monthly rent (most US states limit this)
- Flag missing late fee grace period (required in many states)
- Flag missing lead paint disclosure if property could be pre-1978
- Return an empty issues array if the lease looks complete and well-formed
- Keep messages short (under 120 characters each)
- Return valid JSON only";

                var aiResponse = await _openAIService.GenerateJsonAsync<AiLeaseReviewResponse>(prompt, maxTokens: 2000);

                if (!aiResponse.Success || aiResponse.Data == null)
                {
                    _logger.LogWarning("AI lease review returned no data for instance {InstanceId}: {Message}", instanceId, aiResponse.Message);
                    return ServiceResponse<LeaseReviewResultDto>.CreateSuccess(new LeaseReviewResultDto
                    {
                        HasIssues = false,
                        Summary = "AI review is currently unavailable. Please review the lease manually.",
                        Issues = []
                    });
                }

                var result = new LeaseReviewResultDto
                {
                    HasIssues = aiResponse.Data.Issues.Count > 0,
                    Summary = aiResponse.Data.Summary,
                    Issues = aiResponse.Data.Issues.Select(i => new LeaseReviewIssueDto
                    {
                        Severity = i.Severity,
                        Category = i.Category,
                        Message = i.Message,
                        Section = i.Section
                    }).ToList()
                };

                return ServiceResponse<LeaseReviewResultDto>.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reviewing lease instance {InstanceId}", instanceId);
                return ServiceResponse<LeaseReviewResultDto>.CreateError("Review failed", ex.Message);
            }
        }

        /// <summary>
        /// Injects a table-grounded, server-validated disclosure result before finalization.
        /// </summary>
        private async Task<ServiceResponse<bool>> InjectStateRequiredPoliciesAsync(long instanceId, string state, long organizationId)
        {
            try
            {
                var disclosureResponse = await _stateRequiredDisclosureService.GenerateAsync(state);
                if (!disclosureResponse.Success || disclosureResponse.Data == null)
                    return ServiceResponse<bool>.CreateError(
                        disclosureResponse.Message,
                        disclosureResponse.Errors?.Details ?? "State disclosure generation did not return data.",
                        statusCode: disclosureResponse.StatusCode);

                var instance = await _leaseInstanceRepository.GetLeaseInstanceByIdAsync(instanceId, organizationId);
                if (instance == null)
                    return ServiceResponse<bool>.CreateError("Lease instance unavailable", "The disclosure snapshot could not be attached to the lease.");

                var result = disclosureResponse.Data;
                var citationJson = JsonSerializer.Serialize(result.Citations);
                var snapshot = new List<LeaseVariable>
                {
                    new() { LeaseInstanceId = instanceId, VariableKey = "State.Name", VariableValue = result.StateCode, VariableType = "String" },
                    new() { LeaseInstanceId = instanceId, VariableKey = "State.RequiredDisclosures", VariableValue = result.PlainText, VariableType = "String" },
                    new() { LeaseInstanceId = instanceId, VariableKey = "State.RequiredDisclosureCitations", VariableValue = citationJson, VariableType = "Json" },
                    new() { LeaseInstanceId = instanceId, VariableKey = "State.RequiredDisclosureSnapshotUtc", VariableValue = result.SnapshotUtc.ToString("O"), VariableType = "DateTime" }
                };
                await _leaseInstanceRepository.ReplaceStateDisclosureSnapshotAsync(instanceId, snapshot, organizationId);

                _logger.LogInformation("Atomically replaced grounded state disclosure snapshot for state {State} on instance {InstanceId}", result.StateCode, instanceId);
                return ServiceResponse<bool>.CreateSuccess(true);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error injecting state policies for instance {InstanceId}, state {State}", instanceId, state);
                return ServiceResponse<bool>.CreateError("State disclosure finalization failed", ex.Message, statusCode: 422);
            }
        }
    }
}
