using brownstone_hub_api.Dtos.Activation;

namespace brownstone_hub_api.Services.Activation;

public interface IActivationService
{
    Task<ActivationResponseDto> EvaluateAsync(
        long userId,
        long organizationId,
        CancellationToken cancellationToken = default);
}

public sealed class ActivationAccessDeniedException : Exception
{
    public ActivationAccessDeniedException() : base("Active organization membership is required.") { }
}
