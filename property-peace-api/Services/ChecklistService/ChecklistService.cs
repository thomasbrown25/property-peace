using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Checklists;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.AzureBlobService;
using Microsoft.AspNetCore.Http;
using System.Text.Json;

namespace brownstone_hub_api.Services.ChecklistService
{
    public class ChecklistService(
        IChecklistRepository checklistRepository,
        IUserRepository userRepository,
        IHttpContextAccessor httpContextAccessor,
        BlobServiceClient blobServiceClient,
        IAzureBlobService azureBlobService,
        IOrganizationChecklistItemRepository organizationChecklistItemRepository,
        ILogger<ChecklistService> logger) : IChecklistService
    {
        private readonly IChecklistRepository _checklistRepository = checklistRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly IOrganizationChecklistItemRepository _organizationChecklistItemRepository = organizationChecklistItemRepository;
        private readonly ILogger<ChecklistService> _logger = logger;
        private const string ContainerName = "checklist-images";

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

        private LoadChecklistDto GenerateSasUrlsForChecklist(LoadChecklistDto checklist)
        {
            if (checklist == null) return checklist;

            var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);

            // Generate SAS URLs for before move-in images
            if (checklist.BeforeMoveInImagesBlobNames != null && checklist.BeforeMoveInImagesBlobNames.Any())
            {
                checklist.BeforeMoveInImagesUrls = checklist.BeforeMoveInImagesBlobNames
                    .Select(blobName =>
                    {
                        try
                        {
                            var blobClient = containerClient.GetBlobClient(blobName);
                            return _azureBlobService.GenerateBlobSasUri(
                                _blobServiceClient,
                                blobClient,
                                TimeSpan.FromHours(1)
                            );
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to generate SAS URL for blob {BlobName}", blobName);
                            return null;
                        }
                    })
                    .Where(url => url != null)
                    .ToList()!;
            }

            // Generate SAS URLs for after move-out images
            if (checklist.AfterMoveOutImagesBlobNames != null && checklist.AfterMoveOutImagesBlobNames.Any())
            {
                checklist.AfterMoveOutImagesUrls = checklist.AfterMoveOutImagesBlobNames
                    .Select(blobName =>
                    {
                        try
                        {
                            var blobClient = containerClient.GetBlobClient(blobName);
                            return _azureBlobService.GenerateBlobSasUri(
                                _blobServiceClient,
                                blobClient,
                                TimeSpan.FromHours(1)
                            );
                        }
                        catch (Exception ex)
                        {
                            _logger.LogWarning(ex, "Failed to generate SAS URL for blob {BlobName}", blobName);
                            return null;
                        }
                    })
                    .Where(url => url != null)
                    .ToList()!;
            }

            // Generate SAS URLs for per-item photo arrays
            if (checklist.Items != null)
            {
                foreach (var item in checklist.Items)
                {
                    if (item.PhotoBlobNames != null && item.PhotoBlobNames.Any())
                    {
                        item.PhotoBlobUrls = item.PhotoBlobNames.Select(blobName =>
                        {
                            try
                            {
                                var blobClient = containerClient.GetBlobClient(blobName);
                                return _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
                            }
                            catch (Exception ex)
                            {
                                _logger.LogWarning(ex, "Failed to generate SAS URL for item photo {BlobName}", blobName);
                                return null;
                            }
                        }).Where(url => url != null).ToList()!;
                    }
                }
            }

            return checklist;
        }

        public async Task<ServiceResponse<LoadChecklistDto>> AddChecklist(AddChecklistDto checklist)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadChecklistDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var organizationId = GetOrganizationIdFromContext();
                var result = await _checklistRepository.AddChecklist(checklist, landlordId.Value, organizationId);

                // Verify landlord owns this checklist
                if (result.LandlordId != landlordId.Value)
                {
                    return new ServiceResponse<LoadChecklistDto>
                    {
                        Success = false,
                        Message = "Unauthorized access to checklist"
                    };
                }

                return new ServiceResponse<LoadChecklistDto>
                {
                    Success = true,
                    Data = result,
                    Message = "Checklist created successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding checklist");
                return ServiceResponse<LoadChecklistDto>.CreateError("An error occurred while creating the checklist", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadChecklistDto>> GetChecklistById(long id)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadChecklistDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var checklist = await _checklistRepository.GetChecklistById(id);

                if (checklist == null)
                {
                    return new ServiceResponse<LoadChecklistDto>
                    {
                        Success = false,
                        Message = "Checklist not found"
                    };
                }

                // Generate SAS URLs for images
                checklist = GenerateSasUrlsForChecklist(checklist);

                return new ServiceResponse<LoadChecklistDto>
                {
                    Success = true,
                    Data = checklist
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklist");
                return ServiceResponse<LoadChecklistDto>.CreateError("An error occurred while retrieving the checklist", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByLandlordId(long landlordId)
        {
            try
            {
                // Validate that the passed landlordId matches the authenticated user
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    return ServiceResponse<List<LoadChecklistDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                if (currentUserId.Value != landlordId)
                {
                    return ServiceResponse<List<LoadChecklistDto>>.CreateError("Unauthorized access", "You can only access your own checklists", "", 403);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadChecklistDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var checklists = await _checklistRepository.GetChecklistsByOrganizationId(organizationId.Value);

                // Generate SAS URLs for images in each checklist
                var checklistsWithSasUrls = checklists.Select(GenerateSasUrlsForChecklist).ToList();

                return new ServiceResponse<List<LoadChecklistDto>>
                {
                    Success = true,
                    Data = checklistsWithSasUrls
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists");
                return ServiceResponse<List<LoadChecklistDto>>.CreateError("An error occurred while retrieving checklists", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByPropertyId(long propertyId)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadChecklistDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var checklists = await _checklistRepository.GetChecklistsByPropertyId(propertyId);

                // Generate SAS URLs for images in each checklist
                var checklistsWithSasUrls = checklists.Select(GenerateSasUrlsForChecklist).ToList();

                return new ServiceResponse<List<LoadChecklistDto>>
                {
                    Success = true,
                    Data = checklistsWithSasUrls
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists by property");
                return ServiceResponse<List<LoadChecklistDto>>.CreateError("An error occurred while retrieving checklists", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByUnitId(long unitId)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadChecklistDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var checklists = await _checklistRepository.GetChecklistsByUnitId(unitId);

                // Generate SAS URLs for images in each checklist
                var checklistsWithSasUrls = checklists.Select(GenerateSasUrlsForChecklist).ToList();

                return new ServiceResponse<List<LoadChecklistDto>>
                {
                    Success = true,
                    Data = checklistsWithSasUrls
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists by unit");
                return ServiceResponse<List<LoadChecklistDto>>.CreateError("An error occurred while retrieving checklists", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByLeaseId(long leaseId)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadChecklistDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var checklists = await _checklistRepository.GetChecklistsByLeaseId(leaseId);

                // Generate SAS URLs for images in each checklist
                var checklistsWithSasUrls = checklists.Select(GenerateSasUrlsForChecklist).ToList();

                return new ServiceResponse<List<LoadChecklistDto>>
                {
                    Success = true,
                    Data = checklistsWithSasUrls
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists by lease");
                return ServiceResponse<List<LoadChecklistDto>>.CreateError("An error occurred while retrieving checklists", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadChecklistDto>>> GetChecklistsByType(ETenantDocumentType checklistType)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadChecklistDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadChecklistDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var checklists = await _checklistRepository.GetChecklistsByTypeAndOrganizationId(organizationId.Value, checklistType);

                return new ServiceResponse<List<LoadChecklistDto>>
                {
                    Success = true,
                    Data = checklists
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving checklists by type");
                return ServiceResponse<List<LoadChecklistDto>>.CreateError("An error occurred while retrieving checklists", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadChecklistDto>> UpdateChecklist(UpdateChecklistDto checklist)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadChecklistDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Verify checklist exists
                var existing = await _checklistRepository.GetChecklistById(checklist.Id);
                if (existing == null)
                {
                    return new ServiceResponse<LoadChecklistDto>
                    {
                        Success = false,
                        Message = "Checklist not found"
                    };
                }

                var result = await _checklistRepository.UpdateChecklist(checklist);

                return new ServiceResponse<LoadChecklistDto>
                {
                    Success = true,
                    Data = result,
                    Message = "Checklist updated successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating checklist");
                return ServiceResponse<LoadChecklistDto>.CreateError("An error occurred while updating the checklist", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteChecklist(long id)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Verify landlord owns this checklist
                var existing = await _checklistRepository.GetChecklistById(id);
                if (existing == null)
                {
                    return new ServiceResponse<bool>
                    {
                        Success = false,
                        Message = "Checklist not found"
                    };
                }

                if (existing.LandlordId != landlordId.Value)
                {
                    return new ServiceResponse<bool>
                    {
                        Success = false,
                        Message = "Unauthorized access to checklist"
                    };
                }

                var result = await _checklistRepository.DeleteChecklist(id);

                return new ServiceResponse<bool>
                {
                    Success = result,
                    Data = result,
                    Message = result ? "Checklist deleted successfully" : "Failed to delete checklist"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting checklist");
                return ServiceResponse<bool>.CreateError("An error occurred while deleting the checklist", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadChecklistDto>> UploadChecklistImages(long checklistId, List<IFormFile> files, bool isBeforeMoveIn)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadChecklistDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Get the checklist
                var checklist = await _checklistRepository.GetChecklistById(checklistId);
                if (checklist == null)
                {
                    return ServiceResponse<LoadChecklistDto>.CreateError("Checklist not found", "The checklist does not exist", "", 404);
                }

                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                var uploadedBlobNames = new List<string>();
                var uploadedUrls = new List<string>();

                foreach (var file in files)
                {
                    // Validate image file
                    var validation = FileValidationHelper.ValidateImageFile(file);
                    if (!validation.IsValid)
                    {
                        _logger.LogWarning("Image validation failed for {FileName}: {Error}", file.FileName, validation.ErrorMessage);
                        return ServiceResponse<LoadChecklistDto>.CreateError(
                            $"Image validation failed: {validation.ErrorMessage}",
                            $"The image '{file.FileName}' could not be uploaded. {validation.ErrorMessage}"
                        );
                    }

                    // Create a unique blob name
                    var extension = Path.GetExtension(file.FileName);
                    var blobName = $"{Guid.NewGuid()}{extension}";
                    var blobClient = containerClient.GetBlobClient(blobName);

                    // Upload the file
                    using (var stream = file.OpenReadStream())
                    {
                        await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType });
                    }

                    // Store permanent blob URL (SAS URLs will be generated on retrieval)
                    uploadedBlobNames.Add(blobName);
                    uploadedUrls.Add(blobClient.Uri.ToString());
                }

                // Update checklist with new images
                var updateDto = new UpdateChecklistDto
                {
                    Id = checklistId
                };

                if (isBeforeMoveIn)
                {
                    var existingBlobNames = checklist.BeforeMoveInImagesBlobNames ?? new List<string>();
                    var existingUrls = checklist.BeforeMoveInImagesUrls ?? new List<string>();

                    updateDto.BeforeMoveInImagesBlobNames = existingBlobNames.Concat(uploadedBlobNames).ToList();
                    updateDto.BeforeMoveInImagesUrls = existingUrls.Concat(uploadedUrls).ToList();
                }
                else
                {
                    var existingBlobNames = checklist.AfterMoveOutImagesBlobNames ?? new List<string>();
                    var existingUrls = checklist.AfterMoveOutImagesUrls ?? new List<string>();

                    updateDto.AfterMoveOutImagesBlobNames = existingBlobNames.Concat(uploadedBlobNames).ToList();
                    updateDto.AfterMoveOutImagesUrls = existingUrls.Concat(uploadedUrls).ToList();
                }

                var result = await UpdateChecklist(updateDto);

                // Generate SAS URLs for the returned checklist
                if (result.Success && result.Data != null)
                {
                    result.Data = GenerateSasUrlsForChecklist(result.Data);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading checklist images");
                return ServiceResponse<LoadChecklistDto>.CreateError("An error occurred while uploading images", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadChecklistDto>> DeleteChecklistItemImage(long checklistId, long itemId, string blobName)
        {
            try
            {
                // Delete from blob storage
                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                var blobClient = containerClient.GetBlobClient(blobName);
                await blobClient.DeleteIfExistsAsync();

                var result = await _checklistRepository.DeleteChecklistItemPhoto(checklistId, itemId, blobName);
                var dto = GenerateSasUrlsForChecklist(result);
                return new ServiceResponse<LoadChecklistDto> { Success = true, Data = dto };
            }
            catch (KeyNotFoundException ex)
            {
                return ServiceResponse<LoadChecklistDto>.CreateError(ex.Message, ex.Message, "", 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting image {BlobName} from item {ItemId} in checklist {ChecklistId}", blobName, itemId, checklistId);
                return ServiceResponse<LoadChecklistDto>.CreateError("An error occurred while deleting the item image", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadChecklistDto>> DeleteChecklistImage(long checklistId, string blobName, bool isBeforeMoveIn)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadChecklistDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Get the checklist
                var checklist = await _checklistRepository.GetChecklistById(checklistId);
                if (checklist == null)
                {
                    return ServiceResponse<LoadChecklistDto>.CreateError("Checklist not found", "The checklist does not exist", "", 404);
                }

                // Delete the blob from Azure Storage
                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                var blobClient = containerClient.GetBlobClient(blobName);
                await blobClient.DeleteIfExistsAsync();

                // Remove the blob name and URL from the checklist
                var updateDto = new UpdateChecklistDto
                {
                    Id = checklistId
                };

                if (isBeforeMoveIn)
                {
                    var blobNames = checklist.BeforeMoveInImagesBlobNames ?? new List<string>();
                    var urls = checklist.BeforeMoveInImagesUrls ?? new List<string>();
                    
                    var blobIndex = blobNames.IndexOf(blobName);
                    if (blobIndex >= 0)
                    {
                        blobNames.RemoveAt(blobIndex);
                        if (urls.Count > blobIndex)
                        {
                            urls.RemoveAt(blobIndex);
                        }
                    }

                    updateDto.BeforeMoveInImagesBlobNames = blobNames;
                    updateDto.BeforeMoveInImagesUrls = urls;
                }
                else
                {
                    var blobNames = checklist.AfterMoveOutImagesBlobNames ?? new List<string>();
                    var urls = checklist.AfterMoveOutImagesUrls ?? new List<string>();
                    
                    var blobIndex = blobNames.IndexOf(blobName);
                    if (blobIndex >= 0)
                    {
                        blobNames.RemoveAt(blobIndex);
                        if (urls.Count > blobIndex)
                        {
                            urls.RemoveAt(blobIndex);
                        }
                    }

                    updateDto.AfterMoveOutImagesBlobNames = blobNames;
                    updateDto.AfterMoveOutImagesUrls = urls;
                }

                var result = await UpdateChecklist(updateDto);

                // Generate SAS URLs for the returned checklist
                if (result.Success && result.Data != null)
                {
                    result.Data = GenerateSasUrlsForChecklist(result.Data);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting checklist image");
                return ServiceResponse<LoadChecklistDto>.CreateError("An error occurred while deleting the image", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadChecklistDto>> UploadChecklistItemImage(long checklistId, long itemId, IFormFile file)
        {
            try
            {
                var validation = FileValidationHelper.ValidateImageFile(file);
                if (!validation.IsValid)
                {
                    return ServiceResponse<LoadChecklistDto>.CreateError(
                        $"Image validation failed: {validation.ErrorMessage}",
                        $"The image '{file.FileName}' could not be uploaded. {validation.ErrorMessage}"
                    );
                }

                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                var extension = Path.GetExtension(file.FileName);
                var blobName = $"item-{itemId}-{Guid.NewGuid()}{extension}";
                var blobClient = containerClient.GetBlobClient(blobName);

                using (var stream = file.OpenReadStream())
                {
                    await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType });
                }

                var blobUrl = blobClient.Uri.ToString();
                var result = await _checklistRepository.UpdateChecklistItemPhoto(checklistId, itemId, blobName, blobUrl);
                var dto = GenerateSasUrlsForChecklist(result);

                return new ServiceResponse<LoadChecklistDto> { Success = true, Data = dto };
            }
            catch (KeyNotFoundException ex)
            {
                return ServiceResponse<LoadChecklistDto>.CreateError(ex.Message, ex.Message, "", 404);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading image for item {ItemId} in checklist {ChecklistId}", itemId, checklistId);
                return ServiceResponse<LoadChecklistDto>.CreateError("An error occurred while uploading the item image", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> CreateDefaultChecklistsForProperty(long propertyId, long landlordId, long organizationId)
        {
            try
            {
                // Get organization checklist items (templates)
                var orgItems = await _organizationChecklistItemRepository.GetOrganizationChecklistItemsByOrganizationId(organizationId);

                if (orgItems == null || orgItems.Count == 0)
                {
                    // Seed default items if none exist
                    await _organizationChecklistItemRepository.SeedDefaultChecklistItems(organizationId);
                    orgItems = await _organizationChecklistItemRepository.GetOrganizationChecklistItemsByOrganizationId(organizationId);
                }

                // Convert organization items to checklist items
                var checklistItems = orgItems.Select((item, index) => new AddChecklistItemDto
                {
                    Name = item.Name,
                    Description = item.Description,
                    Category = item.Category,
                    SortOrder = item.SortOrder
                }).ToList();

                // Create Move-In Checklist
                var moveInChecklist = new AddChecklistDto
                {
                    ChecklistType = ETenantDocumentType.MoveInChecklist,
                    PropertyId = propertyId,
                    UnitId = null, // Property-level, not unit-specific
                    Title = "Default Move-In Checklist",

                    Items = checklistItems
                };

                await _checklistRepository.AddChecklist(moveInChecklist, landlordId, organizationId);

                // Create Move-Out Checklist
                var moveOutChecklist = new AddChecklistDto
                {
                    ChecklistType = ETenantDocumentType.MoveOutChecklist,
                    PropertyId = propertyId,
                    UnitId = null, // Property-level, not unit-specific
                    Title = "Default Move-Out Checklist",

                    Items = checklistItems
                };

                await _checklistRepository.AddChecklist(moveOutChecklist, landlordId, organizationId);

                return new ServiceResponse<bool>
                {
                    Success = true,
                    Data = true,
                    Message = "Default checklists created successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating default checklists for property {PropertyId}", propertyId);
                return ServiceResponse<bool>.CreateError("An error occurred while creating default checklists", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> CreateDefaultChecklistsForUnit(long unitId, long propertyId, long landlordId, long organizationId, string? unitName = null)
        {
            try
            {
                // Get organization checklist items (templates)
                var orgItems = await _organizationChecklistItemRepository.GetOrganizationChecklistItemsByOrganizationId(organizationId);

                if (orgItems == null || orgItems.Count == 0)
                {
                    // Seed default items if none exist
                    await _organizationChecklistItemRepository.SeedDefaultChecklistItems(organizationId);
                    orgItems = await _organizationChecklistItemRepository.GetOrganizationChecklistItemsByOrganizationId(organizationId);
                }

                // Convert organization items to checklist items
                var checklistItems = orgItems.Select((item, index) => new AddChecklistItemDto
                {
                    Name = item.Name,
                    Description = item.Description,
                    Category = item.Category,
                    SortOrder = item.SortOrder
                }).ToList();

                var unitDisplayName = unitName ?? $"Unit {unitId}";

                // Create Move-In Checklist for the unit
                var moveInChecklist = new AddChecklistDto
                {
                    ChecklistType = ETenantDocumentType.MoveInChecklist,
                    PropertyId = propertyId,
                    UnitId = unitId, // Unit-specific
                    Title = $"{unitDisplayName} - Move-In Checklist",

                    Items = checklistItems
                };

                await _checklistRepository.AddChecklist(moveInChecklist, landlordId, organizationId);

                // Create Move-Out Checklist for the unit
                var moveOutChecklist = new AddChecklistDto
                {
                    ChecklistType = ETenantDocumentType.MoveOutChecklist,
                    PropertyId = propertyId,
                    UnitId = unitId, // Unit-specific
                    Title = $"{unitDisplayName} - Move-Out Checklist",

                    Items = checklistItems
                };

                await _checklistRepository.AddChecklist(moveOutChecklist, landlordId, organizationId);

                return new ServiceResponse<bool>
                {
                    Success = true,
                    Data = true,
                    Message = "Default checklists created successfully for unit"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating default checklists for unit {UnitId}", unitId);
                return ServiceResponse<bool>.CreateError("An error occurred while creating default checklists", ex.Message);
            }
        }
    }
}

