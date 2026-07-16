namespace brownstone_hub_api.Dtos.ClientStatement
{
    public class GenerateClientStatementRequestDto
    {
        public long ClientId { get; set; }
        public long? PropertyId { get; set; } // Optional: generate for a specific property
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
    }
}
