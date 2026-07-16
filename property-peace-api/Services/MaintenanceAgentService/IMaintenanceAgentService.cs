using brownstone_hub_api.Dtos.MaintenanceAgent;

namespace brownstone_hub_api.Services.MaintenanceAgentService
{
    public interface IMaintenanceAgentService
    {
        Task<MaintenanceAgentChatResponseDto> ChatAsync(
            List<MaintenanceAgentMessageDto> messages,
            CancellationToken cancellationToken = default);
    }
}
