namespace brownstone_hub_api.Dtos.Announcement
{
    public class SendAnnouncementDto
    {
        public List<long>? OrganizationIds { get; set; }
        public List<long>? PropertyIds { get; set; }
        public List<long>? UnitIds { get; set; }
        public string Message { get; set; } = string.Empty;
        public bool SendEmail { get; set; } = false;
        public bool SendNotification { get; set; } = true;
        public DateTime? ScheduledAt { get; set; }
        public long? Id { get; set; } // For editing existing announcements
    }
}
