namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Co-signer on a lease (must sign the document but is not a tenant).
    /// </summary>
    public class LeaseCoSigner
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public Lease Lease { get; set; } = null!;

        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;

        public int SortOrder { get; set; }
    }
}
