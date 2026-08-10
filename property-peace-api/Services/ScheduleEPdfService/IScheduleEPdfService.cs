namespace brownstone_hub_api.Services.ScheduleEPdfService
{
    public interface IScheduleEPdfService
    {
        Task<ServiceResponse<byte[]>> GenerateScheduleEPdfAsync(long organizationId, long authorizedUserId, int year, bool perProperty = false);
    }
}
