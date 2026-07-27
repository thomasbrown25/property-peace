using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.SupportRequest;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using brownstone_hub_api.Services.SupportRequestService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/support")]
    [Authorize(Roles = "Landlord,Admin")]
    public class SupportRequestController(
        ISupportRequestService supportRequestService,
        IUserRepository userRepository,
        IMessageRepository messageRepository,
        INotificationService notificationService,
        DataContext context,
        ILogger<SupportRequestController> logger) : ControllerBase
    {
        private const int MaxMessageLength = 5000;

        [HttpPost("submit-request")]
        public async Task<IActionResult> SubmitRequest([FromBody] SubmitSupportRequestDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Type) || string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest(new { message = "Type, subject, and message are required" });
            }

            if (request.Subject.Trim().Length > 500 || request.Message.Trim().Length > MaxMessageLength)
            {
                return BadRequest(new { message = "Subject must be 500 characters or fewer and message must be 5,000 characters or fewer." });
            }

            var response = await supportRequestService.SubmitSupportRequest(request);
            if (!response.Success)
            {
                return StatusCode(response.StatusCode > 0 ? response.StatusCode : 500, new { response.Message, response.Errors });
            }

            return Ok(response);
        }

        [HttpGet("tickets")]
        public async Task<IActionResult> GetTickets()
        {
            var currentUser = await userRepository.GetCurrentUser();
            if (currentUser == null) return Unauthorized();

            var isAdmin = User.IsInRole("Admin");
            var query = context.SupportAndFeedbacks.AsNoTracking().AsQueryable();
            if (!isAdmin)
            {
                query = query.Where(ticket => ticket.UserId == currentUser.Id);
                if (TryGetOrganizationId(out var organizationId))
                {
                    query = query.Where(ticket => ticket.ConversationId == null || ticket.Conversation!.OrganizationId == organizationId);
                }
            }

            var tickets = await query
                .Include(ticket => ticket.User)
                .Include(ticket => ticket.Conversation)
                .OrderByDescending(ticket => ticket.LastActivityAt)
                .Select(ticket => new SupportTicketSummaryDto
                {
                    Id = ticket.Id,
                    TicketNumber = ticket.TicketNumber,
                    Type = ticket.Type,
                    SubType = ticket.SubType,
                    Subject = ticket.Subject,
                    Message = ticket.Message,
                    CreatedAt = ticket.CreatedAt,
                    LastActivityAt = ticket.LastActivityAt,
                    ResolvedAt = ticket.ResolvedAt,
                    IsResolved = ticket.IsResolved,
                    IsFavorite = ticket.IsFavorite,
                    ConversationId = ticket.ConversationId,
                    LastMessageBy = ticket.Conversation == null ? null : ticket.Conversation.LastMessageBy,
                    MessageCount = ticket.ConversationId == null ? 1 : context.Messages.Count(message => message.ConversationId == ticket.ConversationId && !message.IsDeleted),
                    UnreadCount = ticket.ConversationId == null ? 0 : context.Messages.Count(message =>
                        message.ConversationId == ticket.ConversationId && !message.IsDeleted && message.SenderId != currentUser.Id &&
                        !context.MessageReads.Any(read => read.MessageId == message.Id && read.UserId == currentUser.Id)),
                    CanReply = ticket.ConversationId != null,
                    UserId = ticket.UserId,
                    UserName = (ticket.User.FirstName + " " + ticket.User.LastName).Trim(),
                    UserEmail = ticket.User.Email
                })
                .ToListAsync();

            return Ok(new { success = true, data = tickets });
        }

        [HttpGet("tickets/{id:long}")]
        public async Task<IActionResult> GetTicket(long id)
        {
            var currentUser = await userRepository.GetCurrentUser();
            if (currentUser == null) return Unauthorized();

            var ticket = await FindAuthorizedTicket(id, currentUser.Id, User.IsInRole("Admin"));
            if (ticket == null) return NotFound(new { message = "Support ticket not found" });

            if (ticket.ConversationId.HasValue)
            {
                await messageRepository.MarkConversationAsRead(ticket.ConversationId.Value, currentUser.Id);
            }

            return Ok(new { success = true, data = MapTicketDetail(ticket, currentUser.Id) });
        }

        [HttpPost("tickets/{id:long}/reply")]
        public async Task<IActionResult> Reply(long id, [FromBody] ReplyToSupportTicketDto request)
        {
            var content = request.Message?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(content) || content.Length > MaxMessageLength)
            {
                return BadRequest(new { message = "Reply is required and must be 5,000 characters or fewer." });
            }

            var currentUser = await userRepository.GetCurrentUser();
            if (currentUser == null) return Unauthorized();

            var ticket = await FindAuthorizedTicket(id, currentUser.Id, User.IsInRole("Admin"));
            if (ticket == null) return NotFound(new { message = "Support ticket not found" });
            if (!ticket.ConversationId.HasValue)
            {
                return Conflict(new { message = "This legacy request does not have a reply thread. Please create a new support ticket." });
            }

            var message = await messageRepository.AddMessage(
                new AddMessageDto { ConversationId = ticket.ConversationId.Value, Content = content },
                currentUser.Id);

            ticket.LastActivityAt = DateTime.UtcNow;
            if (ticket.IsResolved)
            {
                ticket.IsResolved = false;
                ticket.ResolvedAt = null;
            }
            await context.SaveChangesAsync();

            var recipients = await context.ConversationParticipants
                .Where(participant => participant.ConversationId == ticket.ConversationId && !participant.IsDeleted && participant.UserId != currentUser.Id)
                .Select(participant => participant.UserId)
                .Distinct()
                .ToListAsync();

            foreach (var recipientId in recipients)
            {
                try
                {
                    await notificationService.CreateNotification(new CreateNotificationDto
                    {
                        UserId = recipientId,
                        OrganizationId = ticket.Conversation?.OrganizationId,
                        Type = ENotificationType.Support,
                        Title = $"Reply on support ticket {ticket.TicketNumber}",
                        Message = content.Length > 140 ? content[..140] + "…" : content,
                        RelatedId = ticket.Id,
                        SendEmail = true,
                        PerformedByUserId = currentUser.Id,
                        PerformedByName = $"{currentUser.Firstname} {currentUser.Lastname}".Trim()
                    });
                }
                catch (Exception notificationException)
                {
                    logger.LogError(notificationException, "Reply notification failed for support ticket {TicketNumber} and user {UserId}", ticket.TicketNumber, recipientId);
                }
            }

            return Ok(new { success = true, data = message, message = "Reply sent" });
        }

        [HttpPut("tickets/{id:long}/status")]
        public async Task<IActionResult> UpdateStatus(long id, [FromBody] UpdateSupportTicketStatusDto request)
        {
            var currentUser = await userRepository.GetCurrentUser();
            if (currentUser == null) return Unauthorized();

            var ticket = await FindAuthorizedTicket(id, currentUser.Id, User.IsInRole("Admin"));
            if (ticket == null) return NotFound(new { message = "Support ticket not found" });

            ticket.IsResolved = request.IsResolved;
            ticket.ResolvedAt = request.IsResolved ? DateTime.UtcNow : null;
            ticket.LastActivityAt = DateTime.UtcNow;
            await context.SaveChangesAsync();

            return Ok(new { success = true, message = request.IsResolved ? "Ticket closed" : "Ticket reopened" });
        }

        private async Task<SupportAndFeedback?> FindAuthorizedTicket(long id, long currentUserId, bool isAdmin)
        {
            var hasOrganization = TryGetOrganizationId(out var organizationId);
            return await context.SupportAndFeedbacks
                .Include(ticket => ticket.User)
                .Include(ticket => ticket.Conversation)
                    .ThenInclude(conversation => conversation!.Messages)
                        .ThenInclude(message => message.Sender)
                            .ThenInclude(sender => sender.UserRoles)
                                .ThenInclude(userRole => userRole.Role)
                .Include(ticket => ticket.Conversation)
                    .ThenInclude(conversation => conversation!.Messages)
                        .ThenInclude(message => message.ReadReceipts)
                .FirstOrDefaultAsync(ticket => ticket.Id == id &&
                    (isAdmin || (ticket.UserId == currentUserId &&
                        (!hasOrganization || ticket.ConversationId == null || ticket.Conversation!.OrganizationId == organizationId))));
        }

        private bool TryGetOrganizationId(out long organizationId)
        {
            if (HttpContext.Items.TryGetValue("OrganizationId", out var value) && value is long id)
            {
                organizationId = id;
                return true;
            }

            organizationId = default;
            return false;
        }

        private static SupportTicketDetailDto MapTicketDetail(SupportAndFeedback ticket, long currentUserId)
        {
            var messages = ticket.Conversation?.Messages
                .Where(message => !message.IsDeleted)
                .OrderBy(message => message.CreatedAt)
                .Select(message => new SupportTicketMessageDto
                {
                    Id = message.Id,
                    SenderId = message.SenderId,
                    SenderName = $"{message.Sender.FirstName} {message.Sender.LastName}".Trim(),
                    Content = message.Content,
                    CreatedAt = message.CreatedAt,
                    IsFromSupport = message.Sender.UserRoles.Any(userRole => userRole.Role.RoleName.ToLower() == "admin"),
                    IsRead = message.SenderId == currentUserId || message.ReadReceipts.Any(read => read.UserId == currentUserId)
                })
                .ToList() ?? [];

            return new SupportTicketDetailDto
            {
                Id = ticket.Id,
                TicketNumber = ticket.TicketNumber,
                Type = ticket.Type,
                SubType = ticket.SubType,
                Subject = ticket.Subject,
                Message = ticket.Message,
                CreatedAt = ticket.CreatedAt,
                LastActivityAt = ticket.LastActivityAt,
                ResolvedAt = ticket.ResolvedAt,
                IsResolved = ticket.IsResolved,
                IsFavorite = ticket.IsFavorite,
                ConversationId = ticket.ConversationId,
                LastMessageBy = ticket.Conversation?.LastMessageBy,
                MessageCount = messages.Count,
                UnreadCount = 0,
                CanReply = ticket.ConversationId.HasValue,
                UserId = ticket.UserId,
                UserName = $"{ticket.User.FirstName} {ticket.User.LastName}".Trim(),
                UserEmail = ticket.User.Email,
                Messages = messages
            };
        }
    }
}
