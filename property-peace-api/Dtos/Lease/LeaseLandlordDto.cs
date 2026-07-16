namespace brownstone_hub_api.Dtos.Lease
{
    public class LeaseLandlordDto
    {
        public long Id { get; set; }
        public string EntityType { get; set; } = "Individual";
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? CompanyName { get; set; }
        public string? Email { get; set; }
        public string? Phone { get; set; }
        public string? StreetAddress { get; set; }
        public string? Unit { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? ZipCode { get; set; }
        public int SortOrder { get; set; }
    }
}
