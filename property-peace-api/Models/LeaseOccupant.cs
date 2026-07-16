namespace brownstone_hub_api.Models
{
    /// <summary>
    /// Other occupant on a lease: someone who will live at the property but is not on the lease (e.g. minor, family member).
    /// </summary>
    public class LeaseOccupant
    {
        public long Id { get; set; }
        public long LeaseId { get; set; }
        public Lease Lease { get; set; } = null!;

        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string? Email { get; set; }

        public int SortOrder { get; set; }
    }
}
