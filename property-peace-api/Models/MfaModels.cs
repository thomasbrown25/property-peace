namespace brownstone_hub_api.Models;

public enum MfaMethod { Sms, Totp }
public enum MfaChallengePurpose { Enrollment, Login }

public class MfaEnrollment
{
    public long Id { get; set; }
    public long UserId { get; set; }
    public MfaMethod Method { get; set; }
    public bool IsEnabled { get; set; }
    public string? PhoneNumber { get; set; }
    public string? ProtectedSecret { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public User User { get; set; } = null!;
}

public class MfaChallenge
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public long UserId { get; set; }
    public long? EnrollmentId { get; set; }
    public MfaMethod Method { get; set; }
    public MfaChallengePurpose Purpose { get; set; }
    public string? CodeHash { get; set; }
    public string? CodeSalt { get; set; }
    public string? PendingValueProtected { get; set; }
    public DateTime ExpiresAt { get; set; }
    public int FailedAttempts { get; set; }
    public int MaximumAttempts { get; set; }
    public DateTime? UsedAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public User User { get; set; } = null!;
    public MfaEnrollment? Enrollment { get; set; }
}
