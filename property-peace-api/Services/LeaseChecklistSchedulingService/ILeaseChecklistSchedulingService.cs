namespace brownstone_hub_api.Services.LeaseChecklistSchedulingService
{
    public interface ILeaseChecklistSchedulingService
    {
        Task ProcessDueChecklistsAsync(DateTime? asOfDate = null);
    }
}
