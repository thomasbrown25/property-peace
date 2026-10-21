using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models;

// Stores only the private object key; any read URL/SAS is generated on demand, never persisted.
public sealed class ShortStayListingPhoto
{
    public long Id { get; set; }
    public long ShortStayListingId { get; set; }
    public ShortStayListing ShortStayListing { get; set; } = null!;
    [Required, MaxLength(512)]
    public string BlobName { get; set; } = null!;
    [Range(0, int.MaxValue)]
    public int DisplayOrder { get; set; }
    public bool IsCoverPhoto { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
