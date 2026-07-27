namespace brownstone_hub_api.Dtos.Announcement
{
    public class PreviewAnnouncementRecipientsDto
    {
        public List<long>? OrganizationIds { get; set; }
        public List<long>? PropertyIds { get; set; }
        public List<long>? UnitIds { get; set; }
    }

    public class AnnouncementRecipientPreviewDto
    {
        public long UserId { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }
}
