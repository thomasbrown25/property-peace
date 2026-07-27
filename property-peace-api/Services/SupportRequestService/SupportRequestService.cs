using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Dtos.SupportRequest;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Conversations;
using brownstone_hub_api.Repositories.Messages;
using brownstone_hub_api.Repositories.Users;
using brownstone_hub_api.Services.NotificationService;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.SupportRequestService
{
    public class SupportRequestService(
        IConversationRepository conversationRepository,
        IMessageRepository messageRepository,
        IUserRepository userRepository,
        INotificationService notificationService,
        DataContext context,
        IHttpContextAccessor httpContextAccessor,
        ILogger<SupportRequestService> logger) : ISupportRequestService
    {
        private static readonly HashSet<string> SupportedCategories =
        [
            "tech-support", "general", "bug", "feature", "feedback"
        ];

        public async Task<ServiceResponse<SupportTicketSummaryDto>> SubmitSupportRequest(SubmitSupportRequestDto request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Type) ||
                    string.IsNullOrWhiteSpace(request.Subject) || string.IsNullOrWhiteSpace(request.Message))
                {
                    return ServiceResponse<SupportTicketSummaryDto>.CreateError(
                        "Type, subject, and message are required", statusCode: StatusCodes.Status400BadRequest);
                }

                var subject = request.Subject.Trim();
                var content = request.Message.Trim();
                if (subject.Length > 500 || content.Length > 5000)
                {
                    return ServiceResponse<SupportTicketSummaryDto>.CreateError(
                        "Subject must be 500 characters or fewer and message must be 5,000 characters or fewer.",
                        statusCode: StatusCodes.Status400BadRequest);
                }

                var currentUser = await userRepository.GetCurrentUser();
                if (currentUser == null)
                {
                    return ServiceResponse<SupportTicketSummaryDto>.CreateError(
                        "User not authenticated", statusCode: StatusCodes.Status401Unauthorized);
                }

                var normalizedType = request.Type.Trim().ToLowerInvariant();
                if (!SupportedCategories.Contains(normalizedType))
                {
                    return ServiceResponse<SupportTicketSummaryDto>.CreateError(
                        "Unsupported request type", "Choose general, tech-support, bug, feature, or feedback.", statusCode: StatusCodes.Status400BadRequest);
                }

                var adminUser = await context.Users
                    .Include(user => user.UserRoles)
                        .ThenInclude(userRole => userRole.Role)
                    .Where(user => !user.IsDeleted && user.UserRoles.Any(userRole => userRole.Role.RoleName.ToLower() == "admin"))
                    .OrderBy(user => user.Id)
                    .FirstOrDefaultAsync();

                if (adminUser == null)
                {
                    logger.LogWarning("A support ticket could not be created because no admin user exists");
                    return ServiceResponse<SupportTicketSummaryDto>.CreateError(
                        "Support is temporarily unavailable", "No support administrator is configured.", statusCode: StatusCodes.Status503ServiceUnavailable);
                }

                var categoryLabel = normalizedType switch
                {
                    "bug" => "Bug report",
                    "feature" => "Feature request",
                    "feedback" => "Product feedback",
                    "general" => "General question",
                    _ => "Technical support"
                };
                var ticketType = normalizedType is "bug" or "feature" or "feedback"
                    ? ESupportAndFeedbackType.Feedback
                    : ESupportAndFeedbackType.Support;

                long? organizationId = null;
                if (httpContextAccessor.HttpContext?.Items.TryGetValue("OrganizationId", out var organizationIdValue) == true &&
                    organizationIdValue is long currentOrganizationId)
                {
                    organizationId = currentOrganizationId;
                }

                await using var transaction = await context.Database.BeginTransactionAsync();

                var conversation = await conversationRepository.AddConversation(
                    new AddConversationDto
                    {
                        Title = $"Support: {request.Subject.Trim()}",
                        Description = categoryLabel,
                        IsGroupChat = false,
                        ForceNewConversation = true,
                        ParticipantUserIds = [adminUser.Id]
                    },
                    currentUser.Id,
                    organizationId);

                if (conversation == null)
                {
                    return ServiceResponse<SupportTicketSummaryDto>.CreateError(
                        "Support ticket could not be created", statusCode: StatusCodes.Status500InternalServerError);
                }

                var now = DateTime.UtcNow;
                var ticket = new SupportAndFeedback
                {
                    UserId = currentUser.Id,
                    Type = ticketType,
                    SubType = normalizedType,
                    Subject = subject,
                    Message = content,
                    CreatedAt = now,
                    LastActivityAt = now,
                    IsResolved = false,
                    TicketNumber = $"TMP-{Guid.NewGuid():N}"[..32],
                    ConversationId = conversation.Id
                };

                context.SupportAndFeedbacks.Add(ticket);
                await context.SaveChangesAsync();
                ticket.TicketNumber = $"PP-{ticket.CreatedAt:yyyy}-{ticket.Id:D6}";
                await context.SaveChangesAsync();

                await messageRepository.AddMessage(
                    new AddMessageDto { ConversationId = conversation.Id, Content = ticket.Message },
                    currentUser.Id);

                await transaction.CommitAsync();

                try
                {
                    await notificationService.CreateNotification(new CreateNotificationDto
                    {
                        UserId = adminUser.Id,
                        OrganizationId = organizationId,
                        Type = ENotificationType.Support,
                        Title = $"New support ticket {ticket.TicketNumber}",
                        Message = $"{currentUser.Firstname} {currentUser.Lastname}: {ticket.Subject}".Trim(),
                        RelatedId = ticket.Id,
                        SendEmail = true,
                        PerformedByUserId = currentUser.Id,
                        PerformedByName = $"{currentUser.Firstname} {currentUser.Lastname}".Trim()
                    });
                }
                catch (Exception notificationException)
                {
                    logger.LogError(notificationException, "Support ticket {TicketNumber} was created but its admin notification failed", ticket.TicketNumber);
                }

                return ServiceResponse<SupportTicketSummaryDto>.CreateSuccess(
                    new SupportTicketSummaryDto
                    {
                        Id = ticket.Id,
                        TicketNumber = ticket.TicketNumber,
                        Type = ticket.Type,
                        SubType = ticket.SubType,
                        Subject = ticket.Subject,
                        Message = ticket.Message,
                        CreatedAt = ticket.CreatedAt,
                        LastActivityAt = ticket.LastActivityAt,
                        IsResolved = false,
                        ConversationId = conversation.Id,
                        LastMessageBy = currentUser.Id,
                        MessageCount = 1,
                        CanReply = true,
                        UserId = currentUser.Id,
                        UserName = $"{currentUser.Firstname} {currentUser.Lastname}".Trim(),
                        UserEmail = currentUser.Email
                    },
                    $"Support ticket {ticket.TicketNumber} created successfully");
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Error creating support ticket");
                return ServiceResponse<SupportTicketSummaryDto>.CreateError(
                    "Support ticket could not be created", exception.Message, exception.InnerException?.Message);
            }
        }
    }
}
