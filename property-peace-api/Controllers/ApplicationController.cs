using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.BackgroundCheck;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.ApplicationService;
using brownstone_hub_api.Services.ApplicationPdfService;
using brownstone_hub_api.Services.BackgroundCheckService;
using brownstone_hub_api.Config;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Repositories.Applications;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Models;
using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ApplicationController(
        IApplicationService applicationService,
        IApplicationPdfService applicationPdfService,
        IApplicationRepository applicationRepository,
        IUserRepository userRepository,
        BlobServiceClient blobServiceClient,
        IAzureBlobService azureBlobService,
        IBackgroundCheckService backgroundCheckService) : ControllerBase
    {
        private readonly IApplicationService _applicationService = applicationService;
        private readonly IApplicationPdfService _applicationPdfService = applicationPdfService;
        private readonly IApplicationRepository _applicationRepository = applicationRepository;
        private readonly IUserRepository _userRepository = userRepository;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly IBackgroundCheckService _backgroundCheckService = backgroundCheckService;


        [HttpGet("tenant/my-applications")]
        [Authorize(Roles = "Tenant")]
        public async Task<IActionResult> GetTenantApplications()
        {
            var response = await _applicationService.GetApplicationsByTenantEmail();
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> AddApplication([FromBody] AddRentalApplicationDto application)
        {
            var response = await _applicationService.AddApplication(application);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("public")]
        [AllowAnonymous]
        public async Task<IActionResult> SubmitPublicApplication([FromBody] PublicApplicationSubmitDto dto)
        {
            var response = await _applicationService.SubmitPublicApplicationAsync(dto);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("{id}")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> GetApplication(long id)
        {
            var response = await _applicationService.GetApplicationById(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            // Additional authorization check for tenants
            var currentUser = await _userRepository.GetCurrentUser();
            if (currentUser != null)
            {
                var isTenant = currentUser.Roles?.Any(r => r.ToLower() == "tenant") ?? false;
                if (isTenant && !string.IsNullOrEmpty(currentUser.Email) && response.Data != null)
                {
                    // Tenant can only access applications with their email
                    if (response.Data.Email.ToLower() != currentUser.Email.ToLower())
                    {
                        return Forbid("You can only access your own applications");
                    }
                }
            }

            return Ok(response);
        }

        [HttpGet("landlord/{landlordId}")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> GetApplicationsByLandlord(long landlordId)
        {
            var response = await _applicationService.GetApplicationsByLandlordId(landlordId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("property/{propertyId}")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> GetApplicationsByProperty(long propertyId)
        {
            var response = await _applicationService.GetApplicationsByPropertyId(propertyId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpGet("status/{status}")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> GetApplicationsByStatus(EApplicationStatus status)
        {
            var response = await _applicationService.GetApplicationsByStatus(status);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> UpdateApplication(long id, [FromBody] UpdateRentalApplicationDto application)
        {
            if (id != application.Id)
                return BadRequest(new { Message = "Application ID mismatch" });

            // Additional authorization check for tenants
            var currentUser = await _userRepository.GetCurrentUser();
            if (currentUser != null)
            {
                var isTenant = currentUser.Roles?.Any(r => r.ToLower() == "tenant") ?? false;
                if (isTenant)
                {
                    // Get existing application to verify ownership
                    var existingApp = await _applicationRepository.GetApplicationById(id);
                    if (existingApp == null)
                    {
                        return NotFound(new { Message = "Application not found" });
                    }

                    // Tenant can only update applications with their email and only if status is Draft
                    if (!string.IsNullOrEmpty(currentUser.Email) &&
                        existingApp.Email.ToLower() != currentUser.Email.ToLower())
                    {
                        return Forbid("You can only update your own applications");
                    }

                    if (existingApp.Status != EApplicationStatus.Draft)
                    {
                        return BadRequest(new { Message = "You can only update draft applications" });
                    }

                    // Ensure email matches (tenants cannot change the email on their application)
                    if (!string.IsNullOrEmpty(application.Email) &&
                        application.Email.ToLower() != existingApp.Email.ToLower())
                    {
                        return BadRequest(new { Message = "You cannot change the email address on your application" });
                    }

                    // Note: PropertyId and UnitId are not in UpdateRentalApplicationDto, so tenants cannot change them
                    // The service layer will handle this validation
                }
            }

            var response = await _applicationService.UpdateApplication(application);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPut("{id}/status")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> UpdateApplicationStatus(
            long id,
            [FromBody] UpdateApplicationStatusDto statusUpdate)
        {
            var response = await _applicationService.UpdateApplicationStatus(
                id,
                statusUpdate.Status,
                statusUpdate.RejectionReason,
                statusUpdate.ReviewNotes);

            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> DeleteApplication(long id)
        {
            var response = await _applicationService.DeleteApplication(id);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [HttpPost("{id}/generate-pdf")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> GenerateApplicationPdf(long id)
        {
            try
            {
                var application = await _applicationRepository.GetApplicationEntityById(id);
                if (application == null)
                {
                    return NotFound(new { Message = "Application not found" });
                }

                // Verify authorization
                var applicationDto = await _applicationRepository.GetApplicationById(id);
                if (applicationDto == null)
                {
                    return NotFound(new { Message = "Application not found" });
                }

                // Generate PDF
                var pdfBytes = await _applicationPdfService.GenerateApplicationPdfAsync(application);

                // Save to blob storage
                var applicantName = $"{application.FirstName}_{application.LastName}";
                var blobName = await _applicationPdfService.SaveApplicationPdfToBlobAsync(pdfBytes, id, applicantName);

                // Get blob client and generate SAS URI (valid for 7 days)
                var containerClient = _blobServiceClient.GetBlobContainerClient("application-pdfs");
                var blobClient = containerClient.GetBlobClient(blobName);

                // Generate a SAS URI for secure access (valid for 7 days)
                var blobUrl = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromDays(7));

                // Update application with PDF info
                await _applicationRepository.UpdateApplicationPdfFields(id, blobName, blobUrl);

                return Ok(new { Message = "PDF generated successfully", BlobName = blobName, BlobUrl = blobUrl });
            }
            catch (Exception ex)
            {
                return StatusCode(500, ServiceResponse<object>.CreateError(
                    "Error generating PDF",
                    ex.Message,
                    ex.InnerException?.Message,
                    500));
            }
        }

        [HttpGet("{id}/pdf")]
        [Authorize(Roles = "Landlord,Admin,Tenant")]
        public async Task<IActionResult> DownloadApplicationPdf(long id)
        {
            try
            {
                var application = await _applicationRepository.GetApplicationById(id);
                if (application == null)
                {
                    return NotFound(new { Message = "Application not found" });
                }

                // Verify authorization: Tenant can only download their own applications
                var currentUser = await _userRepository.GetCurrentUser();
                if (currentUser != null)
                {
                    var isTenant = currentUser.Roles?.Any(r => r.ToLower() == "tenant") ?? false;
                    if (isTenant && !string.IsNullOrEmpty(currentUser.Email))
                    {
                        // Tenant can only access applications with their email
                        if (application.Email.ToLower() != currentUser.Email.ToLower())
                        {
                            return Forbid("You can only download your own applications");
                        }
                    }
                    else
                    {
                        // Landlord/Admin must own the application
                        var isLandlordOrAdmin = currentUser.Roles?.Any(r => r.ToLower() == "landlord" || r.ToLower() == "admin") ?? false;
                        if (isLandlordOrAdmin && application.LandlordId != currentUser.Id)
                        {
                            return Forbid("You can only download applications for your properties");
                        }
                    }
                }

                // Generate PDF if it doesn't exist
                if (string.IsNullOrEmpty(application.PdfBlobName))
                {
                    var applicationEntity = await _applicationRepository.GetApplicationEntityById(id);
                    if (applicationEntity == null)
                    {
                        return NotFound(new { Message = "Application not found" });
                    }

                    // Generate PDF
                    var pdfBytes = await _applicationPdfService.GenerateApplicationPdfAsync(applicationEntity);

                    // Save to blob storage
                    var applicantName = $"{applicationEntity.FirstName}_{applicationEntity.LastName}";
                    var blobName = await _applicationPdfService.SaveApplicationPdfToBlobAsync(pdfBytes, id, applicantName);

                    // Get blob client and generate SAS URI (valid for 7 days)
                    var containerClient = _blobServiceClient.GetBlobContainerClient("application-pdfs");
                    var blobClient = containerClient.GetBlobClient(blobName);

                    // Generate a SAS URI for secure access (valid for 7 days)
                    var blobUrl = _azureBlobService.GenerateBlobSasUri(_blobServiceClient, blobClient, TimeSpan.FromDays(7));

                    // Update application with PDF info
                    await _applicationRepository.UpdateApplicationPdfFields(id, blobName, blobUrl);

                    application.PdfBlobName = blobName;
                    application.PdfBlobUrl = blobUrl;
                }

                // Download from blob storage
                var downloadContainerClient = _blobServiceClient.GetBlobContainerClient("application-pdfs");
                var downloadBlobClient = downloadContainerClient.GetBlobClient(application.PdfBlobName);

                if (!await downloadBlobClient.ExistsAsync())
                {
                    return NotFound(new { Message = "PDF file not found in storage" });
                }

                using var memoryStream = new MemoryStream();
                await downloadBlobClient.DownloadToAsync(memoryStream);
                var downloadPdfBytes = memoryStream.ToArray();

                var fileName = $"Application_{id}_{application.FirstName}_{application.LastName}.pdf";
                return File(downloadPdfBytes, "application/pdf", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, ServiceResponse<object>.CreateError(
                    "Error downloading PDF",
                    ex.Message,
                    ex.InnerException?.Message,
                    500));
            }
        }

        [HttpPost("{id}/background-check")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> RequestBackgroundCheck(long id, [FromBody] RequestBackgroundCheckDto request)
        {
            var ownershipFailure = await EnsureApplicationOwnedByCurrentUser(id);
            if (ownershipFailure != null)
                return ownershipFailure;

            if (id != request.ApplicationId)
                return BadRequest(new { Message = "Application ID mismatch" });

            return StatusCode(StatusCodes.Status410Gone,
                new { Message = "This endpoint has been retired. Use /api/screenings." });
        }

        [HttpGet("{id}/background-check")]
        [Authorize(Roles = "Landlord,Admin")]
        public async Task<IActionResult> GetBackgroundCheckStatus(long id)
        {
            var ownershipFailure = await EnsureApplicationOwnedByCurrentUser(id);
            if (ownershipFailure != null)
                return ownershipFailure;

            return StatusCode(StatusCodes.Status410Gone,
                new { Message = "This endpoint has been retired. Use /api/screenings." });
        }

        private async Task<IActionResult?> EnsureApplicationOwnedByCurrentUser(long applicationId)
        {
            var currentUser = await _userRepository.GetCurrentUser();
            if (currentUser == null)
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "You can only access screening for applications assigned to you" });

            var organizationId = this.GetCurrentOrganizationId();
            if (!organizationId.HasValue)
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "You can only access screening for applications assigned to your organization" });

            // Query only the ownership boundary before loading applicant PII or calling RentSpree.
            var isOwned = await _applicationRepository.IsApplicationOwnedByLandlordAndOrganization(
                applicationId,
                currentUser.Id,
                organizationId.Value);
            if (!isOwned.HasValue)
                return NotFound(new { Message = "Application not found" });

            if (!isOwned.Value)
                return StatusCode(StatusCodes.Status403Forbidden, new { Message = "You can only access screening for applications assigned to you" });

            return null;
        }
    }
}