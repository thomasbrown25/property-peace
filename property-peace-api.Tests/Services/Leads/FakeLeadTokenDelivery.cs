using brownstone_hub_api.Enums;
using brownstone_hub_api.Services.Leads;

namespace brownstone_hub_api.Tests.Services.Leads;

/// <summary>
/// Test-only delivery boundary. Secrets are captured here to model an out-of-band
/// delivery channel rather than exposing them through a public API response.
/// </summary>
internal sealed class FakeLeadTokenDelivery : ILeadTokenDelivery
{
    public List<LeadTokenDeliveryMessage> Messages { get; } = [];

    public ValueTask QueueAsync(LeadTokenDeliveryMessage message, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();
        Messages.Add(message);
        return ValueTask.CompletedTask;
    }

    public string TokenFor(long leadId, LeadTokenPurpose purpose) => Messages
        .Single(x => x.LeadId == leadId && x.Purpose == purpose).Token;
}
