namespace brownstone_hub_api.Services.AppleAuthService;

public sealed record AppleUserInfo(string Subject, string Email);

public interface IAppleAuthService
{
    Task<AppleUserInfo?> VerifyIdentityTokenAsync(string identityToken, string nonce, CancellationToken cancellationToken = default);
}
