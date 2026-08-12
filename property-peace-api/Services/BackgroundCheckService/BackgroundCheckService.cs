using brownstone_hub_api.Helpers;

namespace brownstone_hub_api.Services.BackgroundCheckService;

/// <summary>
/// Retained only for compatibility with callers of the retired application endpoints.
/// Tenant screening is owned by <c>/api/screenings</c>; this service always fails closed.
/// </summary>
public interface IBackgroundCheckService
{
    Task<ServiceResponse<BackgroundCheckResultDto>> RequestBackgroundCheckAsync(
        long applicationId,
        string screeningPackage = "full");

    Task<ServiceResponse<BackgroundCheckResultDto>> GetBackgroundCheckStatusAsync(long applicationId);
}

public sealed class BackgroundCheckService : IBackgroundCheckService
{
    public Task<ServiceResponse<BackgroundCheckResultDto>> RequestBackgroundCheckAsync(
        long applicationId,
        string screeningPackage = "full") => Unavailable();

    public Task<ServiceResponse<BackgroundCheckResultDto>> GetBackgroundCheckStatusAsync(long applicationId) =>
        Unavailable();

    private static Task<ServiceResponse<BackgroundCheckResultDto>> Unavailable() =>
        Task.FromResult(ServiceResponse<BackgroundCheckResultDto>.CreateError(
            "Legacy screening unavailable",
            "This screening path has been retired. Use /api/screenings.",
            "",
            StatusCodes.Status410Gone));
}

public sealed class BackgroundCheckResultDto
{
    public string Message { get; set; } = "This screening path has been retired. Use /api/screenings.";
}
