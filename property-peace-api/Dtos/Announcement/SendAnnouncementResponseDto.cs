namespace brownstone_hub_api.Dtos.Announcement
{
    public class SendAnnouncementResponseDto
    {
        public long AnnouncementId { get; set; }
        public int SentCount { get; set; }
        public int FailedCount { get; set; }
    }
}
