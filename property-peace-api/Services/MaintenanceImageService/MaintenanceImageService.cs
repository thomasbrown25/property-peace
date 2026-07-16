using Azure.Storage;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using brownstone_hub_api.Dtos.MaintenanceImage;
using brownstone_hub_api.Repositories.MaintenanceImages;
using brownstone_hub_api.Services.AzureBlobService;

namespace brownstone_hub_api.Services.MaintenanceImageService
{
  public class MaintenanceImageService(
    BlobServiceClient blobServiceClient,
    IAzureBlobService azureBlobService,
    IMaintenanceImageRepository maintenanceImageRepository,
     IConfiguration configuration,
    ILogger<MaintenanceImageService> logger) : IMaintenanceImageService
  {
    private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
    private readonly IAzureBlobService _azureBlobService = azureBlobService;
    private readonly IMaintenanceImageRepository _maintenanceImageRepository = maintenanceImageRepository;
    private readonly IConfiguration _configuration = configuration;
    private readonly ILogger<MaintenanceImageService> _logger = logger;

    public async Task<ServiceResponse<List<LoadMaintenanceImageDto>>> AddMaintenanceImages(long maintenanceRequestId, List<IFormFile> files)
    {

      try
      {
        var response = new ServiceResponse<List<LoadMaintenanceImageDto>>
        {
          Data = []
        };

        var sasUri = string.Empty;
        var containerClient = _blobServiceClient.GetBlobContainerClient("maintenance-images");

        await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

        foreach (var image in files)
        {
          // Create a unique blob name
          var blobName = $"{Guid.NewGuid()}{Path.GetExtension(image.FileName)}";
          var blobClient = containerClient.GetBlobClient(blobName);

          // Upload the file
          using (var stream = image.OpenReadStream())
          {
            await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = image.ContentType });
          }

          var maintenanceImage = new AddMaintenanceImageDto
          {
            MaintenanceRequestId = maintenanceRequestId,
            BlobName = blobName,
            BlobUrl = blobClient.Uri.ToString()
          };

          // Save the maintenance image details to the database
          var result = await _maintenanceImageRepository.AddMaintenanceImage(maintenanceImage);

          // Generate a read-only SAS URI valid for 1 hour
          sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
          result.BlobUrl = sasUri;
          response.Data.Add(result);
        }

        response.Message = "Maintenance images uploaded successfully";
        return response;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error uploading image to Azure Blob Storage");
        return ServiceResponse<List<LoadMaintenanceImageDto>>.CreateError("Error uploading image", ex.Message, ex.InnerException?.Message);
      }

    }

    public async Task<ServiceResponse<List<LoadMaintenanceImageDto>>> GetMaintenanceImages(long maintenanceRequestId)
    {
      try
      {
        var response = new ServiceResponse<List<LoadMaintenanceImageDto>>
        {
          Data = []
        };

        // Get images from the database
        var images = await _maintenanceImageRepository.GetMaintenanceImagesByRequestId(maintenanceRequestId);
        if (images == null || images.Count == 0)
        {
          response.Message = "No images found for this maintenance request";
          return response;
        }

        // Generate SAS URLs for each image
        foreach (var image in images)
        {
          var blobClient = _blobServiceClient.GetBlobContainerClient("maintenance-images").GetBlobClient(image.BlobName);
          var sasUri = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromHours(1));
          image.BlobUrl = sasUri;
          response.Data.Add(image);
        }

        response.Message = "Maintenance images retrieved successfully";
        return response;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error retrieving maintenance images");
        return ServiceResponse<List<LoadMaintenanceImageDto>>.CreateError("Error retrieving maintenance images", ex.Message, ex.InnerException?.Message);
      }
    }


    public async Task<ServiceResponse<LoadMaintenanceImageDto>> DeleteMaintenanceImage(long id)
    {
      try
      {
        var response = new ServiceResponse<LoadMaintenanceImageDto>();

        // Delete the image from the database
        var deletedImage = await _maintenanceImageRepository.DeleteMaintenanceImage(id);
        if (deletedImage == null)
        {
          response.Message = "Image not found";
          return response;
        }

        // Delete the image from Azure Blob Storage
        var blobClient = _blobServiceClient.GetBlobContainerClient("maintenance-images").GetBlobClient(deletedImage.BlobName);
        await blobClient.DeleteIfExistsAsync();

        response.Data = deletedImage;
        response.Message = "Maintenance image deleted successfully";
        return response;
      }
      catch (Exception ex)
      {
        _logger.LogError(ex, "Error deleting maintenance image");
        return ServiceResponse<LoadMaintenanceImageDto>.CreateError("Error deleting maintenance image", ex.Message, ex.InnerException?.Message);
      }
    }


  }
}