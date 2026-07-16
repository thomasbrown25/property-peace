namespace brownstone_hub_api.Dtos.Lease
{
    public class LeaseCoSignerDto
    {
        public long Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public int SortOrder { get; set; }
    }
}
