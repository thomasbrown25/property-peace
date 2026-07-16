using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using brownstone_hub_api.Dtos.File;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Files;
using brownstone_hub_api.Services.AzureBlobService;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.FileService
{
    public class FileService(
        BlobServiceClient blobServiceClient,
        IAzureBlobService azureBlobService,
        IFileRepository fileRepository,
        IHttpContextAccessor httpContextAccessor,
        ILogger<FileService> logger) : IFileService
    {
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly IFileRepository _fileRepository = fileRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly ILogger<FileService> _logger = logger;
        private const string ContainerName = "account-files";

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
            var userIdClaim = _httpContextAccessor.HttpContext?.User?.FindFirst("UserId");
            if (userIdClaim != null && long.TryParse(userIdClaim.Value, out var userId))
            {
                return userId;
            }
            return null;
        }

        public async Task<ServiceResponse<List<LoadFileDto>>> AddFiles(
            List<IFormFile> files,
            string? title,
            long? categoryId,
            long? propertyId,
            long? unitId,
            long? leaseId)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadFileDto>>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var userId = GetUserIdFromContext();

                var containerClient = _blobServiceClient.GetBlobContainerClient(ContainerName);
                await containerClient.CreateIfNotExistsAsync(PublicAccessType.None);

                var response = new ServiceResponse<List<LoadFileDto>>
                {
                    Data = []
                };

                foreach (var file in files)
                {
                    // Validate file
                    var validation = FileValidationHelper.ValidateDocumentFile(file);
                    if (!validation.IsValid)
                    {
                        _logger.LogWarning("File validation failed for {FileName}: {Error}", file.FileName, validation.ErrorMessage);
                        return ServiceResponse<List<LoadFileDto>>.CreateError(
                            $"File validation failed: {validation.ErrorMessage}",
                            $"The file '{file.FileName}' could not be uploaded. {validation.ErrorMessage}"
                        );
                    }

                    // Create unique blob name
                    var extension = Path.GetExtension(file.FileName);
                    var blobName = $"{Guid.NewGuid()}{extension}";
                    var blobClient = containerClient.GetBlobClient(blobName);

                    // Upload file
                    using (var stream = file.OpenReadStream())
                    {
                        await blobClient.UploadAsync(stream, new BlobHttpHeaders { ContentType = file.ContentType });
                    }

                    // Generate SAS URL
                    var blobUrl = _azureBlobService.GenerateBlobSasUri(
                        _blobServiceClient,
                        blobClient,
                        TimeSpan.FromHours(24) // 24 hour expiry for account files
                    );

                    // Create file record
                    var addFileDto = new AddFileDto
                    {
                        Title = title ?? Path.GetFileNameWithoutExtension(file.FileName),
                        FileName = file.FileName,
                        BlobName = blobName,
                        BlobUrl = blobUrl,
                        CategoryId = categoryId,
                        PropertyId = propertyId,
                        UnitId = unitId,
                        LeaseId = leaseId
                    };

                    var fileDto = await _fileRepository.AddFile(addFileDto, organizationId.Value, userId);
                    response.Data.Add(fileDto);
                }

                response.Message = $"Successfully uploaded {response.Data.Count} file(s)";
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding files");
                return ServiceResponse<List<LoadFileDto>>.CreateError(
                    "Error uploading files",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<LoadFileDto>> GetFileById(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadFileDto>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var file = await _fileRepository.GetFileById(id);
                if (file == null)
                {
                    return ServiceResponse<LoadFileDto>.CreateError(
                        "File not found",
                        $"File with ID {id} was not found.",
                        "",
                        404
                    );
                }

                if (file.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadFileDto>.CreateError(
                        "Access denied",
                        "You do not have access to this file.",
                        "",
                        403
                    );
                }

                return new ServiceResponse<LoadFileDto> { Data = file };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting file by ID {FileId}", id);
                return ServiceResponse<LoadFileDto>.CreateError(
                    "Error retrieving file",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<List<LoadFileDto>>> GetFiles(
            long? categoryId = null,
            long? propertyId = null,
            long? unitId = null,
            long? leaseId = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadFileDto>>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var files = await _fileRepository.GetFilesByOrganizationId(
                    organizationId.Value,
                    categoryId,
                    propertyId,
                    unitId,
                    leaseId,
                    startDate,
                    endDate
                );

                return new ServiceResponse<List<LoadFileDto>> { Data = files };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting files");
                return ServiceResponse<List<LoadFileDto>>.CreateError(
                    "Error retrieving files",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<LoadFileDto>> UpdateFile(long id, UpdateFileDto file)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<LoadFileDto>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var userId = GetUserIdFromContext();

                var existingFile = await _fileRepository.GetFileById(id);
                if (existingFile == null)
                {
                    return ServiceResponse<LoadFileDto>.CreateError(
                        "File not found",
                        $"File with ID {id} was not found.",
                        "",
                        404
                    );
                }

                if (existingFile.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<LoadFileDto>.CreateError(
                        "Access denied",
                        "You do not have access to this file.",
                        "",
                        403
                    );
                }

                var updatedFile = await _fileRepository.UpdateFile(id, file, userId);
                return new ServiceResponse<LoadFileDto> { Data = updatedFile, Message = "File updated successfully" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating file {FileId}", id);
                return ServiceResponse<LoadFileDto>.CreateError(
                    "Error updating file",
                    ex.Message
                );
            }
        }

        public async Task<ServiceResponse<bool>> DeleteFile(long id)
        {
            try
            {
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Organization not found",
                        "Unable to determine organization context."
                    );
                }

                var existingFile = await _fileRepository.GetFileById(id);
                if (existingFile == null)
                {
                    return ServiceResponse<bool>.CreateError(
                        "File not found",
                        $"File with ID {id} was not found.",
                        "",
                        404
                    );
                }

                if (existingFile.OrganizationId != organizationId.Value)
                {
                    return ServiceResponse<bool>.CreateError(
                        "Access denied",
                        "You do not have access to this file.",
                        "",
                        403
                    );
                }

                var deleted = await _fileRepository.DeleteFile(id);
                return new ServiceResponse<bool> { Data = deleted, Message = "File deleted successfully" };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting file {FileId}", id);
                return ServiceResponse<bool>.CreateError(
                    "Error deleting file",
                    ex.Message
                );
            }
        }
    }
}

