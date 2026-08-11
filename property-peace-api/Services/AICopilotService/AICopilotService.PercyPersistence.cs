using brownstone_hub_api.Dtos.AICopilot;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.PercyActions;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace brownstone_hub_api.Services.AICopilotService
{
    public partial class AICopilotService
    {
        public async Task<ServiceResponse<List<PercyConversationSummaryDto>>> ListConversationsAsync(
            long organizationId, long userId, bool includeArchived = false, CancellationToken cancellationToken = default)
        {
            var sensitiveValues = await LoadOrganizationSensitiveValuesAsync(organizationId, cancellationToken);
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
            {
                conversation.Title = PercyDataBoundary.Redact(conversation.Title,
                    PercyRedactionProfile.GeneratedOutput, sensitiveValues, PercyDataBoundary.MaxLabelLength).Text;
                conversation.LastMessagePreview = PercyDataBoundary.Redact(conversation.LastMessagePreview,
                    PercyRedactionProfile.GeneratedOutput, sensitiveValues, 180).Text;
            }

            return ServiceResponse<List<PercyConversationSummaryDto>>.CreateSuccess(conversations);
        }

        public async Task<ServiceResponse<PercyConversationDto>> GetConversationAsync(
            long organizationId, long userId, long conversationId, CancellationToken cancellationToken = default)
        {
            var sensitiveValues = await LoadOrganizationSensitiveValuesAsync(organizationId, cancellationToken);
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

            conversation.Title = PercyDataBoundary.Redact(conversation.Title,
                PercyRedactionProfile.GeneratedOutput, sensitiveValues, PercyDataBoundary.MaxLabelLength).Text;
            foreach (var message in conversation.Messages)
                SanitizeStoredMessage(message, sensitiveValues);

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

            var sensitiveValues = await LoadOrganizationSensitiveValuesAsync(organizationId, cancellationToken);

            if (confirmation.Status != "pending")
            {
                await PersistConfirmationReplayAuditAsync(confirmation, organizationId, userId, cancellationToken);
                return ServiceResponse<PercyConfirmationResultDto>.CreateSuccess(ToConfirmationResult(confirmation,
                    confirmation.ResolutionMessage ?? "This request has already been resolved.", sensitiveValues));
            }

            var authorization = await AuthorizePercyActionAsync(
                confirmation.ActionType, organizationId, userId, cancellationToken);
            var now = DateTime.UtcNow;
            string outcome;
            string message;
            if (!authorization.Action.IsKnown)
            {
                confirmation.Status = "denied";
                outcome = "rejected";
                message = "No action was run because this stored action is not supported.";
            }
            else if (!authorization.IsAuthorized)
            {
                confirmation.Status = "denied";
                outcome = "denied";
                message = "No action was run because current organization authority does not allow it.";
            }
            else if (!authorization.Action.ExecutionEnabled)
            {
                confirmation.Status = "failed";
                outcome = "unavailable";
                message = PercyActionErrorCodes.Unavailable;
            }
            else if (confirmation.ExpiresAt <= now)
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
                // Mutation executors remain disabled. An enabled read/draft action reaching a stored
                // confirmation is an invalid state and must not become an execution path.
                confirmation.Status = "failed";
                outcome = "no_executor";
                message = PercyActionErrorCodes.Unavailable;
            }

            confirmation.ResolvedAt = now;
            confirmation.ResolutionMessage = message;
            _dataContext.PercyAuditRecords.Add(new PercyAuditRecord
            {
                OrganizationId = organizationId,
                UserId = userId,
                ConversationId = confirmation.ConversationId,
                ConfirmationId = confirmation.Id,
                EventKey = $"confirmation-terminal:{confirmation.Id}",
                EventType = confirm ? "confirmation_confirmed" : "confirmation_declined",
                Outcome = outcome,
                Detail = PercyDataBoundary.Redact(message, PercyRedactionProfile.Audit).Text,
                CreatedAt = now
            });

            try
            {
                await _dataContext.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException)
            {
                // A row-version loss or the terminal audit's unique key can arbitrate simultaneous
                // resolution attempts. Only convert it to replay when another request is durably terminal.
                _dataContext.ChangeTracker.Clear();
                var current = await _dataContext.PercyActionConfirmations.AsNoTracking()
                    .SingleAsync(x => x.Id == confirmationId && x.OrganizationId == organizationId && x.UserId == userId, cancellationToken);
                if (current.Status == "pending") throw;
                await PersistConfirmationReplayAuditAsync(current, organizationId, userId, cancellationToken);
                return ServiceResponse<PercyConfirmationResultDto>.CreateSuccess(ToConfirmationResult(current,
                    current.ResolutionMessage ?? "This request was resolved by another request.", sensitiveValues));
            }

            return ServiceResponse<PercyConfirmationResultDto>.CreateSuccess(ToConfirmationResult(confirmation, message,
                sensitiveValues));
        }

        private async Task PersistConfirmationReplayAuditAsync(PercyActionConfirmation confirmation,
            long organizationId, long userId, CancellationToken cancellationToken)
        {
            _dataContext.PercyAuditRecords.Add(new PercyAuditRecord
            {
                OrganizationId = organizationId,
                UserId = userId,
                ConversationId = confirmation.ConversationId,
                ConfirmationId = confirmation.Id,
                EventKey = $"confirmation-replay:{confirmation.Id}:{Guid.NewGuid():N}",
                EventType = "confirmation_replay",
                Outcome = "already_resolved",
                Detail = "confirmation replay attempt; payload=redacted",
                CreatedAt = DateTime.UtcNow
            });
            await _dataContext.SaveChangesAsync(cancellationToken);
        }

        private async Task<PercyActionAuthorization> AuthorizePercyActionAsync(
            string? actionType, long organizationId, long userId, CancellationToken cancellationToken)
        {
            var organization = await _dataContext.Organizations
                .AsNoTracking()
                .Where(x => x.Id == organizationId)
                .Select(x => new OrganizationAuthorityFacts(x.Id, true, x.IsActive, x.IsDeleted))
                .SingleOrDefaultAsync(cancellationToken)
                ?? new OrganizationAuthorityFacts(organizationId, false, false, false);

            var member = await _dataContext.OrganizationMembers
                .AsNoTracking()
                .Where(x => x.OrganizationId == organizationId && x.UserId == userId)
                .Select(x => new
                {
                    x.OrganizationId,
                    x.IsActive,
                    x.Role,
                    x.CanManageProperties,
                    x.CanManageTenants,
                    x.CanManageLeases,
                    x.CanManageMaintenance,
                    x.CanManageBilling,
                    x.CanManageMembers
                })
                .SingleOrDefaultAsync(cancellationToken);

            var membership = member is null
                ? new OrganizationMembershipFacts(
                    organizationId, MembershipState.Missing, null, null, Array.Empty<OrganizationPermission>())
                : new OrganizationMembershipFacts(
                    member.OrganizationId,
                    member.IsActive ? MembershipState.Active : MembershipState.Inactive,
                    ParsePercyRole(member.Role),
                    member.Role,
                    PercyPermissions(
                        member.CanManageProperties,
                        member.CanManageTenants,
                        member.CanManageLeases,
                        member.CanManageMaintenance,
                        member.CanManageBilling,
                        member.CanManageMembers));

            return PercyActionPolicy.Authorize(actionType, organization, membership);
        }

        private static OrganizationRole? ParsePercyRole(string? role) =>
            Enum.TryParse<OrganizationRole>(role, ignoreCase: true, out var parsed) && Enum.IsDefined(parsed)
                ? parsed
                : null;

        private static IReadOnlyCollection<OrganizationPermission> PercyPermissions(
            bool properties, bool tenants, bool leases, bool maintenance, bool billing, bool members)
        {
            var permissions = new List<OrganizationPermission>(6);
            if (properties) permissions.Add(OrganizationPermission.ManageProperties);
            if (tenants) permissions.Add(OrganizationPermission.ManageTenants);
            if (leases) permissions.Add(OrganizationPermission.ManageLeases);
            if (maintenance) permissions.Add(OrganizationPermission.ManageMaintenance);
            if (billing) permissions.Add(OrganizationPermission.ManageBilling);
            if (members) permissions.Add(OrganizationPermission.ManageMembers);
            return permissions;
        }

        private static PercyConfirmationResultDto ToConfirmationResult(
            PercyActionConfirmation confirmation, string message, IEnumerable<string?> exactSensitiveValues)
        {
            string Safe(string? value, int length) => PercyDataBoundary.Redact(value,
                PercyRedactionProfile.GeneratedOutput, exactSensitiveValues, length).Text;
            return new PercyConfirmationResultDto
            {
                Id = confirmation.Id,
                ActionLabel = Safe(confirmation.FriendlyLabel, PercyDataBoundary.MaxLabelLength),
                Status = Safe(confirmation.Status, PercyDataBoundary.MaxLabelLength),
                Message = Safe(message, PercyDataBoundary.MaxStatusLength)
            };
        }

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
                target.Sources = response.Sources;
                target.PendingConfirmation = response.PendingConfirmation;
            }
            catch (JsonException)
            {
                // Content remains available if old metadata cannot be read.
            }
        }

        private static void SanitizeStoredMessage(PercyStoredMessageDto target, IEnumerable<string?> exactSensitiveValues)
        {
            var response = new PercyChatResponseDto
            {
                Content = target.Content,
                ActivityLabel = target.ActivityLabel,
                ActivityStatus = target.ActivityStatus,
                Metrics = target.Metrics,
                Items = target.Items,
                Sources = target.Sources,
                PendingConfirmation = target.PendingConfirmation
            };
            PercyDataBoundary.SanitizeResponse(response, exactSensitiveValues);
            target.Content = response.Content;
            target.ActivityLabel = response.ActivityLabel;
            target.ActivityStatus = response.ActivityStatus;
            target.Metrics = response.Metrics;
            target.Items = response.Items;
            target.Sources = response.Sources;
            target.PendingConfirmation = response.PendingConfirmation;
        }

        private async Task<List<string?>> LoadOrganizationSensitiveValuesAsync(
            long organizationId, CancellationToken cancellationToken)
        {
            var properties = await _dataContext.Properties.AsNoTracking()
                .Where(x => x.OrganizationId == organizationId && !x.IsDeleted)
                .OrderBy(x => x.Id)
                .Take(60)
                .Select(x => new { x.Name, x.StreetAddress, x.City, x.State, x.ZipCode })
                .ToListAsync(cancellationToken);
            var unitAddresses = await _dataContext.Units.AsNoTracking()
                .Where(x => x.Property.OrganizationId == organizationId && !x.Property.IsDeleted)
                .OrderBy(x => x.Id)
                .Take(80)
                .Select(x => new { x.Name, x.Property.StreetAddress })
                .ToListAsync(cancellationToken);
            var tenants = await _dataContext.Tenants.AsNoTracking()
                .Where(x => x.OrganizationId == organizationId && !x.IsDeleted)
                .OrderBy(x => x.Id)
                .Take(140)
                .Select(x => new { x.Firstname, x.Lastname })
                .ToListAsync(cancellationToken);
            var applicants = await _dataContext.RentalApplications.AsNoTracking()
                .Where(x => x.OrganizationId == organizationId)
                .OrderBy(x => x.Id)
                .Take(100)
                .Select(x => new { x.FirstName, x.LastName, x.CurrentAddress })
                .ToListAsync(cancellationToken);

            var values = new List<string?>();
            foreach (var property in properties)
            {
                values.Add(property.Name);
                values.Add(property.StreetAddress);
                values.Add(string.Join(", ", new[] { property.StreetAddress, property.City, property.State, property.ZipCode }
                    .Where(x => !string.IsNullOrWhiteSpace(x))));
            }
            values.AddRange(unitAddresses.Select(x =>
                string.IsNullOrWhiteSpace(x.Name) ? x.StreetAddress : $"{x.StreetAddress}, Unit {x.Name}"));
            values.AddRange(tenants.Select(x => $"{x.Firstname} {x.Lastname}".Trim()));
            values.AddRange(applicants.Select(x => $"{x.FirstName} {x.LastName}".Trim()));
            values.AddRange(applicants.Select(x => x.CurrentAddress));
            return PercyDataBoundary.BuildBoundedSensitiveValues(values);
        }

        private static string? Truncate(string? value, int length) =>
            string.IsNullOrEmpty(value) || value.Length <= length ? value : value[..length] + "…";
    }
}
