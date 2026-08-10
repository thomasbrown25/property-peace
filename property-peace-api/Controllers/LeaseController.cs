using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.LeaseAgreement;
using brownstone_hub_api.Models;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.LeaseService;
using brownstone_hub_api.Services.ESignatureService;
using brownstone_hub_api.Config;
using brownstone_hub_api.Filters;
using brownstone_hub_api.Services.TenantDocumentService;
using brownstone_hub_api.Services.UserService;
using brownstone_hub_api.Services.AzureBlobService;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Repositories.Tenants;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class LeaseController(
        ILeaseService leaseService,
        IESignatureService eSignatureService,
        ITenantDocumentService tenantDocumentService,
        BlobServiceClient blobServiceClient,
        IUserService userService,
        ITenantRepository tenantRepository,
        DataContext dataContext,
        IAzureBlobService azureBlobService,
        INotificationService notificationService,
        ILogger<LeaseController> logger,
        IConfiguration configuration) : ControllerBase
    {
        private readonly ILeaseService _leaseService = leaseService;
        private readonly IESignatureService _eSignatureService = eSignatureService;
        private readonly ITenantDocumentService _tenantDocumentService = tenantDocumentService;
        private readonly BlobServiceClient _blobServiceClient = blobServiceClient;
        private readonly IUserService _userService = userService;
        private readonly ITenantRepository _tenantRepository = tenantRepository;
        private readonly DataContext _dataContext = dataContext;
        private readonly IAzureBlobService _azureBlobService = azureBlobService;
        private readonly INotificationService _notificationService = notificationService;
        private readonly ILogger<LeaseController> _logger = logger;
        private readonly IConfiguration _configuration = configuration;
        private const string SignedDocumentsContainerName = "signed-documents";

        private async Task<bool> RequireLeaseManagementPermissionAsync()
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            var userId = HttpContext.Items.TryGetValue("UserId", out var userIdObject) && userIdObject is long id ? id : 0;
            return userId > 0 && await _dataContext.OrganizationMembers.AsNoTracking().AnyAsync(member =>
                member.UserId == userId && member.OrganizationId == organizationId && member.IsActive
                && (member.Role == "Owner" || member.Role == "Admin"
                    || member.Role == "Manager" && member.CanManageLeases));
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost]
        public async Task<IActionResult> AddOrUpdateLease(UpdateLeaseDto lease)
        {
            var response = await _leaseService.AddOrUpdateLease(lease);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{leaseId}/notify-tenant/{tenantId}")]
        public async Task<IActionResult> NotifyTenantLeaseAdded(long leaseId, long tenantId)
        {
            try
            {
                var organizationId = this.GetCurrentOrganizationIdOrForbid();
                await _leaseService.SendLeaseAddedNotificationAsync(leaseId, tenantId, organizationId);
                return Ok(new { success = true, message = "Notification sent successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending lease added notification for lease {LeaseId} to tenant {TenantId}", leaseId, tenantId);
                return StatusCode(500, new { success = false, message = "Failed to send notification" });
            }
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpDelete("{leaseId}/tenants/{tenantId}")]
        public async Task<IActionResult> RemoveTenantFromLease(long leaseId, long tenantId)
        {
            var response = await _leaseService.RemoveTenantFromLease(leaseId, tenantId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        /// <summary>Updates the lease agreement step-completion flags (builder steps). Step flags are append-only — once true they stay true.</summary>
        [Authorize(Roles = "Landlord,Admin")]
        [HttpPatch("{leaseId}/agreement")]
        public async Task<IActionResult> UpdateLeaseAgreement(long leaseId, [FromBody] UpdateLeaseAgreementDto dto)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            var userId = HttpContext.Items.TryGetValue("UserId", out var userIdObject) && userIdObject is long id ? id : 0;
            var canManageLeases = userId > 0 && await _dataContext.OrganizationMembers.AsNoTracking().AnyAsync(member =>
                member.UserId == userId && member.OrganizationId == organizationId && member.IsActive
                && (member.Role == "Owner" || member.Role == "Admin"
                    || member.Role == "Manager" && member.CanManageLeases));
            if (!canManageLeases) return Forbid();

            var agreement = await _dataContext.LeaseAgreements
                .FirstOrDefaultAsync(la => la.LeaseId == leaseId && !la.Lease.IsDeleted
                    && la.Lease.Unit.Property.OrganizationId == organizationId
                    && (!la.Lease.OrganizationId.HasValue || la.Lease.OrganizationId == organizationId));
            if (agreement == null)
                return NotFound(new { Message = "Lease agreement not found" });

            if (dto.IsLeaseSpecificsComplete == true)        agreement.IsLeaseSpecificsComplete = true;
            if (dto.IsRentDepositFeesComplete == true)       agreement.IsRentDepositFeesComplete = true;
            if (dto.IsPeopleOnLeaseComplete == true)         agreement.IsPeopleOnLeaseComplete = true;
            if (dto.IsPetsSmokingOtherComplete == true)      agreement.IsPetsSmokingOtherComplete = true;
            if (dto.IsUtilitiesMaintenanceKeysComplete == true) agreement.IsUtilitiesMaintenanceKeysComplete = true;
            if (dto.IsProvisionsAttachmentsComplete == true) agreement.IsProvisionsAttachmentsComplete = true;

            await _dataContext.SaveChangesAsync();
            return Ok(new { success = true, data = new {
                agreement.Id, agreement.LeaseId,
                agreement.IsLeaseSpecificsComplete, agreement.IsRentDepositFeesComplete,
                agreement.IsPeopleOnLeaseComplete, agreement.IsPetsSmokingOtherComplete,
                agreement.IsUtilitiesMaintenanceKeysComplete, agreement.IsProvisionsAttachmentsComplete
            }});
        }

        /// <summary>Marks the lease as no longer a draft (IsDrafted = false). Call when user completes all "Finish Setting Up" steps on the lease page.</summary>
        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{leaseId}/complete-draft")]
        public async Task<IActionResult> CompleteDraft(long leaseId)
        {
            var response = await _leaseService.CompleteDraft(leaseId);
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });
            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{leaseId}/tenants/{tenantId}")]
        public async Task<IActionResult> AddTenantToLease(long leaseId, long tenantId)
        {
            var response = await _leaseService.AddTenantToLease(leaseId, tenantId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Tenant,Admin")]
        [HttpGet("tenant/my-leases")]
        public async Task<IActionResult> GetMyLeases()
        {
            // Get current user ID from JWT token (try multiple claim names)
            long? userId = null;
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                userIdClaim = User?.FindFirst("userId")?.Value;
            }
            
            // If user ID not found in claims, try to parse if it's a number
            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                userId = parsedUserId;
            }
            else
            {
                // If user ID not in claims, look up by email (from "sub" claim or NameIdentifier)
                var email = User?.FindFirst("sub")?.Value;
                if (string.IsNullOrEmpty(email))
                {
                    email = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                }
                if (string.IsNullOrEmpty(email))
                {
                    email = User?.FindFirst(ClaimTypes.Name)?.Value;
                }

                if (!string.IsNullOrEmpty(email))
                {
                    try
                    {
                        var userResponse = await _userService.GetUserByEmailAsync(email);
                        if (userResponse.Success && userResponse.Data != null)
                        {
                            userId = userResponse.Data.Id;
                        }
                    }
                    catch (Exception)
                    {
                        return Unauthorized(new { Message = "Unable to retrieve user information" });
                    }
                }
            }

            if (!userId.HasValue)
            {
                return Unauthorized(new { Message = "User ID not found in token" });
            }

            var response = await _leaseService.GetLeasesByTenantUserId(userId.Value);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Tenant,Admin")]
        [HttpGet("tenant/my-lease")]
        public async Task<IActionResult> GetMyLease()
        {
            long? userId = null;
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
                userIdClaim = User?.FindFirst("userId")?.Value;

            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                userId = parsedUserId;
            }
            else
            {
                var email = User?.FindFirst("sub")?.Value
                    ?? User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User?.FindFirst(ClaimTypes.Name)?.Value;

                if (!string.IsNullOrEmpty(email))
                {
                    var userResponse = await _userService.GetUserByEmailAsync(email);
                    if (userResponse.Success && userResponse.Data != null)
                        userId = userResponse.Data.Id;
                }
            }

            if (!userId.HasValue)
                return Unauthorized(new { Message = "User ID not found in token" });

            var leasesResponse = await _leaseService.GetLeasesByTenantUserId(userId.Value);
            if (!leasesResponse.Success || leasesResponse.Data == null || !leasesResponse.Data.Any())
                return NotFound(new { Message = "No lease found", Errors = new { Details = "No active lease found for this tenant" } });

            // Return the active lease; fall back to the most recently started lease
            var lease = leasesResponse.Data.FirstOrDefault(l => l.IsActive)
                ?? leasesResponse.Data.OrderByDescending(l => l.StartDate).First();

            return Ok(ServiceResponse<LoadLeaseDto>.CreateSuccess(lease));
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("{unitId}")]
        public async Task<IActionResult> GetLease(long unitId)
        {
            var response = await _leaseService.GetLease(unitId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("active/{propertyId}")]
        public async Task<IActionResult> GetActiveLease(long propertyId)
        {
            var response = await _leaseService.GetActiveLease(propertyId);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteLease(long id)
        {
            var response = await _leaseService.DeleteLease(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{id}/end")]
        public async Task<IActionResult> EndLease(long id)
        {
            var response = await _leaseService.EndLease(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{id}/reopen")]
        public async Task<IActionResult> ReopenLease(long id)
        {
            var response = await _leaseService.ReopenLease(id);

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("history")]
        public async Task<IActionResult> GetLeaseHistory()
        {
            var response = await _leaseService.GetLeaseHistory();

            if (!response.Success)
                return StatusCode(response.StatusCode, new
                {
                    response.Message,
                    response.Errors
                });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{leaseId}/sign-landlord")]
        [RequireFeatureReady(FeatureKeys.ESignature)]
        public async Task<IActionResult> SignLandlordOnly(long leaseId, [FromBody] SendLeaseForSignatureDto request)
        {
            if (!await RequireLeaseManagementPermissionAsync()) return Forbid();
            if (leaseId != request.LeaseId)
                return BadRequest(new { Message = "Lease ID mismatch" });

            var frontendBaseUrl = _configuration["FrontendBaseUrl"] ?? 
                (Request.IsHttps ? $"https://{Request.Host}" : $"http://{Request.Host}");
            
            var response = await _leaseService.SignLandlordOnlyAsync(leaseId, request, frontendBaseUrl);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new { success = true, data = response.Data, message = response.Data?.Message });
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{leaseId}/send-for-signature")]
        [RequireFeatureReady(FeatureKeys.ESignature)]
        public async Task<IActionResult> SendLeaseForSignature(long leaseId, [FromBody] SendLeaseForSignatureDto request)
        {
            if (!await RequireLeaseManagementPermissionAsync()) return Forbid();
            if (leaseId != request.LeaseId)
                return BadRequest(new { Message = "Lease ID mismatch" });

            // Get current user ID (landlord)
            long? landlordId = null;
            var userIdClaim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim))
            {
                userIdClaim = User?.FindFirst("userId")?.Value;
            }
            if (!string.IsNullOrEmpty(userIdClaim) && long.TryParse(userIdClaim, out var parsedUserId))
            {
                landlordId = parsedUserId;
            }
            else
            {
                return Unauthorized(new { Message = "Unable to determine user ID" });
            }

            // Get organization ID from context
            var organizationId = this.GetCurrentOrganizationId();

            var response = await _leaseService.SendLeaseForSignatureAsync(leaseId, request, landlordId.Value, organizationId);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(response);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("{leaseId}/signature-status")]
        [RequireFeatureReady(FeatureKeys.ESignature)]
        public async Task<IActionResult> GetLeaseSignatureStatus(long leaseId)
        {
            var leaseResponse = await _leaseService.GetLeaseById(leaseId);
            if (!leaseResponse.Success || leaseResponse.Data == null)
                return NotFound(new { Message = "Lease not found" });

            var lease = leaseResponse.Data;
            if (string.IsNullOrEmpty(lease.LeaseAgreement?.DocuSignEnvelopeId))
                return BadRequest(new { Message = "Lease has not been sent for signature" });

            var statusResponse = await _eSignatureService.GetSignatureStatus(lease.LeaseAgreement?.DocuSignEnvelopeId);
            if (!statusResponse.Success)
                return StatusCode(statusResponse.StatusCode, new
                {
                    statusResponse.Message,
                    statusResponse.Errors
                });

            return Ok(statusResponse);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{leaseId}/cancel-signature")]
        [RequireFeatureReady(FeatureKeys.ESignature)]
        public async Task<IActionResult> CancelLeaseSignature(long leaseId, [FromBody] string? reason = null)
        {
            if (!await RequireLeaseManagementPermissionAsync()) return Forbid();
            var leaseResponse = await _leaseService.GetLeaseById(leaseId);
            if (!leaseResponse.Success || leaseResponse.Data == null)
                return NotFound(new { Message = "Lease not found" });

            var lease = leaseResponse.Data;
            if (string.IsNullOrEmpty(lease.LeaseAgreement?.DocuSignEnvelopeId))
                return BadRequest(new { Message = "Lease has not been sent for signature" });

            var cancelResponse = await _eSignatureService.CancelSignature(lease.LeaseAgreement?.DocuSignEnvelopeId, reason);
            if (!cancelResponse.Success)
                return StatusCode(cancelResponse.StatusCode, new
                {
                    cancelResponse.Message,
                    cancelResponse.Errors
                });

            return Ok(cancelResponse);
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{leaseId}/sync-signature-status")]
        [RequireFeatureReady(FeatureKeys.ESignature)]
        public async Task<IActionResult> SyncSignatureStatus(long leaseId)
        {
            if (!await RequireLeaseManagementPermissionAsync()) return Forbid();
            var landlordEmail = User?.FindFirst(ClaimTypes.Email)?.Value ?? 
                              User?.FindFirst("email")?.Value;

            var response = await _leaseService.SyncLeaseSignatureStatusAsync(leaseId, landlordEmail);
            
            if (!response.Success)
                return StatusCode(response.StatusCode, new { response.Message, response.Errors });

            return Ok(new
            {
                success = true,
                data = response.Data,
                message = "Signature status synced successfully"
            });
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpGet("{leaseId}/signing-url")]
        [RequireFeatureReady(FeatureKeys.ESignature)]
        public async Task<IActionResult> GetLandlordSigningUrl(long leaseId)
        {
            var leaseResponse = await _leaseService.GetLeaseById(leaseId);
            if (!leaseResponse.Success || leaseResponse.Data == null)
                return NotFound(new { Message = "Lease not found" });

            var lease = leaseResponse.Data;
            if (string.IsNullOrEmpty(lease.LeaseAgreement?.DocuSignEnvelopeId))
                return BadRequest(new { Message = "Lease has not been sent for signature" });

            // Get signature status to check if already signed
            var statusResponse = await _eSignatureService.GetSignatureStatus(lease.LeaseAgreement?.DocuSignEnvelopeId);
            if (!statusResponse.Success)
                return StatusCode(statusResponse.StatusCode, new
                {
                    statusResponse.Message,
                    statusResponse.Errors
                });

            // Check if already completed
            if (statusResponse.Data?.Status == "completed" || statusResponse.Data?.Status == "signed")
            {
                return Ok(new { 
                    Success = true, 
                    AlreadySigned = true,
                    CompletedAt = statusResponse.Data.CompletedAt,
                    Message = "This lease has already been fully signed."
                });
            }

            // Return message directing to email
            return Ok(new { 
                Success = true, 
                Message = "Please check your email for the DocuSign signing link. DocuSign sends a secure signing link to your email address when the lease is sent for signature.",
                Status = statusResponse.Data?.Status,
                Note = "If you cannot find the email, check your spam folder or use the 'Resend' button to receive a new signing link."
            });
        }

        [Authorize(Roles = "Landlord,Admin")]
        [HttpPost("{leaseId}/resend-signature")]
        [RequireFeatureReady(FeatureKeys.ESignature)]
        public async Task<IActionResult> ResendLeaseSignature(long leaseId)
        {
            if (!await RequireLeaseManagementPermissionAsync()) return Forbid();
            var leaseResponse = await _leaseService.GetLeaseById(leaseId);
            if (!leaseResponse.Success || leaseResponse.Data == null)
                return NotFound(new { Message = "Lease not found" });

            var lease = leaseResponse.Data;
            if (string.IsNullOrEmpty(lease.LeaseAgreement?.DocuSignEnvelopeId))
                return BadRequest(new { Message = "Lease has not been sent for signature" });

            var resendResponse = await _eSignatureService.ResendSignatureRequest(lease.LeaseAgreement?.DocuSignEnvelopeId);
            if (!resendResponse.Success)
                return StatusCode(resendResponse.StatusCode, new
                {
                    resendResponse.Message,
                    resendResponse.Errors
                });

            return Ok(resendResponse);
        }

    }
}