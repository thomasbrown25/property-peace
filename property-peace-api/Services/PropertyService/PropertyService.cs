
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Repositories.Properties;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Repositories.MaintenanceRequests;
using brownstone_hub_api.Repositories.Subscriptions;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.Expenses;
using brownstone_hub_api.Repositories.RecurringExpenses;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Services.ChecklistService;
using brownstone_hub_api.Repositories.TenantDocuments;
using brownstone_hub_api.Repositories.Payments;
using brownstone_hub_api.Repositories.Units;
using brownstone_hub_api.Repositories.ApplicationInvites;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Services.ImageService;
using brownstone_hub_api.Services.UnitService;
using brownstone_hub_api.Services.SubscriptionService;
using brownstone_hub_api.Services.AzureBlobService;
using Azure.Storage.Blobs;
using System.Text.Json;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.PropertyService
{
    public class PropertyService(IPropertyRepository propertyRepository, IImageService<PropertyImage, LoadImageDto, AddImageDto> imageService, IUnitService unitService, IUserRepository userRepository, IMaintenanceRequestRepository maintenanceRequestRepository, IFeatureGateService featureGateService, ISubscriptionRepository subscriptionRepository, ILeaseRepository leaseRepository, IExpenseRepository expenseRepository, IRecurringExpenseRepository recurringExpenseRepository, IConversationRepository conversationRepository, IApplicationRepository applicationRepository, IChecklistRepository checklistRepository, ITenantDocumentRepository tenantDocumentRepository, IPaymentRepository paymentRepository, IUnitRepository unitRepository, IApplicationInviteRepository applicationInviteRepository, IChecklistService checklistService, ITenantRepository tenantRepository, BlobServiceClient blobServiceClient, IAzureBlobService azureBlobService, IHttpContextAccessor httpContextAccessor, IListingRepository listingRepository, ILogger<PropertyService> logger) : IPropertyService
    {
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IImageService<PropertyImage, LoadImageDto, AddImageDto> _imageService = imageService;
        private readonly IUnitService _unitService = unitService;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
        private readonly IFeatureGateService _featureGateService = featureGateService;
        private readonly ISubscriptionRepository _subscriptionRepository = subscriptionRepository;
        private readonly ILeaseRepository _leaseRepository = leaseRepository;
        private readonly IExpenseRepository _expenseRepository = expenseRepository;
        private readonly IRecurringExpenseRepository _recurringExpenseRepository = recurringExpenseRepository;
        private readonly IConversationRepository _conversationRepository = conversationRepository;
        private readonly IApplicationRepository _applicationRepository = applicationRepository;
        private readonly IChecklistRepository _checklistRepository = checklistRepository;
        private readonly ITenantDocumentRepository _tenantDocumentRepository = tenantDocumentRepository;
        private readonly IPaymentRepository _paymentRepository = paymentRepository;
        private readonly IUnitRepository _unitRepository = unitRepository;
        private readonly IApplicationInviteRepository _applicationInviteRepository = applicationInviteRepository;
        private readonly IChecklistService _checklistService = checklistService;
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly IListingRepository _listingRepository = listingRepository;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<PropertyService> _logger = logger;
        private const string ChecklistContainerName = "checklist-images";

        private long? GetCurrentOrganizationId()
        {
            if (_httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
            {
                return orgId;
            }
            return null;
        }

        /// <summary>
        /// Extracts just the street address (street number + route) from a full address string.
        /// Removes city, state, and zip code.
        /// </summary>
        private string ExtractStreetAddressOnly(string? fullAddress)
        {
            if (string.IsNullOrWhiteSpace(fullAddress))
                return string.Empty;

            // Split by comma to separate address components
            var parts = fullAddress.Split(',');

            // The first part is typically the street address (street number + route)
            // Remove any trailing/leading whitespace
            var streetAddress = parts[0].Trim();

            return streetAddress;
        }

        public async Task<ServiceResponse<LoadPropertyDto>> AddOrUpdateProperty(UpdatePropertyDto propertyDto, List<IFormFile> files)
        {
            try
            {
                // ✅ Step 1: Get organization ID from context
                var organizationId = GetCurrentOrganizationId();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadPropertyDto>.CreateError(
                        "Organization context is required",
                        "Organization context is required to create or update properties.",
                        "",
                        403
                    );
                }

                // ✅ Step 2: Validate landlord (still needed for LandlordId field, but we'll use OrganizationId primarily)
                var landlord = await _userRepository.GetUser(propertyDto.LandlordId);
                if (landlord == null)
                    return ServiceResponse<LoadPropertyDto>.CreateError(
                        "Invalid Landlord ID",
                        "The specified landlord does not exist."
                    );

                // Set OrganizationId on the property DTO
                propertyDto.OrganizationId = organizationId.Value;

                LoadPropertyDto property;

                // ✅ Step 2: Check if property exists
                var existingProperty = await _propertyRepository.GetPropertyById(propertyDto.Id);

                if (existingProperty != null)
                {
                    // ✅ Check for duplicate property name when updating (exclude current property)
                    // Only check if name is provided (not null or empty)
                    if (!string.IsNullOrWhiteSpace(propertyDto.Name))
                    {
                        var nameExists = await _propertyRepository.PropertyNameExistsInOrganization(
                            propertyDto.Name,
                            organizationId.Value,
                            propertyDto.Id
                        );

                        if (nameExists)
                        {
                            return ServiceResponse<LoadPropertyDto>.CreateError(
                                "Duplicate Property Name",
                                $"A property with the name '{propertyDto.Name}' already exists in your organization. Please choose a different name.",
                                "",
                                400
                            );
                        }
                    }

                    // ✅ Update property
                    property = await _propertyRepository.UpdateProperty(propertyDto);

                    // ✅ Step 3: Handle image update (only if files provided)
                    if (files is { Count: > 0 })
                    {
                        await _imageService.DeleteImagesByRefId(property.Id); // 💥 Generic cleanup
                        var imageResponse = await _imageService.AddImages(property.Id, files);
                        if (!imageResponse.Success)
                            return ServiceResponse<LoadPropertyDto>.CreateError("Image Upload Failed", imageResponse.Message);

                        property.Images = imageResponse.Data;
                    }


                    return new ServiceResponse<LoadPropertyDto>
                    {
                        Data = property,
                        Message = "Property updated successfully"
                    };
                }

                // ✅ Step 4: Check subscription status and unit limits before creating new property
                if (propertyDto.Id == 0) // Only check for new properties, not updates
                {
                    var canAddProperty = await _featureGateService.CanAddPropertyAsync(propertyDto.LandlordId);
                    if (!canAddProperty)
                    {
                        return ServiceResponse<LoadPropertyDto>.CreateError(
                            "Subscription Required",
                            "Your subscription is not active. Please activate your subscription to add properties.",
                            "",
                            403
                        );
                    }

                    // Note: Property limits removed - everything is based on unit limits now
                    // Unit limits are checked when creating units for the property (see Steps 8 and 8b below)

                    // ✅ Check for duplicate property name before creating
                    // Only check if name is provided (not null or empty)
                    if (!string.IsNullOrWhiteSpace(propertyDto.Name))
                    {
                        var nameExists = await _propertyRepository.PropertyNameExistsInOrganization(
                            propertyDto.Name,
                            organizationId.Value
                        );

                        if (nameExists)
                        {
                            return ServiceResponse<LoadPropertyDto>.CreateError(
                                "Duplicate Property Name",
                                $"A property with the name '{propertyDto.Name}' already exists in your organization. Please choose a different name.",
                                "",
                                400
                            );
                        }
                    }
                }

                // ✅ Step 5: Create new property
                // Only set property name from street address when no name was provided at creation
                if (string.IsNullOrWhiteSpace(propertyDto.Name) && !string.IsNullOrWhiteSpace(propertyDto.StreetAddress))
                {
                    propertyDto.Name = ExtractStreetAddressOnly(propertyDto.StreetAddress);
                }
                // If name is already provided, leave it as-is (do not overwrite)

                property = await _propertyRepository.AddProperty(propertyDto);

                // ✅ Step 6: Do not auto-create inspections/checklists for new properties.
                // Users should intentionally create move-in or move-out inspections from the Inspections page.

                // ✅ Step 7: Handle image upload for new property
                if (files is { Count: > 0 })
                {
                    var imageResponse = await _imageService.AddImages(property.Id, files);
                    if (!imageResponse.Success)
                        return ServiceResponse<LoadPropertyDto>.CreateError("Image Upload Failed", imageResponse.Message);

                    property.Images = imageResponse.Data;
                }

                // ✅ Step 8: Auto-create "Unit 1" for single-family properties
                if (propertyDto.PropertyType == Enums.EPropertyType.SingleFamily)
                {
                    try
                    {
                        // Check unit limits before creating the unit
                        var remainingUnitSlots = await _featureGateService.GetRemainingUnitSlotsAsync(propertyDto.LandlordId);

                        if (remainingUnitSlots.HasValue && remainingUnitSlots.Value < 1)
                        {
                            // Property was created but we can't add the unit - delete the property
                            await _propertyRepository.DeleteProperty(property.Id);
                            return ServiceResponse<LoadPropertyDto>.CreateError(
                                "Unit Limit Reached",
                                "You've reached your unit limit. Please upgrade your subscription to add more units.",
                                "",
                                403
                            );
                        }

                        var unitDto = new Dtos.Unit.UpdateUnitDto
                        {
                            Id = 0, // New unit
                            Name = "Unit 1",
                            PropertyId = property.Id,
                            Bedrooms = "",
                            Baths = "",
                            Type = "",
                            SquareFeet = 0,
                            RentAmount = 0,
                            IsOccupied = false,
                            Amenities = [],
                            IncludedUtility = []
                        };

                        var unitResponse = await _unitService.AddOrUpdateUnit(unitDto);
                        if (!unitResponse.Success)
                        {
                            _logger.LogWarning("Failed to auto-create unit for single-family property {PropertyId}: {Message}",
                                property.Id, unitResponse.Message);
                            // If unit limit was exceeded, delete the property
                            if (unitResponse.Message.Contains("Unit Limit") || unitResponse.Message.Contains("unit limit"))
                            {
                                await _propertyRepository.DeleteProperty(property.Id);
                                return ServiceResponse<LoadPropertyDto>.CreateError(
                                    "Unit Limit Reached",
                                    unitResponse.Message,
                                    "",
                                    403
                                );
                            }
                            // Otherwise, don't fail property creation - user can add unit manually later
                        }
                        else
                        {
                            _logger.LogInformation("Successfully auto-created unit for single-family property {PropertyId}", property.Id);
                            // Refresh property to include the newly created unit
                            property = await _propertyRepository.GetPropertyById(property.Id);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error auto-creating unit for single-family property {PropertyId}", property.Id);
                        // Don't fail property creation if unit creation fails - user can add unit manually later
                    }
                }

                // ✅ Step 8b: Auto-create units for multi-family properties
                if (propertyDto.PropertyType == Enums.EPropertyType.MultiUnit && propertyDto.UnitCount.HasValue && propertyDto.UnitCount.Value > 0)
                {
                    try
                    {
                        var unitCount = propertyDto.UnitCount.Value;

                        // Check unit limits before creating
                        var currentTotalUnits = await _featureGateService.GetCurrentTotalUnitsAsync(propertyDto.LandlordId);
                        var remainingUnitSlots = await _featureGateService.GetRemainingUnitSlotsAsync(propertyDto.LandlordId);

                        // Total units to create: just the specified number (Unit 1, Unit 2, etc.)
                        var totalUnitsToCreate = unitCount;

                        if (remainingUnitSlots.HasValue && remainingUnitSlots.Value < totalUnitsToCreate)
                        {
                            _logger.LogWarning("Cannot create {TotalUnits} units for property {PropertyId}. Remaining slots: {RemainingSlots}",
                                totalUnitsToCreate, property.Id, remainingUnitSlots.Value);
                            return ServiceResponse<LoadPropertyDto>.CreateError(
                                "Unit Limit Exceeded",
                                $"You cannot add {totalUnitsToCreate} units. You have {remainingUnitSlots.Value} unit slots remaining. Please upgrade your subscription to add more units.",
                                "",
                                403
                            );
                        }

                        var unitsToCreate = new List<Dtos.Unit.UpdateUnitDto>();

                        // Create numbered units (Unit 1, Unit 2, etc.) - no Main Unit for multi-unit properties
                        for (int i = 1; i <= unitCount; i++)
                        {
                            unitsToCreate.Add(new Dtos.Unit.UpdateUnitDto
                            {
                                Id = 0,
                                Name = $"Unit {i}",
                                PropertyId = property.Id,
                                Bedrooms = "",
                                Baths = "",
                                Type = "",
                                SquareFeet = 0,
                                RentAmount = 0,
                                IsOccupied = false,
                                Amenities = [],
                                IncludedUtility = []
                            });
                        }

                        // Use bulk create to create all units at once
                        var bulkCreateDto = new Dtos.Unit.BulkCreateUnitsDto
                        {
                            PropertyId = property.Id,
                            Units = unitsToCreate
                        };

                        var bulkResponse = await _unitService.BulkCreateUnits(bulkCreateDto);
                        if (!bulkResponse.Success)
                        {
                            _logger.LogWarning("Failed to auto-create units for multi-family property {PropertyId}: {Message}",
                                property.Id, bulkResponse.Message);
                            // Don't fail property creation if unit creation fails - user can add units manually later
                        }
                        else
                        {
                            _logger.LogInformation("Successfully auto-created {UnitCount} units for multi-family property {PropertyId}",
                                totalUnitsToCreate, property.Id);
                            // Refresh property to include the newly created units
                            property = await _propertyRepository.GetPropertyById(property.Id);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error auto-creating units for multi-family property {PropertyId}", property.Id);
                        // Don't fail property creation if unit creation fails - user can add units manually later
                    }
                }

                // ✅ Step 9: Return success
                return new ServiceResponse<LoadPropertyDto>
                {
                    Data = property,
                    Message = "Property added successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding/updating property");
                return ServiceResponse<LoadPropertyDto>.CreateError(
                    "Error adding/updating property",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }


        public async Task<ServiceResponse<LoadPropertyDto>> GetPropertyById(long propertyId)
        {
            try
            {
                var property = await _propertyRepository.GetPropertyById(propertyId);

                if (property == null)
                {
                    return ServiceResponse<LoadPropertyDto>.CreateError(
                        "Property Not Found",
                        $"No property was found with ID {propertyId}.",
                        "",
                        404
                    );
                }

                // Use OrganizationId if available, otherwise fallback to LandlordId for backward compatibility
                if (property.OrganizationId.HasValue)
                {
                    property.IsSingleUnitPortfolio = await _propertyRepository.IsSingleUnitPortfolio(property.OrganizationId.Value);
                }
                else
                {
                    // Fallback for legacy properties without OrganizationId
                    property.IsSingleUnitPortfolio = await _propertyRepository.IsSingleUnitPortfolio(property.LandlordId);
                }

                // Regenerate SAS URL for mainImageUrl if it exists
                if (!string.IsNullOrEmpty(property.MainImageUrl))
                {
                    try
                    {
                        var blobName = ExtractBlobNameFromUrl(property.MainImageUrl);
                        if (!string.IsNullOrEmpty(blobName))
                        {
                            var containerClient = _blobServiceClient.GetBlobContainerClient("property-images");
                            var blobClient = containerClient.GetBlobClient(blobName);

                            // Check if blob exists before generating SAS URL
                            if (await blobClient.ExistsAsync())
                            {
                                var sasUri = _azureBlobService.GenerateBlobSasUri(
                                    _blobServiceClient,
                                    blobClient,
                                    TimeSpan.FromHours(24) // Longer expiry for main image
                                );
                                property.MainImageUrl = sasUri;
                            }
                            else
                            {
                                _logger.LogWarning("Blob {BlobName} not found for property {PropertyId} mainImageUrl", blobName, propertyId);
                                property.MainImageUrl = null; // Clear invalid URL
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex, "Error regenerating SAS URL for mainImageUrl of property {PropertyId}", propertyId);
                        // Don't fail the request, just log the warning
                    }
                }

                return new ServiceResponse<LoadPropertyDto>
                {
                    Data = property,
                    Message = "Property retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving property {PropertyId}", propertyId);
                return ServiceResponse<LoadPropertyDto>.CreateError(
                    "Error retrieving property",
                    ex.Message,
                    ex.InnerException?.Message
                );
            }
        }

        public async Task<ServiceResponse<List<LoadPropertyDto>>> GetPropertiesByOrganizationId(long organizationId)
        {
            try
            {
                var properties = await _propertyRepository.GetPropertiesByOrganizationId(organizationId);

                return new ServiceResponse<List<LoadPropertyDto>>
                {
                    Data = properties,
                    Message = "Properties retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving properties for organization {OrganizationId}", organizationId);
                return ServiceResponse<List<LoadPropertyDto>>.CreateError(
                    "Error retrieving properties",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<int>> GetOccupiedPropertiesCountAsync(long organizationId)
        {
            try
            {
                var occupiedCount = await _propertyRepository.GetOccupiedPropertiesCountAsync(organizationId);

                if (occupiedCount == 0)
                {
                    return ServiceResponse<int>.CreateSuccess(occupiedCount, "No occupied properties found for this organization.");
                }

                return ServiceResponse<int>.CreateSuccess(occupiedCount, "Occupied properties count retrieved successfully.");

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving occupied properties count for organization {OrganizationId}", organizationId);
                return ServiceResponse<int>.CreateError("Error retrieving occupied properties count", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<int>> GetVacantPropertiesCountAsync(long organizationId)
        {
            try
            {
                var vacantCount = await _propertyRepository.GetVacantPropertiesCountAsync(organizationId);

                if (vacantCount == 0)
                {
                    return ServiceResponse<int>.CreateSuccess(vacantCount, "No vacant properties found for this organization.");
                }

                return ServiceResponse<int>.CreateSuccess(vacantCount, "Vacant properties count retrieved successfully.");

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving vacant properties count for organization {OrganizationId}", organizationId);
                return ServiceResponse<int>.CreateError("Error retrieving vacant properties count", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadPropertyDto>> DeleteProperty(long propertyId)
        {
            try
            {
                var property = await _propertyRepository.GetPropertyById(propertyId);
                if (property == null)
                {
                    return ServiceResponse<LoadPropertyDto>.CreateError("Property not found", "The specified property does not exist.", "", 404);
                }

                // Get all related IDs
                var tenantIds = await _propertyRepository.GetTenantIdsByPropertyId(propertyId);
                var leaseIds = await _propertyRepository.GetLeaseIdsByPropertyId(propertyId);

                // Delete tenants for this property (fully delete, not just disconnect)
                var deletedTenantsCount = await _tenantRepository.DeleteTenantsByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} tenants", deletedTenantsCount);

                // Delete tenant documents for tenants in this property (if any remain)
                if (tenantIds.Any())
                {
                    var deletedDocsCount = await _tenantDocumentRepository.DeleteTenantDocumentsByTenantIds(tenantIds);
                    _logger.LogInformation("Marked {Count} tenant documents for deletion", deletedDocsCount);
                }

                // Delete maintenance request images from blob storage before deleting maintenance requests
                var maintenanceRequests = await _maintenanceRequestRepository.GetMaintenanceRequestsByPropertyId(propertyId);
                if (maintenanceRequests != null && maintenanceRequests.Any())
                {
                    var maintenanceContainerClient = _blobServiceClient.GetBlobContainerClient("maintenance-images");
                    int deletedMaintenanceImageCount = 0;

                    foreach (var request in maintenanceRequests)
                    {
                        if (request.Images != null && request.Images.Any())
                        {
                            foreach (var image in request.Images)
                            {
                                var blobName = image.BlobName;
                                if (!string.IsNullOrEmpty(blobName))
                                {
                                    try
                                    {
                                        var blobClient = maintenanceContainerClient.GetBlobClient(blobName);
                                        await blobClient.DeleteIfExistsAsync();
                                        deletedMaintenanceImageCount++;
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger.LogWarning(ex, "Failed to delete maintenance image blob {BlobName}", blobName);
                                    }
                                }
                            }
                        }
                    }
                    _logger.LogInformation("Deleted {Count} maintenance request images from blob storage", deletedMaintenanceImageCount);
                }

                // Delete maintenance requests for this property
                var deletedMaintenanceCount = await _maintenanceRequestRepository.DeleteMaintenanceRequestsByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} maintenance requests", deletedMaintenanceCount);

                // Delete expenses for this property
                var deletedExpensesCount = await _expenseRepository.DeleteExpensesByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} expenses", deletedExpensesCount);

                // Delete recurring expenses for this property
                var deletedRecurringExpensesCount = await _recurringExpenseRepository.DeleteRecurringExpensesByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} recurring expenses", deletedRecurringExpensesCount);

                // Delete leases for units in this property (hard delete)
                // Get fresh lease IDs after deleting tenants to ensure we have the current state
                var currentLeaseIds = await _propertyRepository.GetLeaseIdsByPropertyId(propertyId);
                if (currentLeaseIds.Any())
                {
                    try
                    {
                        var deletedLeasesCount = await _leaseRepository.DeleteLeasesByPropertyId(propertyId);
                        _logger.LogInformation("Deleted {Count} lease(s) for property {PropertyId}", deletedLeasesCount, propertyId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error deleting leases for property {PropertyId}: {Message}", propertyId, ex.Message);
                        // Continue with property deletion even if lease deletion fails
                    }
                }

                // Delete conversations for this property
                var deletedConversationsCount = await _conversationRepository.DeleteConversationsByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} conversations", deletedConversationsCount);

                // Get application IDs before deletion to delete related invites
                var applications = await _applicationRepository.GetApplicationsByPropertyId(propertyId);
                var applicationIds = applications.Select(a => a.Id).ToList();

                // Delete rental applications for this property
                var deletedApplicationsCount = await _applicationRepository.DeleteApplicationsByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} rental applications", deletedApplicationsCount);

                // Delete application invites for applications in this property
                if (applicationIds.Any())
                {
                    var deletedAppInvitesCount = await _applicationInviteRepository.DeleteInvitesByApplicationIds(applicationIds);
                    _logger.LogInformation("Deleted {Count} application invites", deletedAppInvitesCount);
                }

                // Delete application invites directly linked to this property
                var deletedPropertyInvitesCount = await _applicationInviteRepository.DeleteInvitesByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} property application invites", deletedPropertyInvitesCount);

                // Delete checklist images from blob storage before deleting checklists
                var checklists = await _checklistRepository.GetChecklistsByPropertyId(propertyId);
                if (checklists != null && checklists.Any())
                {
                    var containerClient = _blobServiceClient.GetBlobContainerClient(ChecklistContainerName);
                    int deletedImageCount = 0;

                    foreach (var checklist in checklists)
                    {
                        // Delete before move-in images
                        if (checklist.BeforeMoveInImagesBlobNames != null && checklist.BeforeMoveInImagesBlobNames.Any())
                        {
                            foreach (var blobName in checklist.BeforeMoveInImagesBlobNames)
                            {
                                try
                                {
                                    var blobClient = containerClient.GetBlobClient(blobName);
                                    await blobClient.DeleteIfExistsAsync();
                                    deletedImageCount++;
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogWarning(ex, "Failed to delete checklist image blob {BlobName}", blobName);
                                }
                            }
                        }

                        // Delete after move-out images
                        if (checklist.AfterMoveOutImagesBlobNames != null && checklist.AfterMoveOutImagesBlobNames.Any())
                        {
                            foreach (var blobName in checklist.AfterMoveOutImagesBlobNames)
                            {
                                try
                                {
                                    var blobClient = containerClient.GetBlobClient(blobName);
                                    await blobClient.DeleteIfExistsAsync();
                                    deletedImageCount++;
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogWarning(ex, "Failed to delete checklist image blob {BlobName}", blobName);
                                }
                            }
                        }

                        // Delete checklist item photos
                        if (checklist.Items != null && checklist.Items.Any())
                        {
                            foreach (var item in checklist.Items)
                            {
                                foreach (var blobName in item.PhotoBlobNames ?? new List<string>())
                                {
                                    try
                                    {
                                        var blobClient = containerClient.GetBlobClient(blobName);
                                        await blobClient.DeleteIfExistsAsync();
                                        deletedImageCount++;
                                    }
                                    catch (Exception ex)
                                    {
                                        _logger.LogWarning(ex, "Failed to delete checklist item photo blob {BlobName}", blobName);
                                    }
                                }
                            }
                        }
                    }
                    _logger.LogInformation("Deleted {Count} checklist images from blob storage", deletedImageCount);
                }

                // Delete checklists for this property
                var deletedChecklistsCount = await _checklistRepository.DeleteChecklistsByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} checklists", deletedChecklistsCount);

                // Delete property images
                await _imageService.DeleteImagesByRefId(propertyId);
                _logger.LogInformation("Deleted property images");

                // Delete listings (must happen before units due to FK_Listings_Units_UnitId constraint)
                var deletedListingsCount = await _listingRepository.DeleteListingsByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} listings", deletedListingsCount);

                // Delete units
                var deletedUnitsCount = await _unitRepository.DeleteUnitsByPropertyId(propertyId);
                _logger.LogInformation("Deleted {Count} units", deletedUnitsCount);

                // Finally, soft delete the property itself
                var deletedProperty = await _propertyRepository.DeleteProperty(propertyId);

                return new ServiceResponse<LoadPropertyDto>
                {
                    Data = deletedProperty,
                    Message = "Property and all associated data (leases, tenants, maintenance requests, expenses, checklists, images, documents) have been fully deleted successfully."
                };
            }
            catch (KeyNotFoundException ex)
            {
                _logger.LogWarning(ex, "Property {PropertyId} not found for deletion", propertyId);
                return ServiceResponse<LoadPropertyDto>.CreateError("Property not found", "The specified property does not exist.", "", 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting property {PropertyId}", propertyId);
                return ServiceResponse<LoadPropertyDto>.CreateError("Error deleting property", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<LoadPropertyDto>> InactivateProperty(long propertyId)
        {
            try
            {
                var property = await _propertyRepository.GetPropertyById(propertyId);
                if (property == null)
                {
                    return ServiceResponse<LoadPropertyDto>.CreateError("Property not found", "The specified property does not exist.", "", 404);
                }

                // Deactivate leases for this property (preserve payments and expenses)
                var leaseIds = await _propertyRepository.GetLeaseIdsByPropertyId(propertyId);
                if (leaseIds.Any())
                {
                    try
                    {
                        var deactivatedLeasesCount = await _leaseRepository.DeactivateLeasesByPropertyId(propertyId);
                        _logger.LogInformation("Deactivated {Count} lease(s) for property {PropertyId} during inactivation (payments and expenses preserved)", deactivatedLeasesCount, propertyId);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error deactivating leases for property {PropertyId} during inactivation: {Message}", propertyId, ex.Message);
                        // Continue with property inactivation even if lease deactivation fails
                    }
                }

                var inactivatedProperty = await _propertyRepository.InactivateProperty(propertyId);

                return new ServiceResponse<LoadPropertyDto>
                {
                    Data = inactivatedProperty,
                    Message = "Property inactivated successfully. Leases have been deactivated and payments/expenses have been preserved."
                };
            }
            catch (KeyNotFoundException ex)
            {
                _logger.LogWarning(ex, "Property {PropertyId} not found for inactivation", propertyId);
                return ServiceResponse<LoadPropertyDto>.CreateError("Property not found", "The specified property does not exist.", "", 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error inactivating property {PropertyId}", propertyId);
                return ServiceResponse<LoadPropertyDto>.CreateError("Error inactivating property", ex.Message, ex.InnerException?.Message);
            }
        }

        /// <summary>
        /// Extracts the blob name from a blob URL (with or without SAS token)
        /// </summary>
        private string? ExtractBlobNameFromUrl(string url)
        {
            if (string.IsNullOrEmpty(url))
                return null;

            try
            {
                // If it's already just a blob name (no slashes, no protocol, no query params), return as-is
                if (!url.Contains("/") && !url.Contains("?") && !url.Contains(":"))
                    return url;

                // Parse the URL to extract blob name
                var uri = new Uri(url);
                var pathSegments = uri.AbsolutePath.Split('/', StringSplitOptions.RemoveEmptyEntries);

                // URL format: https://account.blob.core.windows.net/container/blob-name
                // pathSegments[0] = container, pathSegments[1+] = blob name (may have slashes)
                if (pathSegments.Length >= 2)
                {
                    // Join all segments after the container name to handle blob names with slashes
                    return string.Join("/", pathSegments.Skip(1));
                }

                // If we can't parse it, try to extract from the last segment
                var lastSegment = pathSegments.LastOrDefault();
                if (!string.IsNullOrEmpty(lastSegment))
                    return lastSegment;

                return null;
            }
            catch (UriFormatException)
            {
                // If URL parsing fails, try to extract blob name manually using regex
                // Look for pattern: /container/blob-name or container/blob-name (with optional SAS token)
                var match = System.Text.RegularExpressions.Regex.Match(url, @"(?:/|^)(?:property-images|maintenance-images|checklist-images|account-files)/([^?]+)");
                if (match.Success)
                    return match.Groups[1].Value;

                // Try to extract just the filename if it looks like a GUID-based blob name
                var guidMatch = System.Text.RegularExpressions.Regex.Match(url, @"([a-f0-9\-]{36,}\.[a-z]{3,4})(?:\?|$)");
                if (guidMatch.Success)
                    return guidMatch.Groups[1].Value;

                return null;
            }
            catch
            {
                return null;
            }
        }

        public async Task<ServiceResponse<LoadPropertyDto>> ReactivateProperty(long propertyId)
        {
            try
            {
                var property = await _propertyRepository.GetPropertyById(propertyId);
                if (property == null)
                {
                    return ServiceResponse<LoadPropertyDto>.CreateError("Property not found", "The specified property does not exist.", "", 404);
                }

                var reactivatedProperty = await _propertyRepository.ReactivateProperty(propertyId);

                return new ServiceResponse<LoadPropertyDto>
                {
                    Data = reactivatedProperty,
                    Message = "Property reactivated successfully"
                };
            }
            catch (KeyNotFoundException ex)
            {
                _logger.LogWarning(ex, "Property {PropertyId} not found for reactivation", propertyId);
                return ServiceResponse<LoadPropertyDto>.CreateError("Property not found", "The specified property does not exist.", "", 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reactivating property {PropertyId}", propertyId);
                return ServiceResponse<LoadPropertyDto>.CreateError("Error reactivating property", ex.Message, ex.InnerException?.Message);
            }
        }

        public async Task<ServiceResponse<bool>> IsSingleUnitPortfolio(long organizationId)
        {
            try
            {
                var isSingleUnit = await _propertyRepository.IsSingleUnitPortfolio(organizationId);

                return new ServiceResponse<bool>
                {
                    Data = isSingleUnit,
                    Message = "Portfolio type retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error determining portfolio type for organization {OrganizationId}", organizationId);
                return ServiceResponse<bool>.CreateError("Error determining portfolio type", ex.Message, ex.InnerException?.Message);
            }
        }

    }
}

