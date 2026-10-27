using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.ShortStay;

// Entire document replacement. No access credentials, contact details, occupancy or financial fields.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record SaveShortStayGuidebookDraftDto(string? HouseRules, string? ArrivalOverview, string? LocalNotes);

public sealed record ShortStayGuidebookDraftDto(long UnitId, string? HouseRules, string? ArrivalOverview, string? LocalNotes);
