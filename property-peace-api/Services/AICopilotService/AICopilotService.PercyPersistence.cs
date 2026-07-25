using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace brownstone_hub_api.Services.AICopilotService
{
    public partial class AICopilotService
    {
        public async Task<ServiceResponse<List<PercyConversationSummaryDto>>> ListConversationsAsync(
            long organizationId, long userId, bool includeArchived = false, CancellationToken cancellationToken = default)
        {
            var conversations = await _dataContext.PercyConversations
                .AsNoTracking()
                .Where(x => x.OrganizationId == organizationId && x.UserId == userId)
                .Where(x => includeArchived || !x.IsArchived)
                .OrderByDescending(x => x.UpdatedAt)
                .Take(100)
                .Select(x => new PercyConversationSummaryDto
                {
                    Id = x.Id,
                    Title = x.Title,
                    CreatedAt = x.CreatedAt,
                    UpdatedAt = x.UpdatedAt,
                    IsArchived = x.IsArchived,
                    LastMessagePreview = x.Messages.OrderByDescending(m => m.CreatedAt).Select(m => m.Content).FirstOrDefault()
                })
                .ToListAsync(cancellationToken);

            foreach (var conversation in conversations)
                conversation.LastMessagePreview = Truncate(conversation.LastMessagePreview, 180);

            return ServiceResponse<List<PercyConversationSummaryDto>>.CreateSuccess(conversations);
        }

        public async Task<ServiceResponse<PercyConversationDto>> GetConversationAsync(
            long organizationId, long userId, long conversationId, CancellationToken cancellationToken = default)
        {
            var conversation = await _dataContext.PercyConversations
                .AsNoTracking()
                .Where(x => x.Id == conversationId && x.OrganizationId == organizationId && x.UserId == userId)
                .Select(x => new PercyConversationDto
                {
                    Id = x.Id,
                    Title = x.Title,
                    CreatedAt = x.CreatedAt,
                    UpdatedAt = x.UpdatedAt,
                    IsArchived = x.IsArchived,
                    Messages = x.Messages.OrderBy(m => m.CreatedAt).ThenBy(m => m.Id).Select(m => new PercyStoredMessageDto
                    {
                        Id = m.Id,
                        Role = m.Role,
                        Content = m.Content,
                        CreatedAt = m.CreatedAt
                    }).ToList()
                })
                .SingleOrDefaultAsync(cancellationToken);

            if (conversation == null)
                return ServiceResponse<PercyConversationDto>.CreateError("Conversation not found.", statusCode: 404);

            var storedMetadata = await _dataContext.PercyMessages
                .AsNoTracking()
                .Where(m => m.ConversationId == conversationId &&
                    m.Conversation.OrganizationId == organizationId && m.Conversation.UserId == userId &&
                    m.ResponseJson != null)
                .Select(m => new { m.Id, m.ResponseJson })
                .ToListAsync(cancellationToken);

            foreach (var stored in storedMetadata)
            {
                var message = conversation.Messages.Single(m => m.Id == stored.Id);
                ApplyResponseMetadata(message, stored.ResponseJson);
            }

            var confirmations = await _dataContext.PercyActionConfirmations
                .AsNoTracking()
                .Where(x => x.ConversationId == conversationId &&
                    x.OrganizationId == organizationId && x.UserId == userId)
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            foreach (var pending in conversation.Messages.Where(x => x.PendingConfirmation != null)
                .Select(x => x.PendingConfirmation!))
            {
                if (confirmations.TryGetValue(pending.Id, out var current))
                    pending.Status = current.Status;
            }

            return ServiceResponse<PercyConversationDto>.CreateSuccess(conversation);
        }

        public async Task<ServiceResponse<bool>> ArchiveConversationAsync(
            long organizationId, long userId, long conversationId, CancellationToken cancellationToken = default)
        {
            var conversation = await _dataContext.PercyConversations
                .SingleOrDefaultAsync(x => x.Id == conversationId && x.OrganizationId == organizationId && x.UserId == userId, cancellationToken);
            if (conversation == null)
                return ServiceResponse<bool>.CreateError("Conversation not found.", statusCode: 404);

            if (!conversation.IsArchived)
            {
                conversation.IsArchived = true;
                conversation.ArchivedAt = DateTime.UtcNow;
                conversation.UpdatedAt = DateTime.UtcNow;
                await _dataContext.SaveChangesAsync(cancellationToken);
            }
            return ServiceResponse<bool>.CreateSuccess(true, "Conversation archived.");
        }

        public Task<ServiceResponse<PercyConfirmationResultDto>> DeclineConfirmationAsync(
            long organizationId, long userId, long confirmationId, CancellationToken cancellationToken = default) =>
            ResolveConfirmationAsync(organizationId, userId, confirmationId, confirm: false, cancellationToken);

        public Task<ServiceResponse<PercyConfirmationResultDto>> ConfirmActionAsync(
            long organizationId, long userId, long confirmationId, CancellationToken cancellationToken = default) =>
            ResolveConfirmationAsync(organizationId, userId, confirmationId, confirm: true, cancellationToken);

        private async Task<ServiceResponse<PercyConfirmationResultDto>> ResolveConfirmationAsync(
            long organizationId, long userId, long confirmationId, bool confirm, CancellationToken cancellationToken)
        {
            var confirmation = await _dataContext.PercyActionConfirmations
                .SingleOrDefaultAsync(x => x.Id == confirmationId && x.OrganizationId == organizationId && x.UserId == userId, cancellationToken);
            if (confirmation == null)
                return ServiceResponse<PercyConfirmationResultDto>.CreateError("Confirmation not found.", statusCode: 404);

            if (confirmation.Status != "pending")
                return ServiceResponse<PercyConfirmationResultDto>.CreateSuccess(ToConfirmationResult(confirmation,
                    confirmation.ResolutionMessage ?? "This request has already been resolved."));

            var now = DateTime.UtcNow;
            string outcome;
            string message;
            if (confirmation.ExpiresAt <= now)
            {
                confirmation.Status = "expired";
                outcome = "expired";
                message = "This confirmation expired without running the action.";
            }
            else if (!confirm)
            {
                confirmation.Status = "declined";
                outcome = "declined";
                message = "The action was declined and was not run.";
            }
            else
            {
                // Percy never delegates a write decision to the model. Only immutable, server-issued action types
                // may reach this switch. There is currently no safe organization-scoped collections executor.
                switch (confirmation.ActionType)
                {
                    case PercyCollectionsFollowUpAction:
                        confirmation.Status = "failed";
                        outcome = "blocked";
                        message = "No messages were sent. Organization-scoped collections follow-up execution is not available yet.";
                        break;
                    default:
                        confirmation.Status = "failed";
                        outcome = "rejected";
                        message = "No action was run because this stored action is not supported.";
                        break;
                }
            }

            confirmation.ResolvedAt = now;
            confirmation.ResolutionMessage = message;
            _dataContext.PercyAuditRecords.Add(new PercyAuditRecord
            {
                OrganizationId = organizationId,
                UserId = userId,
                ConversationId = confirmation.ConversationId,
                ConfirmationId = confirmation.Id,
                EventType = confirm ? "confirmation_confirmed" : "confirmation_declined",
                Outcome = outcome,
                Detail = message,
                CreatedAt = now
            });

            try
            {
                await _dataContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                _dataContext.ChangeTracker.Clear();
                var current = await _dataContext.PercyActionConfirmations.AsNoTracking()
                    .SingleAsync(x => x.Id == confirmationId && x.OrganizationId == organizationId && x.UserId == userId, cancellationToken);
                return ServiceResponse<PercyConfirmationResultDto>.CreateSuccess(ToConfirmationResult(current,
                    current.ResolutionMessage ?? "This request was resolved by another request."));
            }

            return ServiceResponse<PercyConfirmationResultDto>.CreateSuccess(ToConfirmationResult(confirmation, message));
        }

        private static PercyConfirmationResultDto ToConfirmationResult(PercyActionConfirmation confirmation, string message) => new()
        {
            Id = confirmation.Id,
            ActionLabel = confirmation.FriendlyLabel,
            Status = confirmation.Status,
            Message = message
        };

        private static void ApplyResponseMetadata(PercyStoredMessageDto target, string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return;
            try
            {
                var response = JsonSerializer.Deserialize<PercyChatResponseDto>(json);
                if (response == null) return;
                target.ActivityLabel = response.ActivityLabel;
                target.ActivityStatus = response.ActivityStatus;
                target.Metrics = response.Metrics;
                target.Items = response.Items;
                target.PendingConfirmation = response.PendingConfirmation;
            }
            catch (JsonException)
            {
                // Content remains available if old metadata cannot be read.
            }
        }

        private static string? Truncate(string? value, int length) =>
            string.IsNullOrEmpty(value) || value.Length <= length ? value : value[..length] + "…";
    }
}
