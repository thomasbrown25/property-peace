namespace brownstone_hub_api.Dtos.Announcement
{
    public class LoadAnnouncementDto
    {
        public long Id { get; set; }
        public long OrganizationId { get; set; }
        public string OrganizationName { get; set; } = string.Empty;
        public long CreatedByUserId { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public string? FormattedMessage { get; set; }
        public bool SendAsNotification { get; set; }
        public bool SendAsEmail { get; set; }
        public int SentCount { get; set; }
        public int FailedCount { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? ScheduledAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? OrganizationIds { get; set; } // JSON array of organization IDs
        public string? PropertyIds { get; set; } // JSON array of property IDs
        public string? UnitIds { get; set; } // JSON array of unit IDs
    }
}
