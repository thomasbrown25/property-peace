using System.Text.Json;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.AspNetCore.DataProtection;

namespace brownstone_hub_api.Services.Leads;

public sealed record LeadTokenDeliveryMessage(long OrganizationId, long LeadId, string Destination,
    LeadTokenPurpose Purpose, string Token, DateTime CreatedAtUtc);

/// <summary>
/// Adds a delivery to the caller's unit of work. Implementations must not save independently so the
/// credential hash, business mutation, and outbox intent commit atomically.
/// </summary>
public interface ILeadTokenDelivery
{
    ValueTask QueueAsync(LeadTokenDeliveryMessage message, CancellationToken ct);
}

public sealed class ProtectedLeadTokenDelivery(DataContext db, IDataProtectionProvider protectionProvider)
    : ILeadTokenDelivery
{
    private readonly IDataProtector protector = protectionProvider.CreateProtector("lead-token-delivery-v1");

    public ValueTask QueueAsync(LeadTokenDeliveryMessage message, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        var payload = JsonSerializer.Serialize(new { message.Purpose, message.Token });
        db.LeadTokenDeliveries.Add(new LeadTokenDelivery
        {
            OrganizationId = message.OrganizationId,
            LeadId = message.LeadId,
            Destination = message.Destination,
            Purpose = message.Purpose,
            ProtectedPayload = protector.Protect(payload),
            Status = NotificationIntentStatus.Pending,
            CreatedAtUtc = message.CreatedAtUtc
        });
        return ValueTask.CompletedTask;
    }
}
