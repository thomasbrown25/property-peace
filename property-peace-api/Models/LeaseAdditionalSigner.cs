namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Additional signer on a lease (non-tenant who must sign the document).
    /// </summary>
    public class LeaseAdditionalSigner
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
