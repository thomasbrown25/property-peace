using brownstone_hub_api.Dtos.Sms;

namespace brownstone_hub_api.Services.CommunicationService
{
    public interface ICommunicationService
    {
        Task<ServiceResponse<SendSmsResponseDto>> SendSmsAsync(SendSmsDto request, CancellationToken cancellationToken = default);
        Task<ServiceResponse<SendBulkSmsResponseDto>> SendBulkSmsAsync(SendBulkSmsDto request, CancellationToken cancellationToken = default);
    }
}

