namespace brownstone_hub_api.Services.ScheduleEPdfService
{
    public interface IScheduleEPdfService
    {
        Task<ServiceResponse<byte[]>> GenerateScheduleEPdfAsync(long landlordId, int year, bool perProperty = false);
    }
}
