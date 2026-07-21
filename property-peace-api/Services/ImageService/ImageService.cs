

using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Images;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.StorageService;
using brownstone_hub_api.Dtos.Storage;
using System.Security.Claims;
using brownstone_hub_api.Shared;

namespace brownstone_hub_api.Services.ImageService
{
    public class ImageService<TEntity, TLoadDto, TAddDto> : IImageService<TEntity, TLoadDto, TAddDto>
    where TEntity : class, IImageEntity
    where TLoadDto : class
    where TAddDto : AddImageDto
    {
        private readonly BlobServiceClient _blobServiceClient;
        private readonly IAzureBlobService _azureBlobService;
        private readonly IImageRepository<TEntity, TLoadDto, TAddDto> _imageRepository;
        private readonly ILogger<ImageService<TEntity, TLoadDto, TAddDto>> _logger;
        private readonly IStorageService _storageService;
        private readonly IHttpContextAccessor _httpContextAccessor;
        private readonly string _containerName;

        public ImageService(
            BlobServiceClient blobServiceClient,
            IAzureBlobService azureBlobService,
            IImageRepository<TEntity, TLoadDto, TAddDto> imageRepository,
            ILogger<ImageService<TEntity, TLoadDto, TAddDto>> logger,
            IStorageService storageService,
            IHttpContextAccessor httpContextAccessor,
            string containerName)
        {
            _blobServiceClient = blobServiceClient;
            _azureBlobService = azureBlobService;
            _imageRepository = imageRepository;
            _logger = logger;
            _storageService = storageService;
            _httpContextAccessor = httpContextAccessor;
            _containerName = containerName.ToLowerInvariant();
        }

        public async Task<ServiceResponse<List<TLoadDto>>> AddImages(long refId, List<IFormFile> files)
        {
            var response = new ServiceResponse<List<TLoadDto>> { Data = new List<TLoadDto>() };

            try
            {
                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                foreach (var file in files)
                {
                    // Validate image file before processing
                    var validation = FileValidationHelper.ValidateImageFile(file);
                    if (!validation.IsValid)
                    {
                        _logger.LogWarning("Image validation failed for {FileName}: {Error}", file.FileName, validation.ErrorMessage);
                        return ServiceResponse<List<TLoadDto>>.CreateError(
                            $"Image validation failed: {validation.ErrorMessage}",
                            $"The image '{file.FileName}' could not be uploaded. {validation.ErrorMessage}"
                        );
                    }

                    // Create a unique blob name (use validated extension)
                    var extension = Path.GetExtension(file.FileName);
                    var blobName = $"{Guid.NewGuid()}{extension}";
                    var blobClient = containerClient.GetBlobClient(blobName);

                    using (var stream = file.OpenReadStream())
                    {
                        await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType });
                    }

                    var addDto = (TAddDto)Activator.CreateInstance(typeof(TAddDto))!;
                    addDto.RefId = refId;
                    addDto.BlobName = blobName;
                    addDto.BlobUrl = blobClient.Uri.ToString();

                    var result = await _imageRepository.AddImage(addDto);

                    // Generate SAS link
                    var sasUri = _azureBlobService.GenerateBlobSasUri(
                        _blobServiceClient,
                        blobClient,
                        TimeSpan.FromHours(1)
                    );

                    // Overwrite blob URL with SAS link
                    typeof(TLoadDto).GetProperty("BlobUrl")?.SetValue(result, sasUri);

                    await TrackUploadedImageAsync(refId, file, blobName, blobClient.Uri.ToString());

                    response.Data.Add(result);
                }

                response.Message = $"Uploaded {files.Count} image(s) to {_containerName}.";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error uploading images to Azure Blob Storage for {Container}", _containerName);
                return ServiceResponse<List<TLoadDto>>.CreateError("Error uploading images", ex.Message);
            }

            return response;
        }


        private async Task TrackUploadedImageAsync(long refId, IFormFile file, string blobName, string blobUrl)
        {
            try
            {
                var httpContext = _httpContextAccessor.HttpContext;
                long? organizationId = null;
                if (httpContext?.Items.TryGetValue("OrganizationId", out var orgIdObj) == true && orgIdObj is long orgId)
                {
                    organizationId = orgId;
                }

                long? userId = null;
                var userIdClaim = httpContext?.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? httpContext?.User?.FindFirst("userId")?.Value;
                if (!string.IsNullOrWhiteSpace(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
                {
                    userId = parsedUserId;
                }

                await _storageService.TrackAsync(new TrackStorageObjectRequest
                {
                    OrganizationId = organizationId,
                    UploadedByUserId = userId,
                    OwnerUserId = userId,
                    Category = GetStorageCategory(),
                    EntityType = typeof(TEntity).Name,
                    EntityId = refId,
                    FileName = file.FileName,
                    BlobContainer = _containerName,
                    BlobName = blobName,
                    BlobUrl = blobUrl,
                    ContentType = file.ContentType,
                    SizeBytes = file.Length,
                    Source = "ImageUpload"
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Image uploaded but storage tracking failed for blob {BlobName}", blobName);
            }
        }

        private string GetStorageCategory()
        {
            return _containerName switch
            {
                "property-images" => "PropertyImage",
                "listing-images" => "ListingPhoto",
                "maintenance-images" => "MaintenanceAttachment",
                "expense-receipts" => "Receipt",
                _ => "Image"
            };
        }

        public async Task<ServiceResponse<List<TLoadDto>>> GetImagesByRefId(long refId)
        {
            try
            {
                var images = await _imageRepository.GetImagesByRefId(refId);
                
                // Generate fresh SAS URLs for each image
                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                foreach (var image in images)
                {
                    var blobName = (string?)typeof(TLoadDto).GetProperty("BlobName")?.GetValue(image);
                    if (!string.IsNullOrEmpty(blobName))
                    {
                        var blobClient = containerClient.GetBlobClient(blobName);
                        var sasUri = _azureBlobService.GenerateBlobSasUri(
                            _blobServiceClient,
                            blobClient,
                            TimeSpan.FromHours(1)
                        );
                        typeof(TLoadDto).GetProperty("BlobUrl")?.SetValue(image, sasUri);
                    }
                }
                
                return new ServiceResponse<List<TLoadDto>>
                {
                    Data = images,
                    Message = $"Retrieved {images.Count} image(s) for reference ID {refId}."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving images for RefId {RefId}", refId);
                return ServiceResponse<List<TLoadDto>>.CreateError("Error retrieving images", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> SetCoverPhoto(long refId, long imageId)
        {
            try
            {
                await _imageRepository.SetCoverPhoto(refId, imageId);
                return new ServiceResponse<bool> { Data = true, Message = "Cover photo updated." };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting cover photo for RefId {RefId}, ImageId {ImageId}", refId, imageId);
                return ServiceResponse<bool>.CreateError("Error setting cover photo", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteImage(string blobName)
        {
            try
            {
                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                var blobClient = containerClient.GetBlobClient(blobName);
                await blobClient.DeleteIfExistsAsync();

                return new ServiceResponse<bool>
                {
                    Data = true,
                    Message = "Image deleted successfully."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting blob {BlobName}", blobName);
                return ServiceResponse<bool>.CreateError("Error deleting image", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteImageById(long id)
        {
            try
            {
                // Get the image from repository to get the blob name
                var deletedImage = await _imageRepository.DeleteImage(id);
                
                // Get blob name from the deleted image
                var blobName = (string?)typeof(TLoadDto).GetProperty("BlobName")?.GetValue(deletedImage);
                
                if (string.IsNullOrEmpty(blobName))
                {
                    return ServiceResponse<bool>.CreateError("Image not found or blob name missing", "Could not retrieve blob name for deletion");
                }

                // Delete from Azure Blob Storage
                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
                var blobClient = containerClient.GetBlobClient(blobName);
                await blobClient.DeleteIfExistsAsync();

                return new ServiceResponse<bool>
                {
                    Data = true,
                    Message = "Image deleted successfully."
                };
            }
            catch (KeyNotFoundException)
            {
                return ServiceResponse<bool>.CreateError("Image not found", "The specified image does not exist");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting image with ID {Id}", id);
                return ServiceResponse<bool>.CreateError("Error deleting image", ex.Message);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteImagesByRefId(long refId)
        {
            try
            {
                var images = await _imageRepository.GetImagesByRefId(refId);

                if (images == null || !images.Any())
                {
                    return new ServiceResponse<bool>
                    {
                        Data = false,
                        Message = $"No images found for reference ID {refId}."
                    };
                }

                var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);

                foreach (var img in images)
                {
                    var blobName = (string?)typeof(TLoadDto).GetProperty("BlobName")?.GetValue(img);
                    if (!string.IsNullOrEmpty(blobName))
                    {
                        var blobClient = containerClient.GetBlobClient(blobName);
                        await blobClient.DeleteIfExistsAsync();
                    }
                }

                await _imageRepository.DeleteImagesByRefId(refId);

                return new ServiceResponse<bool>
                {
                    Data = true,
                    Message = $"Deleted {images.Count} image(s) for reference ID {refId}."
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting images for RefId {RefId}", refId);
                return ServiceResponse<bool>.CreateError("Error deleting images", ex.Message);
            }
        }

    }
}