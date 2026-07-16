using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Listings;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.ApplicationPdfService;
using brownstone_hub_api.Services.NotificationService;
using Azure.Storage.Blobs;
using brownstone_hub_api.Services.AzureBlobService;
using Microsoft.AspNetCore.Http;

namespace brownstone_hub_api.Services.ApplicationService
{
    public class ApplicationService(
        IApplicationRepository applicationRepository,
        IUserRepository userRepository,
        IApplicationPdfService applicationPdfService,
        BlobServiceClient blobServiceClient,
        IAzureBlobService azureBlobService,
        INotificationService notificationService,
        IHttpContextAccessor httpContextAccessor,
        IListingRepository listingRepository,
        ILogger<ApplicationService> logger) : IApplicationService
    {
        private readonly IApplicationRepository _applicationRepository = applicationRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly IApplicationPdfService _applicationPdfService = applicationPdfService;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly INotificationService _notificationService = notificationService;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly IListingRepository _listingRepository = listingRepository;
        private readonly ILogger<ApplicationService> _logger = logger;

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

        public async Task<ServiceResponse<LoadRentalApplicationDto>> AddApplication(AddRentalApplicationDto application)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var organizationId = GetOrganizationIdFromContext();
                var result = await _applicationRepository.AddApplication(application, landlordId.Value, organizationId);
                
                // Generate PDF if application is submitted
                if (application.Status == EApplicationStatus.Submitted)
                {
                    await GenerateAndSaveApplicationPdfAsync(result.Id);
                    // Reload to get PDF fields
                    result = await _applicationRepository.GetApplicationById(result.Id) ?? result;
                    
                    // Send notification to landlord when application is completed
                    await SendApplicationCompletionNotificationAsync(result, landlordId.Value);
                }
                
                return new ServiceResponse<LoadRentalApplicationDto>
                {
                    Success = true,
                    Data = result,
                    Message = "Application created successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding application");
                return ServiceResponse<LoadRentalApplicationDto>.CreateError("An error occurred while creating the application", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadRentalApplicationDto>> GetApplicationById(long id)
        {
            try
            {
                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser == null)
                {
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var application = await _applicationRepository.GetApplicationById(id);
                
                if (application == null)
                {
                    return new ServiceResponse<LoadRentalApplicationDto>
                    {
                        Success = false,
                        Message = "Application not found"
                    };
                }

                var isTenant = currentUser.Roles?.Any(r => r.ToLower() == "tenant") ?? false;
                var isLandlordOrAdmin = currentUser.Roles?.Any(r => r.ToLower() == "landlord" || r.ToLower() == "admin") ?? false;

                if (isTenant)
                {
                    // Tenant can only access applications with their email
                    if (!string.IsNullOrEmpty(currentUser.Email) && application.Email.ToLower() != currentUser.Email.ToLower())
                    {
                        return ServiceResponse<LoadRentalApplicationDto>.CreateError("Unauthorized", "You can only access your own applications", "", 403);
                    }
                }
                else if (isLandlordOrAdmin)
                {
                    // Landlord/Admin must own the application
                    if (application.LandlordId != currentUser.Id)
                    {
                        return ServiceResponse<LoadRentalApplicationDto>.CreateError("Unauthorized", "Unauthorized access to application", "", 403);
                    }
                }
                else
                {
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("Unauthorized", "User does not have permission to view applications", "", 403);
                }

                return new ServiceResponse<LoadRentalApplicationDto>
                {
                    Success = true,
                    Data = application
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving application");
                return ServiceResponse<LoadRentalApplicationDto>.CreateError("An error occurred while retrieving the application", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadRentalApplicationDto>>> GetApplicationsByLandlordId(long landlordId)
        {
            try
            {
                // Validate that the passed landlordId matches the authenticated user
                var currentUserId = await GetCurrentUserIdAsync();
                if (!currentUserId.HasValue)
                {
                    return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                if (currentUserId.Value != landlordId)
                {
                    return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("Unauthorized access", "You can only access your own applications", "", 403);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var applications = await _applicationRepository.GetApplicationsByOrganizationId(organizationId.Value);
                
                return new ServiceResponse<List<LoadRentalApplicationDto>>
                {
                    Success = true,
                    Data = applications
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving applications");
                return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("An error occurred while retrieving applications", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadRentalApplicationDto>>> GetApplicationsByPropertyId(long propertyId)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Get organization ID from context
                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var applications = await _applicationRepository.GetApplicationsByPropertyId(propertyId);
                
                // Filter by organization and landlord to ensure security
                var filteredApplications = applications
                    .Where(a => a.LandlordId == landlordId.Value && a.OrganizationId == organizationId.Value)
                    .ToList();
                
                return new ServiceResponse<List<LoadRentalApplicationDto>>
                {
                    Success = true,
                    Data = filteredApplications
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving applications by property");
                return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("An error occurred while retrieving applications", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadRentalApplicationDto>>> GetApplicationsByStatus(EApplicationStatus status)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var organizationId = GetOrganizationIdFromContext();
                if (!organizationId.HasValue)
                {
                    return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("Organization ID is required", "No organization context found", "", 400);
                }

                var applications = await _applicationRepository.GetApplicationsByStatusAndOrganizationId(organizationId.Value, status);
                
                return new ServiceResponse<List<LoadRentalApplicationDto>>
                {
                    Success = true,
                    Data = applications
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving applications by status");
                return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("An error occurred while retrieving applications", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadRentalApplicationDto>> UpdateApplication(UpdateRentalApplicationDto application)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Verify ownership - check if user is landlord or tenant
                var existing = await _applicationRepository.GetApplicationById(application.Id);
                if (existing == null)
                {
                    return new ServiceResponse<LoadRentalApplicationDto>
                    {
                        Success = false,
                        Message = "Application not found"
                    };
                }

                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser == null)
                {
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var isTenant = currentUser.Roles?.Any(r => r.ToLower() == "tenant") ?? false;
                var isLandlordOrAdmin = currentUser.Roles?.Any(r => r.ToLower() == "landlord" || r.ToLower() == "admin") ?? false;

                if (isTenant)
                {
                    // Tenant can only update their own applications (matching email) and only if status is Draft
                    if (!string.IsNullOrEmpty(currentUser.Email) && existing.Email.ToLower() != currentUser.Email.ToLower())
                    {
                        return ServiceResponse<LoadRentalApplicationDto>.CreateError("Unauthorized", "You can only update your own applications", "", 403);
                    }
                    
                    if (existing.Status != EApplicationStatus.Draft)
                    {
                        return ServiceResponse<LoadRentalApplicationDto>.CreateError("Invalid operation", "You can only update draft applications", "", 400);
                    }
                }
                else if (isLandlordOrAdmin)
                {
                    // Landlord/Admin must own the application
                    if (existing.LandlordId != currentUser.Id)
                    {
                        return ServiceResponse<LoadRentalApplicationDto>.CreateError("Unauthorized", "Unauthorized access to application", "", 403);
                    }
                }
                else
                {
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("Unauthorized", "User does not have permission to update applications", "", 403);
                }

                var result = await _applicationRepository.UpdateApplication(application);
                
                // Generate PDF if application is being submitted
                if (application.Status.HasValue && application.Status.Value == EApplicationStatus.Submitted)
                {
                    await GenerateAndSaveApplicationPdfAsync(application.Id);
                    
                    // Send notification to landlord when application is completed
                    await SendApplicationCompletionNotificationAsync(result, existing.LandlordId);
                }

                return new ServiceResponse<LoadRentalApplicationDto>
                {
                    Success = true,
                    Data = result,
                    Message = "Application updated successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating application");
                return ServiceResponse<LoadRentalApplicationDto>.CreateError("An error occurred while updating the application", ex.Message);
            }
        }

        private async Task GenerateAndSaveApplicationPdfAsync(long applicationId)
        {
            try
            {
                // Get the full application entity with all relationships
                var application = await _applicationRepository.GetApplicationEntityById(applicationId);
                if (application == null)
                {
                    _logger.LogWarning("Application {ApplicationId} not found when generating PDF", applicationId);
                    return;
                }

                // Generate PDF
                var pdfBytes = await _applicationPdfService.GenerateApplicationPdfAsync(application);

                // Save to blob storage
                var applicantName = $"{application.FirstName}_{application.LastName}";
                var blobName = await _applicationPdfService.SaveApplicationPdfToBlobAsync(pdfBytes, applicationId, applicantName);

                // Get blob client to generate SAS URL (valid for 7 days)
                var containerClient = _blobServiceClient.GetBlobContainerClient("application-pdfs");
                var blobClient = containerClient.GetBlobClient(blobName);
                
                // Generate a SAS URI for secure access (valid for 7 days)
                var blobUrl = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromDays(7));

                // Update application with PDF info
                await _applicationRepository.UpdateApplicationPdfFields(applicationId, blobName, blobUrl);

                _logger.LogInformation("PDF generated and saved for application {ApplicationId}", applicationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating PDF for application {ApplicationId}", applicationId);
                // Don't throw - PDF generation failure shouldn't block application submission
            }
        }

        private async Task SendApplicationCompletionNotificationAsync(LoadRentalApplicationDto application, long landlordId)
        {
            try
            {
                var propertyName = application.PropertyName ?? "Unknown Property";
                var unitName = application.UnitName;
                var applicantName = $"{application.FirstName} {application.LastName}";
                var propertyDisplay = !string.IsNullOrEmpty(unitName) ? $"{propertyName} - {unitName}" : propertyName;

                var notificationDto = new CreateNotificationDto
                {
                    UserId = landlordId,
                    Type = ENotificationType.Application,
                    Title = "New Application Submitted",
                    Message = $"{applicantName} has completed and submitted an application for {propertyDisplay}",
                    RelatedId = application.Id,
                    SendEmail = true,
                    SendSMS = true
                };

                await _notificationService.CreateNotification(notificationDto);
                _logger.LogInformation("Application completion notification sent to landlord {LandlordId} for application {ApplicationId}", 
                    landlordId, application.Id);
            }
            catch (Exception ex)
            {
                // Log but don't fail application submission if notification fails
                _logger.LogWarning(ex, "Failed to send application completion notification for application {ApplicationId}", 
                    application.Id);
            }
        }

        public async Task<ServiceResponse<bool>> DeleteApplication(long id)
        {
            try
            {
                var landlordId = await GetCurrentUserIdAsync();
                if (!landlordId.HasValue)
                {
                    return ServiceResponse<bool>.CreateError("User not found", "User not authenticated", "", 401);
                }

                // Verify landlord owns this application
                var existing = await _applicationRepository.GetApplicationById(id);
                if (existing == null)
                {
                    return new ServiceResponse<bool>
                    {
                        Success = false,
                        Message = "Application not found"
                    };
                }

                if (existing.LandlordId != landlordId.Value)
                {
                    return new ServiceResponse<bool>
                    {
                        Success = false,
                        Message = "Unauthorized access to application"
                    };
                }

                var result = await _applicationRepository.DeleteApplication(id);
                
                return new ServiceResponse<bool>
                {
                    Success = result,
                    Data = result,
                    Message = result ? "Application deleted successfully" : "Failed to delete application"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting application");
                return ServiceResponse<bool>.CreateError("An error occurred while deleting the application", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadRentalApplicationDto>> UpdateApplicationStatus(
            long id, 
            EApplicationStatus status, 
            string? rejectionReason, 
            string? reviewNotes)
        {
            try
            {
                var updateDto = new UpdateRentalApplicationDto
                {
                    Id = id,
                    Status = status,
                    RejectionReason = rejectionReason,
                    ReviewNotes = reviewNotes
                };

                return await UpdateApplication(updateDto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating application status");
                return ServiceResponse<LoadRentalApplicationDto>.CreateError("An error occurred while updating the application status", ex.Message);
            }
        }

        public async Task<ServiceResponse<List<LoadRentalApplicationDto>>> GetApplicationsByTenantEmail()
        {
            try
            {
                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser == null || string.IsNullOrEmpty(currentUser.Email))
                {
                    return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("User not found", "User not authenticated", "", 401);
                }

                var applications = await _applicationRepository.GetApplicationsByTenantEmail(currentUser.Email);

                return new ServiceResponse<List<LoadRentalApplicationDto>>
                {
                    Success = true,
                    Data = applications
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving tenant applications");
                return ServiceResponse<List<LoadRentalApplicationDto>>.CreateError("An error occurred while retrieving applications", ex.Message);
            }
        }

        public async Task<ServiceResponse<LoadRentalApplicationDto>> SubmitPublicApplicationAsync(PublicApplicationSubmitDto dto)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(dto.ListingNumber))
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("Listing number is required", "", "", 400);

                var listing = await _listingRepository.GetListingByNumber(dto.ListingNumber);
                if (listing == null)
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("Listing not found", "", "", 404);

                if (!listing.AcceptOnlineApplications)
                    return ServiceResponse<LoadRentalApplicationDto>.CreateError("This listing is not accepting online applications", "", "", 400);

                var addDto = new AddRentalApplicationDto
                {
                    PropertyId = listing.PropertyId,
                    UnitId = listing.UnitId,
                    FirstName = dto.FirstName,
                    LastName = dto.LastName,
                    Email = dto.Email,
                    PhoneNumber = dto.PhoneNumber,
                    DesiredMoveInDate = dto.DesiredMoveInDate,
                    NumberOfOccupants = dto.NumberOfOccupants,
                    HasPets = dto.HasPets,
                    PetDetails = dto.PetDetails,
                    AdditionalNotes = dto.AdditionalNotes,
                    Status = EApplicationStatus.Submitted,
                    IsLandlordEntered = false
                };

                var result = await _applicationRepository.AddApplication(addDto, listing.CreatedBy, listing.OrganizationId);

                // Generate PDF — don't block if it fails
                await GenerateAndSaveApplicationPdfAsync(result.Id);
                result = await _applicationRepository.GetApplicationById(result.Id) ?? result;

                // Notify landlord
                await SendApplicationCompletionNotificationAsync(result, listing.CreatedBy);

                return new ServiceResponse<LoadRentalApplicationDto>
                {
                    Success = true,
                    Data = result,
                    Message = "Application submitted successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting public application for listing {ListingNumber}", dto.ListingNumber);
                return ServiceResponse<LoadRentalApplicationDto>.CreateError("An error occurred while submitting the application", ex.Message);
            }
        }
    }
}

