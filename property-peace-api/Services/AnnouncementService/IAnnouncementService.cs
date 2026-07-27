using brownstone_hub_api.Dtos.Announcement;

namespace brownstone_hub_api.Services.AnnouncementService
{
    public interface IAnnouncementService
    {
        Task<ServiceResponse<FormatMessageResponseDto>> FormatMessageAsync(FormatMessageDto dto);
        Task<ServiceResponse<List<AnnouncementRecipientPreviewDto>>> PreviewRecipientsAsync(PreviewAnnouncementRecipientsDto dto);
        Task<ServiceResponse<SendAnnouncementResponseDto>> SendAnnouncementAsync(SendAnnouncementDto dto);
        Task<ServiceResponse<List<LoadAnnouncementDto>>> GetAnnouncementsAsync(DateTime? fromDate, DateTime? toDate, long? organizationId = null, long? propertyId = null);
        Task<ServiceResponse<LoadAnnouncementDto>> GetAnnouncementByIdAsync(long id);
        Task<bool> SendScheduledAnnouncementAsync(long announcementId);
        Task<ServiceResponse<bool>> DeleteAnnouncementAsync(long id);
    }
}
