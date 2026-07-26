using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.LeaseGenerationService;

public interface IStateRequiredDisclosureService
{
    Task<ServiceResponse<StateRequiredDisclosureResult>> GenerateAsync(
        string state,
        CancellationToken cancellationToken = default);
}

public sealed class StateRequiredDisclosureResult
{
    public string StateCode { get; init; } = string.Empty;
    public string PlainText { get; init; } = string.Empty;
    public DateTime SnapshotUtc { get; init; }
    public IReadOnlyList<StateRequiredDisclosureCitation> Citations { get; init; } = [];
}

public sealed class StateRequiredDisclosureCitation
{
    public long SectionId { get; init; }
    public string SectionCode { get; init; } = string.Empty;
    public string? SectionTitle { get; init; }
    public string Url { get; init; } = string.Empty;
}

// Public because IOpenAIService's typed abstraction is also the test seam.
public sealed class StateDisclosureAiResult
{
    public bool DeterminationComplete { get; set; }
    public List<StateDisclosureAiItem>? Disclosures { get; set; }
    public List<StateDisclosureAiEvidence>? Evidence { get; set; }
}

public sealed class StateDisclosureAiItem
{
    public string? Quote { get; set; }
    public StateDisclosureAiCitation? Citation { get; set; }
}

public sealed class StateDisclosureAiEvidence
{
    public string? Quote { get; set; }
    public StateDisclosureAiCitation? Citation { get; set; }
}

public sealed class StateDisclosureAiCitation
{
    public long SectionId { get; set; }
    public string? SectionCode { get; set; }
    public string? Url { get; set; }
}
