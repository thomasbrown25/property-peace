namespace brownstone_hub_api.Services.AdvertisingConversions;

public interface IRegistrationConversionReporter
{
    Task<RegistrationConversionReportResult> ReportCompletedRegistrationAsync(
        long userId,
        string? oppref,
        CancellationToken cancellationToken = default);
}

public enum RegistrationConversionReportResult
{
    Sent,
    NotConfigured,
    NotEligible,
    InvalidClickReference,
    DeliveryFailed
}
