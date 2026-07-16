namespace brownstone_hub_api.Dtos.Listing;

/// <summary>Used when frontend sends fallback (negative-id) selections by name so backend can resolve to real ids.</summary>
public class AmenitySelectionDto
{
    public string Category { get; set; } = "";
    public string Name { get; set; } = "";
}
