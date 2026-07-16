namespace brownstone_hub_api.Services.ApplicationPdfService
{
    public interface IApplicationPdfService
    {
        Task<byte[]> GenerateApplicationPdfAsync(Models.RentalApplication application);
        Task<string> SaveApplicationPdfToBlobAsync(byte[] pdfBytes, long applicationId, string applicantName);
    }
}

