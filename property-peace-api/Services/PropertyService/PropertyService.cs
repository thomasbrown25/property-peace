
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Repositories.Properties;

using brownstone_hub_api.Repositories.MaintenanceRequests;

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
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Infrastructure;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.ActivationFunnel;
using Azure.Storage.Blobs;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace brownstone_hub_api.Services.PropertyService
{
    public class PropertyService(IPropertyRepository propertyRepository, IImageService<PropertyImage, LoadImageDto, AddImageDto> imageService, IMaintenanceRequestRepository maintenanceRequestRepository, ILeaseRepository leaseRepository, IExpenseRepository expenseRepository, IRecurringExpenseRepository recurringExpenseRepository, IConversationRepository conversationRepository, IApplicationRepository applicationRepository, IChecklistRepository checklistRepository, ITenantDocumentRepository tenantDocumentRepository, IPaymentRepository paymentRepository, IUnitRepository unitRepository, IApplicationInviteRepository applicationInviteRepository, IChecklistService checklistService, ITenantRepository tenantRepository, BlobServiceClient blobServiceClient, IAzureBlobService azureBlobService, IHttpContextAccessor httpContextAccessor, IListingRepository listingRepository, IEntitlementDecisionService entitlementDecisionService, IOrganizationEntitlementMutationCoordinator mutationCoordinator, ILogger<PropertyService> logger, IActivationOccurrenceRecorder? occurrenceRecorder = null) : IPropertyService
    {
        private readonly IPropertyRepository _propertyRepository = propertyRepository;
        private readonly IImageService<PropertyImage, LoadImageDto, AddImageDto> _imageService = imageService;
        private readonly IMaintenanceRequestRepository _maintenanceRequestRepository = maintenanceRequestRepository;
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
        private readonly IEntitlementDecisionService _entitlementDecisionService = entitlementDecisionService;
        private readonly IOrganizationEntitlementMutationCoordinator _mutationCoordinator = mutationCoordinator;
        private readonly ILogger<PropertyService> _logger = logger;
        private readonly IActivationOccurrenceRecorder? _occurrenceRecorder = occurrenceRecorder;
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

        public async Task<ServiceResponse<LoadPropertyDto>> AddOrUpdateProperty(
            UpdatePropertyDto propertyDto,
            List<IFormFile> files,
            CancellationToken cancellationToken = default)
        {
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (propertyDto is null)
                {
                    return ServiceResponse<LoadPropertyDto>.CreateError(
                        "Invalid property", statusCode: StatusCodes.Status400BadRequest,
                        suppressDetailedErrors: true);
                }

                if (!TryGetTrustedMutationScope(out var userId, out var organizationId))
                {
                    return Forbidden<LoadPropertyDto>();
                }

                if (propertyDto.Id <= 0 &&
                    propertyDto.PropertyType == Enums.EPropertyType.MultiUnit &&
                    propertyDto.UnitCount is not > 0)
                {
                    return ServiceResponse<LoadPropertyDto>.CreateError(
                        "Invalid unit count",
                        "Multi-unit properties require a positive unit count.",
                        statusCode: StatusCodes.Status400BadRequest,
                        suppressDetailedErrors: true);
                }

                if (propertyDto.Id > 0)
                {
                    var existing = await _propertyRepository.GetPropertyByIdForMutationAsync(
                        propertyDto.Id, organizationId, cancellationToken);
                    if (existing?.OrganizationId != organizationId)
                    {
                        return Forbidden<LoadPropertyDto>();
                    }

                    propertyDto.OrganizationId = organizationId;
                    propertyDto.LandlordId = existing.LandlordId;
                    if (!string.IsNullOrWhiteSpace(propertyDto.Name) &&
                        await _propertyRepository.PropertyNameExistsInOrganization(
                            propertyDto.Name, organizationId, propertyDto.Id))
                    {
                        return DuplicatePropertyName(propertyDto.Name);
                    }

                    var updated = await _propertyRepository.UpdatePropertyForMutationAsync(
                        propertyDto, organizationId, cancellationToken);
                    if (updated is null)
                    {
                        return Forbidden<LoadPropertyDto>();
                    }

                    if (files is { Count: > 0 })
                    {
                        await _imageService.DeleteImagesByRefId(updated.Id);
                        var imageResponse = await _imageService.AddImages(updated.Id, files);
                        if (!imageResponse.Success)
                        {
                            return ServiceResponse<LoadPropertyDto>.CreateError(
                                "Image Upload Failed", imageResponse.Message);
                        }
                        updated.Images = imageResponse.Data;
                    }

                    return ServiceResponse<LoadPropertyDto>.CreateSuccess(
                        updated, "Property updated successfully");
                }

                propertyDto.Id = 0;
                propertyDto.OrganizationId = organizationId;
                // The authenticated subject owns the record. Client-supplied landlord/organization IDs are never trusted.
                propertyDto.LandlordId = userId;
                if (string.IsNullOrWhiteSpace(propertyDto.Name) &&
                    !string.IsNullOrWhiteSpace(propertyDto.StreetAddress))
                {
                    propertyDto.Name = ExtractStreetAddressOnly(propertyDto.StreetAddress);
                }

                var initialUnitCount = propertyDto.PropertyType switch
                {
                    Enums.EPropertyType.SingleFamily => 1,
                    Enums.EPropertyType.MultiUnit when propertyDto.UnitCount is > 0 => propertyDto.UnitCount.Value,
                    _ => 0
                };

                var outcome = await _mutationCoordinator.ExecuteAsync(
                    organizationId,
                    async token =>
                    {
                        if (!string.IsNullOrWhiteSpace(propertyDto.Name) &&
                            await _propertyRepository.PropertyNameExistsInOrganization(
                                propertyDto.Name, organizationId))
                        {
                            return EntitlementMutationOutcome<ServiceResponse<LoadPropertyDto>>.Rollback(
                                DuplicatePropertyName(propertyDto.Name));
                        }

                        if (initialUnitCount > 0)
                        {
                            var decision = await _entitlementDecisionService.DecideAsync(
                                new EntitlementDecisionRequest(
                                    userId.ToString(System.Globalization.CultureInfo.InvariantCulture),
                                    organizationId,
                                    FeatureKeys.PropertyManagement,
                                    RequestedQuantity: initialUnitCount,
                                    ResourceOrganizationId: organizationId),
                                token);
                            var denial = MapCreationDecisionDenial(decision);
                            if (denial is not null)
                            {
                                return EntitlementMutationOutcome<ServiceResponse<LoadPropertyDto>>.Rollback(denial);
                            }
                        }

                        var created = await _propertyRepository.AddProperty(propertyDto, token);
                        var createdUnits = new List<LoadUnitDto>();
                        if (initialUnitCount == 1 && propertyDto.PropertyType == Enums.EPropertyType.SingleFamily)
                        {
                            createdUnits.Add(await _unitRepository.AddUnit(
                                NewInitialUnit(1, created.Id), created.Id, organizationId, token));
                        }
                        else if (initialUnitCount > 0)
                        {
                            var bulk = new BulkCreateUnitsDto
                            {
                                PropertyId = created.Id,
                                Units = Enumerable.Range(1, initialUnitCount)
                                    .Select(number => NewInitialUnit(number, created.Id))
                                    .ToList()
                            };
                            createdUnits.AddRange(await _unitRepository.BulkCreateUnits(
                                bulk, organizationId, token));
                        }

                        created.Units = createdUnits;
                        if (_occurrenceRecorder is not null)
                            await _occurrenceRecorder.RecordAsync(new ActivationOccurrenceRequest(
                                organizationId, ActivationMilestones.PropertyAdded, $"property:{created.Id}",
                                DateTimeOffset.UtcNow, SourceEventType: "property",
                                SourceEventId: created.Id.ToString(System.Globalization.CultureInfo.InvariantCulture),
                                ActorUserId: userId), token);
                        return EntitlementMutationOutcome<ServiceResponse<LoadPropertyDto>>.Commit(
                            ServiceResponse<LoadPropertyDto>.CreateSuccess(
                                created, "Property added successfully"));
                    },
                    cancellationToken);

                var response = outcome.Value;
                // Blob I/O is deliberately after the serializable database transaction commits.
                if (outcome.MutationSucceeded && response.Success && files is { Count: > 0 })
                {
                    var imageResponse = await _imageService.AddImages(response.Data!.Id, files);
                    if (!imageResponse.Success)
                    {
                        return ServiceResponse<LoadPropertyDto>.CreateError(
                            "Image Upload Failed", imageResponse.Message);
                    }
                    response.Data.Images = imageResponse.Data;
                }

                return response;
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Property mutation is unavailable");
                return ServiceResponse<LoadPropertyDto>.CreateError(
                    "Property creation unavailable",
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    suppressDetailedErrors: true);
            }
        }

        private bool TryGetTrustedMutationScope(out long userId, out long organizationId)
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

        private static UpdateUnitDto NewInitialUnit(int number, long propertyId) => new()
        {
            Id = 0,
            Name = $"Unit {number}",
            PropertyId = propertyId,
            Bedrooms = "",
            Baths = "",
            Type = "",
            SquareFeet = 0,
            RentAmount = 0,
            IsOccupied = false,
            Amenities = [],
            IncludedUtility = []
        };

        private static ServiceResponse<LoadPropertyDto>? MapCreationDecisionDenial(
            UnifiedEntitlementDecision? decision)
        {
            if (decision is not null && decision.IsAllowed &&
                decision.Category == EntitlementDecisionCategory.Allowed)
            {
                return null;
            }

            if (decision is not null && !decision.IsAllowed &&
                decision.Category == EntitlementDecisionCategory.Upgrade)
            {
                return ServiceResponse<LoadPropertyDto>.CreateError(
                    "Unit limit reached",
                    "Upgrade your plan to add more units.",
                    statusCode: StatusCodes.Status403Forbidden,
                    suppressDetailedErrors: true);
            }

            if (decision is not null && !decision.IsAllowed &&
                decision.Category == EntitlementDecisionCategory.Unauthorized)
            {
                return Forbidden<LoadPropertyDto>();
            }

            return ServiceResponse<LoadPropertyDto>.CreateError(
                "Property creation unavailable",
                statusCode: StatusCodes.Status503ServiceUnavailable,
                suppressDetailedErrors: true);
        }

        private static ServiceResponse<LoadPropertyDto> DuplicatePropertyName(string name) =>
            ServiceResponse<LoadPropertyDto>.CreateError(
                "Duplicate Property Name",
                $"A property with the name '{name}' already exists in your organization. Please choose a different name.",
                "",
                StatusCodes.Status400BadRequest);

        private static ServiceResponse<T> Forbidden<T>() => ServiceResponse<T>.CreateError(
            "Forbidden",
            statusCode: StatusCodes.Status403Forbidden,
            suppressDetailedErrors: true);


        public async Task<ServiceResponse<LoadPropertyDto>> GetPropertyById(long propertyId)
        {
            try
            {
                if (!TryGetTrustedMutationScope(out _, out var organizationId))
                {
                    return Forbidden<LoadPropertyDto>();
                }

                var property = await _propertyRepository.GetPropertyById(propertyId, organizationId);

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
                if (!TryGetTrustedMutationScope(out _, out var organizationId))
                {
                    return Forbidden<LoadPropertyDto>();
                }

                var property = await _propertyRepository.GetPropertyByIdForMutationAsync(
                    propertyId, organizationId, CancellationToken.None);
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
                var deletedProperty = await _propertyRepository.DeleteProperty(
                    propertyId, organizationId, CancellationToken.None);

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
                if (!TryGetTrustedMutationScope(out _, out var organizationId))
                {
                    return Forbidden<LoadPropertyDto>();
                }

                var property = await _propertyRepository.GetPropertyByIdForMutationAsync(
                    propertyId, organizationId, CancellationToken.None);
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

                var inactivatedProperty = await _propertyRepository.InactivateProperty(
                    propertyId, organizationId, CancellationToken.None);

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
                if (!TryGetTrustedMutationScope(out var userId, out var organizationId))
                {
                    return Forbidden<LoadPropertyDto>();
                }

                var outcome = await _mutationCoordinator.ExecuteAsync(
                    organizationId,
                    async token =>
                    {
                        // Deleted records are intentionally queried only here, under trusted organization scope
                        // and inside the same serializable transaction as quota evaluation and restoration.
                        var property = await _propertyRepository.GetInactivePropertyByIdForMutationAsync(
                            propertyId, organizationId, token);
                        if (property is null)
                        {
                            return EntitlementMutationOutcome<ServiceResponse<LoadPropertyDto>>.Rollback(
                                PropertyNotFound());
                        }

                        var restoredUnitCount = property.Units?.Count ?? 0;
                        var decision = await _entitlementDecisionService.DecideAsync(
                            new EntitlementDecisionRequest(
                                userId.ToString(System.Globalization.CultureInfo.InvariantCulture),
                                organizationId,
                                FeatureKeys.PropertyManagement,
                                RequestedQuantity: restoredUnitCount,
                                ResourceOrganizationId: organizationId),
                            token);
                        var denial = MapCreationDecisionDenial(decision);
                        if (denial is not null)
                        {
                            return EntitlementMutationOutcome<ServiceResponse<LoadPropertyDto>>.Rollback(denial);
                        }

                        var reactivatedProperty = await _propertyRepository.ReactivateProperty(
                            propertyId, organizationId, token);
                        return EntitlementMutationOutcome<ServiceResponse<LoadPropertyDto>>.Commit(
                            ServiceResponse<LoadPropertyDto>.CreateSuccess(
                                reactivatedProperty, "Property reactivated successfully"));
                    });

                return outcome.Value;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reactivating property {PropertyId}", propertyId);
                return ServiceResponse<LoadPropertyDto>.CreateError(
                    "Property reactivation unavailable",
                    statusCode: StatusCodes.Status503ServiceUnavailable,
                    suppressDetailedErrors: true);
            }
        }

        private static ServiceResponse<LoadPropertyDto> PropertyNotFound() =>
            ServiceResponse<LoadPropertyDto>.CreateError(
                "Property not found", "The specified property does not exist.", "", StatusCodes.Status404NotFound);

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

