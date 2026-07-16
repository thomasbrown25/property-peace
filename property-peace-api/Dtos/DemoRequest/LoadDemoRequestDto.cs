namespace brownstone_hub_api.Dtos.DemoRequest
{
    public class LoadDemoRequestDto
    {
        public long Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string NumberOfUnits { get; set; } = string.Empty;
        public string HowCanWeHelp { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public string? CalendlyEventUri { get; set; }
        public DateTime? ScheduledDateTime { get; set; }
        public string? CalendlyInviteeUri { get; set; }
    }
}
