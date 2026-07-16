using brownstone_hub_api.Dtos.AICopilot;

namespace brownstone_hub_api.Services.AIFollowUpService
{
    public interface IAIFollowUpService
    {
        Task<ServiceResponse<object>> SendAIFollowUpAsync(SendAIFollowUpDto request, long landlordId);
        Task<ServiceResponse<AIFollowUpPreviewDto>> PreviewAIFollowUpAsync(SendAIFollowUpDto request);

        /// <summary>
        /// Deliver a follow-up with pre-generated messages (used by the AI agent which writes its own copy).
        /// Skips all prompt generation and goes straight to conversation/email/notification/suppression.
        /// </summary>
        Task<ServiceResponse<object>> SendWithMessagesAsync(
            string actionType,
            long entityId,
            string inAppMessage,
            string emailMessage,
            int suppressionDays,
            long landlordId,
            long organizationId,
            long? tenantId = null,
            bool isManual = false);
    }
}
