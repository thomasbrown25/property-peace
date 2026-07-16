using brownstone_hub_api.Dtos.AgentFollowUp;

namespace brownstone_hub_api.Services.AgentFollowUpService
{
    public interface IAgentFollowUpService
    {
        /// <summary>
        /// Sweeps all organizations for overdue rent and autonomously sends AI-written follow-ups.
        /// Returns a summary of what was reviewed and acted on.
        /// </summary>
        Task<CollectionsSweepResultDto> RunOverdueRentSweepAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Forces a follow-up for a specific lease, bypassing suppression.
        /// When tenantIds are provided, the Collections Agent writes and sends a separate personalized message to each selected tenant.
        /// </summary>
        Task<int> ForceFollowUpForLeaseAsync(long leaseId, IEnumerable<long>? tenantIds = null, CancellationToken cancellationToken = default);

        /// <summary>
        /// Returns paginated Collections Agent action history for the given organization.
        /// </summary>
        Task<CollectionsHistoryPageDto> GetCollectionsHistoryAsync(long orgId, int page, int pageSize, CancellationToken cancellationToken = default);

        /// <summary>
        /// Returns lightweight agent stats for the dashboard summary card.
        /// </summary>
        Task<AgentDashboardSummaryDto> GetAgentDashboardSummaryAsync(long orgId, CancellationToken cancellationToken = default);
    }
}
