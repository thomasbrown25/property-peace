using brownstone_hub_api.Models;

namespace brownstone_hub_api.Dtos.Mfa;

public sealed class MfaOptions
{
    public string Issuer { get; set; } = "Property Peace";
    public int ChallengeLifetimeMinutes { get; set; } = 5;
    public int MaximumAttempts { get; set; } = 5;
}

public sealed record MfaStatusDto(bool SmsEnabled, string? MaskedPhone, bool TotpEnabled);
public sealed record SmsEnrollmentRequest(string PhoneNumber);
public sealed record VerifyMfaRequest(Guid ChallengeId, string Code);
public sealed record MfaChallengeDto(Guid ChallengeId, MfaMethod Method, DateTime ExpiresAt, string? MaskedPhone, bool Success = true);
public sealed record TotpEnrollmentDto(Guid ChallengeId, string Secret, string OtpAuthUri);
public sealed record MfaEnrollmentResult(bool Success, bool Enabled, MfaError Error = MfaError.None);
public sealed record MfaVerificationResult(bool Success, long? UserId = null, MfaError Error = MfaError.None);
public enum MfaError { None, Invalid, Expired, Locked, Used, NotFound, DeliveryFailed }

public sealed class PasswordLoginResponseDto
{
    public bool Success { get; init; }
    public bool MfaRequired { get; init; }
    public MfaChallengeDto? Mfa { get; init; }
    public brownstone_hub_api.Dtos.User.LoadUserDto? Data { get; init; }
    public string? Message { get; init; }
}
