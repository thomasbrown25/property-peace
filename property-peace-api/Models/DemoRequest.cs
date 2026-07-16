namespace brownstone_hub_api.Models
{
    public class DemoRequest
    {
        public long Id { get; set; }
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public string CompanyName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Phone { get; set; } = string.Empty;
        public string NumberOfUnits { get; set; } = string.Empty;
        public string HowCanWeHelp { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        // Calendly integration fields (optional - can be updated later when calendar event is scheduled)
        public string? CalendlyEventUri { get; set; } // Calendly event URI if scheduled
        public DateTime? ScheduledDateTime { get; set; } // When the demo is scheduled
        public string? CalendlyInviteeUri { get; set; } // Calendly invitee URI
    }
}
