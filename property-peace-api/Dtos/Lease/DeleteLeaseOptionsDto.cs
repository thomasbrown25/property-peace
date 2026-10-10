namespace brownstone_hub_api.Dtos.Lease;

/// <summary>Optional cleanup when hiding a lease. Omitted flags preserve related records.</summary>
public sealed class DeleteLeaseOptionsDto
{
    /// <summary>Soft-delete lease-linked tenant documents and Files metadata; blobs are retained.</summary>
    public bool DeleteLeaseDocuments { get; set; }

    /// <summary>Remove lease-linked checklists and their items; photo blobs are retained.</summary>
    public bool DeleteChecklists { get; set; }
}
