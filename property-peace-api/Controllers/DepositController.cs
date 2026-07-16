using brownstone_hub_api.Dtos.Deposit;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Helpers;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.NotificationService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/deposit")]
    [Authorize(Roles = "Landlord,Admin,Tenant")]
    public class DepositController(DataContext dataContext, INotificationService notificationService, ILogger<DepositController> logger) : ControllerBase
    {
        private readonly DataContext _dataContext = dataContext;
        private readonly INotificationService _notificationService = notificationService;
        private readonly ILogger<DepositController> _logger = logger;

        [HttpGet("lease/{leaseId}")]
        public async Task<IActionResult> GetDepositsByLeaseId(long leaseId)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            try
            {
                var deposits = await _dataContext.Deposits
                    .Where(d => d.LeaseId == leaseId && d.OrganizationId == organizationId.Value)
                    .OrderByDescending(d => d.ReceivedDate)
                    .Select(d => new DepositDto
                    {
                        Id = d.Id,
                        Amount = d.Amount,
                        ReceivedDate = d.ReceivedDate,
                        RefundAmount = d.RefundAmount,
                        RefundedDate = d.RefundedDate,
                        Notes = d.Notes,
                        HeldInEscrow = d.HeldInEscrow
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = deposits });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }

        [HttpPost]
        public async Task<IActionResult> CreateDeposit([FromBody] CreateDepositDto createDeposit)
        {
            var organizationId = this.GetCurrentOrganizationIdOrForbid();
            if (!organizationId.HasValue)
                return StatusCode(403, new { Message = "Organization context is required" });

            try
            {
                // Verify lease exists and belongs to organization
                var lease = await _dataContext.Leases
                    .Include(l => l.Unit)
                    .ThenInclude(u => u.Property)
                    .FirstOrDefaultAsync(l => l.Id == createDeposit.LeaseId);

                if (lease == null)
                    return BadRequest(new { success = false, message = "Lease not found" });

                if (lease.Unit?.Property?.OrganizationId != organizationId.Value)
                    return StatusCode(403, new { success = false, message = "Access denied" });

                var deposit = new Deposit
                {
                    LeaseId = createDeposit.LeaseId,
                    Amount = createDeposit.Amount,
                    ReceivedDate = createDeposit.ReceivedDate ?? DateTime.UtcNow,
                    Notes = createDeposit.Notes ?? string.Empty,
                    OrganizationId = organizationId.Value
                };

                _dataContext.Deposits.Add(deposit);
                await _dataContext.SaveChangesAsync();

                // Get landlord ID from lease property and create notification
                try
                {
                    if (lease.Unit?.Property != null)
                    {
                        var landlordId = lease.Unit.Property.LandlordId;
                        var propertyName = lease.Unit.Property.Name ?? "Property";
                        var unitName = lease.Unit.Name;

                        // Create notification for deposit received
                        var notificationDto = new CreateNotificationDto
                        {
                            UserId = landlordId,
                            Type = ENotificationType.Payment,
                            Title = "Deposit Received",
                            Message = $"Deposit of ${deposit.Amount:F2} was received for {propertyName}" + 
                                     (unitName != null ? $" - {unitName}" : "") + 
                                     $" on {deposit.ReceivedDate:MM/dd/yyyy}",
                            RelatedId = createDeposit.LeaseId,
                            SendEmail = true,
                            SendSMS = true
                        };

                        await _notificationService.CreateNotification(notificationDto);
                    }
                }
                catch (Exception ex)
                {
                    // Log but don't fail deposit processing if notification fails
                    _logger.LogWarning(ex, "Failed to create notification for deposit {LeaseId}", createDeposit.LeaseId);
                }

                var depositDto = new DepositDto
                {
                    Id = deposit.Id,
                    Amount = deposit.Amount,
                    ReceivedDate = deposit.ReceivedDate,
                    RefundAmount = deposit.RefundAmount,
                    RefundedDate = deposit.RefundedDate,
                    Notes = deposit.Notes,
                    HeldInEscrow = deposit.HeldInEscrow
                };

                return Ok(new { success = true, data = depositDto });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { success = false, message = ex.Message });
            }
        }
    }
}

