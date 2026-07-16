using brownstone_hub_api.Dtos.MaintenanceAgent;

namespace brownstone_hub_api.Services.LandlordMaintenanceAgentService
{
    public interface ILandlordMaintenanceAgentService
    {
        Task<MaintenanceAgentChatResponseDto> ChatAsync(
            List<MaintenanceAgentMessageDto> messages,
            long? preselectedPropertyId = null,
            string? preselectedPropertyName = null,
            long? preselectedUnitId = null,
            string? preselectedUnitName = null,
            CancellationToken cancellationToken = default);
    }
}
