using System.Net;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.Conversations;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.MessageDeliveries;

public interface IOutboundMessageDeliveryEnqueuer
{
    Task EnqueueAsync(AddMessageDto request, LoadMessageDto savedMessage, CancellationToken cancellationToken = default);
}

/// <summary>Builds the external fan-out only from trusted persisted conversation/message state.</summary>
public sealed class OutboundMessageDeliveryEnqueuer(
    DataContext context,
    IConversationRepository conversations,
    IMessageDeliveryService deliveries) : IOutboundMessageDeliveryEnqueuer
{
    public async Task EnqueueAsync(AddMessageDto request, LoadMessageDto savedMessage, CancellationToken cancellationToken = default)
    {
        var correlation = await context.ConversationTimelineEntries.AsNoTracking()
            .Where(x => x.MessageId == savedMessage.Id && x.Producer == "message-api")
            .Select(x => new { x.Id, x.OrganizationId, x.EventId })
            .SingleAsync(cancellationToken);
        var conversation = await conversations.GetConversationById(savedMessage.ConversationId, savedMessage.SenderId)
            ?? throw new KeyNotFoundException("Conversation was not found while enqueueing delivery.");

        var targets = new List<DeliveryTarget>();
        if (savedMessage.SenderId == conversation.LandlordId &&
            !string.IsNullOrWhiteSpace(conversation.LandlordSmsNumber) &&
            !string.IsNullOrWhiteSpace(conversation.TenantPhoneNumber))
        {
            targets.Add(new DeliveryTarget(MessageDeliveryChannel.Sms, null,
                conversation.TenantPhoneNumber, savedMessage.Content, FromAddress: conversation.LandlordSmsNumber));
        }

        var hasTenantUserParticipant = conversation.Participants.Any(p =>
            p.UserId != savedMessage.SenderId && p.IsActive);
        if (!string.IsNullOrWhiteSpace(conversation.TenantEmail) && !hasTenantUserParticipant)
        {
            var title = string.IsNullOrWhiteSpace(conversation.Title) ? "Property Peace message" : conversation.Title;
            var sender = string.IsNullOrWhiteSpace(savedMessage.SenderName) ? "Your landlord" : savedMessage.SenderName;
            var subject = $"New message about {title} [PP-C{savedMessage.ConversationId}]";
            var html = $"<p>{WebUtility.HtmlEncode(sender)} sent you a message in Property Peace.</p>" +
                       $"<p><strong>{WebUtility.HtmlEncode(title)}</strong></p>" +
                       $"<blockquote>{WebUtility.HtmlEncode(savedMessage.Content).Replace("\n", "<br />")}</blockquote>";
            targets.Add(new DeliveryTarget(MessageDeliveryChannel.Email, null, conversation.TenantEmail,
                savedMessage.Content, subject, html));
        }

        if (targets.Count == 0) return;
        // Replays execute this too: CreateAsync returns the matching set or repairs a prior request that
        // saved the message before this synchronous durable enqueue completed.
        await deliveries.CreateAsync(correlation.OrganizationId, savedMessage.ConversationId, correlation.Id,
            savedMessage.Id, $"message:{correlation.EventId}:external", targets, cancellationToken);
    }
}
