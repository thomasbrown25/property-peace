using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Mfa;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.SmsService;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace brownstone_hub_api.Services.MfaService;

public interface IMfaService
{
    Task<MfaStatusDto> GetStatusAsync(long userId, CancellationToken ct);
    Task<bool> HasEnabledMfaAsync(long userId, CancellationToken ct);
    Task<MfaChallengeDto> BeginSmsEnrollmentAsync(long userId, string phoneNumber, CancellationToken ct);
    Task<TotpEnrollmentDto> BeginTotpEnrollmentAsync(long userId, CancellationToken ct);
    Task<MfaEnrollmentResult> VerifyEnrollmentAsync(long userId, Guid challengeId, string code, CancellationToken ct);
    Task DisableAsync(long userId, MfaMethod method, CancellationToken ct);
    Task<MfaChallengeDto> BeginLoginAsync(long userId, CancellationToken ct, MfaMethod? method = null);
    Task<MfaVerificationResult> VerifyLoginAsync(Guid challengeId, string code, CancellationToken ct);
}

public sealed class MfaService : IMfaService
{
    private readonly DataContext _db;
    private readonly ISmsService _sms;
    private readonly IDataProtector _protector;
    private readonly TimeProvider _clock;
    private readonly MfaOptions _options;
    private readonly ILogger<MfaService> _logger;

    public MfaService(DataContext db, ISmsService sms, IDataProtectionProvider protection,
        TimeProvider clock, IOptions<MfaOptions> options, ILogger<MfaService> logger)
    {
        _db = db;
        _sms = sms;
        _protector = protection.CreateProtector("PropertyPeace.Mfa.TotpSecret.v1");
        _clock = clock;
        _options = options.Value;
        _logger = logger;
    }

    private DateTime UtcNow => _clock.GetUtcNow().UtcDateTime;

    public async Task<MfaStatusDto> GetStatusAsync(long userId, CancellationToken ct)
    {
        var items = await _db.MfaEnrollments.AsNoTracking().Where(x => x.UserId == userId && x.IsEnabled).ToListAsync(ct);
        var sms = items.FirstOrDefault(x => x.Method == MfaMethod.Sms);
        return new(items.Any(x => x.Method == MfaMethod.Sms), Mask(sms?.PhoneNumber), items.Any(x => x.Method == MfaMethod.Totp));
    }

    public Task<bool> HasEnabledMfaAsync(long userId, CancellationToken ct) =>
        _db.MfaEnrollments.AnyAsync(x => x.UserId == userId && x.IsEnabled, ct);

    public async Task<MfaChallengeDto> BeginSmsEnrollmentAsync(long userId, string phoneNumber, CancellationToken ct)
    {
        var normalized = NormalizePhone(phoneNumber);
        var enrollment = await UpsertEnrollment(userId, MfaMethod.Sms, ct);
        var (challenge, code) = CreateChallenge(userId, enrollment, MfaChallengePurpose.Enrollment, withSmsCode: true);
        challenge.PendingValueProtected = _protector.Protect(normalized);
        _db.MfaChallenges.Add(challenge);
        await _db.SaveChangesAsync(ct);
        if (!await SendCode(normalized, code!, ct))
        {
            _db.MfaChallenges.Remove(challenge);
            await _db.SaveChangesAsync(ct);
            throw new InvalidOperationException("MFA code delivery failed.");
        }
        return ToDto(challenge, normalized);
    }

    public async Task<TotpEnrollmentDto> BeginTotpEnrollmentAsync(long userId, CancellationToken ct)
    {
        var user = await _db.Users.AsNoTracking().SingleAsync(x => x.Id == userId, ct);
        var secret = TotpGenerator.CreateSecret();
        var enrollment = await UpsertEnrollment(userId, MfaMethod.Totp, ct);
        var (challenge, _) = CreateChallenge(userId, enrollment, MfaChallengePurpose.Enrollment, false);
        challenge.PendingValueProtected = _protector.Protect(secret);
        _db.MfaChallenges.Add(challenge);
        await _db.SaveChangesAsync(ct);
        var label = Uri.EscapeDataString($"{_options.Issuer}:{user.Email}");
        var uri = $"otpauth://totp/{label}?secret={secret}&issuer={Uri.EscapeDataString(_options.Issuer)}&algorithm=SHA1&digits=6&period=30";
        return new(challenge.Id, secret, uri);
    }

    public async Task<MfaEnrollmentResult> VerifyEnrollmentAsync(long userId, Guid challengeId, string code, CancellationToken ct)
    {
        var challenge = await _db.MfaChallenges.Include(x => x.Enrollment)
            .SingleOrDefaultAsync(x => x.Id == challengeId && x.UserId == userId && x.Purpose == MfaChallengePurpose.Enrollment, ct);
        var error = ValidateChallenge(challenge);
        if (error != MfaError.None) return new(false, false, error);
        if (!VerifyCode(challenge!, code))
        {
            await RecordFailure(challenge!, ct);
            return new(false, false, MfaError.Invalid);
        }
        challenge!.UsedAt = UtcNow;
        var pendingValue = _protector.Unprotect(challenge.PendingValueProtected!);
        if (challenge.Method == MfaMethod.Sms) challenge.Enrollment!.PhoneNumber = pendingValue;
        else challenge.Enrollment!.ProtectedSecret = _protector.Protect(pendingValue);
        challenge.Enrollment!.IsEnabled = true;
        challenge.Enrollment.VerifiedAt = UtcNow;
        challenge.Enrollment.UpdatedAt = UtcNow;
        await _db.SaveChangesAsync(ct);
        return new(true, true);
    }

    public async Task DisableAsync(long userId, MfaMethod method, CancellationToken ct)
    {
        var item = await _db.MfaEnrollments.SingleOrDefaultAsync(x => x.UserId == userId && x.Method == method, ct);
        if (item is null) return;
        item.IsEnabled = false;
        item.PhoneNumber = null;
        item.ProtectedSecret = null;
        item.VerifiedAt = null;
        item.UpdatedAt = UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<MfaChallengeDto> BeginLoginAsync(long userId, CancellationToken ct, MfaMethod? method = null)
    {
        var enrollments = await _db.MfaEnrollments.Where(x => x.UserId == userId && x.IsEnabled).ToListAsync(ct);
        var enrollment = method.HasValue
            ? enrollments.SingleOrDefault(x => x.Method == method.Value)
            : enrollments.FirstOrDefault(x => x.Method == MfaMethod.Totp) ?? enrollments.FirstOrDefault();
        if (enrollment is null) throw new InvalidOperationException("No enabled MFA method is available.");

        var previous = await _db.MfaChallenges.Where(x => x.UserId == userId && x.Purpose == MfaChallengePurpose.Login && x.UsedAt == null).ToListAsync(ct);
        foreach (var old in previous) old.UsedAt = UtcNow;
        var (challenge, code) = CreateChallenge(userId, enrollment, MfaChallengePurpose.Login, enrollment.Method == MfaMethod.Sms);
        _db.MfaChallenges.Add(challenge);
        await _db.SaveChangesAsync(ct);
        if (enrollment.Method == MfaMethod.Sms && !await SendCode(enrollment.PhoneNumber!, code!, ct))
        {
            challenge.UsedAt = UtcNow;
            await _db.SaveChangesAsync(ct);
            throw new InvalidOperationException("MFA code delivery failed.");
        }
        return ToDto(challenge, enrollment.PhoneNumber);
    }

    public async Task<MfaVerificationResult> VerifyLoginAsync(Guid challengeId, string code, CancellationToken ct)
    {
        var challenge = await _db.MfaChallenges.Include(x => x.Enrollment)
            .SingleOrDefaultAsync(x => x.Id == challengeId && x.Purpose == MfaChallengePurpose.Login, ct);
        var error = ValidateChallenge(challenge);
        if (error != MfaError.None) return new(false, Error: error);
        if (!VerifyCode(challenge!, code))
        {
            await RecordFailure(challenge!, ct);
            return new(false, Error: MfaError.Invalid);
        }
        challenge!.UsedAt = UtcNow;
        await _db.SaveChangesAsync(ct);
        return new(true, challenge.UserId);
    }

    private async Task<MfaEnrollment> UpsertEnrollment(long userId, MfaMethod method, CancellationToken ct)
    {
        var item = await _db.MfaEnrollments.SingleOrDefaultAsync(x => x.UserId == userId && x.Method == method, ct);
        if (item is not null) return item;
        item = new MfaEnrollment { UserId = userId, Method = method, CreatedAt = UtcNow, UpdatedAt = UtcNow };
        _db.MfaEnrollments.Add(item);
        return item;
    }

    private (MfaChallenge Challenge, string? Code) CreateChallenge(long userId, MfaEnrollment enrollment, MfaChallengePurpose purpose, bool withSmsCode)
    {
        string? code = null, hash = null, salt = null;
        if (withSmsCode)
        {
            code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6", CultureInfo.InvariantCulture);
            var saltBytes = RandomNumberGenerator.GetBytes(32);
            salt = Convert.ToHexString(saltBytes);
            hash = HashCode(code, saltBytes);
        }
        return (new MfaChallenge
        {
            UserId = userId, Enrollment = enrollment, Method = enrollment.Method, Purpose = purpose,
            CodeHash = hash, CodeSalt = salt, CreatedAt = UtcNow,
            ExpiresAt = UtcNow.AddMinutes(Math.Clamp(_options.ChallengeLifetimeMinutes, 1, 15)),
            MaximumAttempts = Math.Clamp(_options.MaximumAttempts, 1, 10)
        }, code);
    }

    private MfaError ValidateChallenge(MfaChallenge? challenge)
    {
        if (challenge is null) return MfaError.NotFound;
        if (UtcNow >= challenge.ExpiresAt) return MfaError.Expired;
        if (challenge.UsedAt.HasValue) return MfaError.Used;
        if (challenge.FailedAttempts >= challenge.MaximumAttempts) return MfaError.Locked;
        if (challenge.Enrollment is null || (challenge.Purpose == MfaChallengePurpose.Login && !challenge.Enrollment.IsEnabled)) return MfaError.Invalid;
        return MfaError.None;
    }

    private bool VerifyCode(MfaChallenge challenge, string code)
    {
        if (string.IsNullOrWhiteSpace(code)) return false;
        if (challenge.Method == MfaMethod.Totp)
        {
            try
            {
                var protectedSecret = challenge.Purpose == MfaChallengePurpose.Enrollment
                    ? challenge.PendingValueProtected
                    : challenge.Enrollment!.ProtectedSecret;
                return !string.IsNullOrEmpty(protectedSecret) && TotpGenerator.Verify(_protector.Unprotect(protectedSecret), code, _clock.GetUtcNow());
            }
            catch (CryptographicException ex) { _logger.LogWarning(ex, "Unable to decrypt TOTP secret for enrollment {EnrollmentId}", challenge.EnrollmentId); return false; }
        }
        if (code.Length != 6 || !code.All(char.IsDigit) || challenge.CodeHash is null || challenge.CodeSalt is null) return false;
        var actual = Convert.FromHexString(HashCode(code, Convert.FromHexString(challenge.CodeSalt)));
        var expected = Convert.FromHexString(challenge.CodeHash);
        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    private async Task RecordFailure(MfaChallenge challenge, CancellationToken ct)
    {
        challenge.FailedAttempts++;
        await _db.SaveChangesAsync(ct);
    }

    private Task<bool> SendCode(string phone, string code, CancellationToken ct) =>
        _sms.SendSmsAsync(phone, $"Your Property Peace verification code is {code}. It expires in {_options.ChallengeLifetimeMinutes} minutes. Do not share this code.", ct);

    private static string HashCode(string code, byte[] salt) => Convert.ToHexString(HMACSHA256.HashData(salt, Encoding.UTF8.GetBytes(code)));
    private static MfaChallengeDto ToDto(MfaChallenge c, string? phone) => new(c.Id, c.Method, c.ExpiresAt, Mask(phone));
    private static string? Mask(string? phone) => string.IsNullOrEmpty(phone) ? null : new string('*', Math.Max(0, phone.Length - 4)) + phone[^Math.Min(4, phone.Length)..];

    private static string NormalizePhone(string value)
    {
        var trimmed = value.Trim();
        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (digits.Length == 10) digits = "1" + digits;
        if (digits.Length is < 8 or > 15) throw new ArgumentException("A valid international phone number is required.", nameof(value));
        return "+" + digits;
    }
}

public static class TotpGenerator
{
    private const string Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    public static string CreateSecret() => EncodeBase32(RandomNumberGenerator.GetBytes(20));
    public static string Generate(string secret, DateTimeOffset time) => GenerateForCounter(DecodeBase32(secret), time.ToUnixTimeSeconds() / 30);
    public static bool Verify(string secret, string code, DateTimeOffset time)
    {
        if (code.Length != 6 || !code.All(char.IsDigit)) return false;
        var key = DecodeBase32(secret);
        var counter = time.ToUnixTimeSeconds() / 30;
        for (var offset = -1; offset <= 1; offset++)
        {
            var candidate = Encoding.ASCII.GetBytes(GenerateForCounter(key, counter + offset));
            if (CryptographicOperations.FixedTimeEquals(candidate, Encoding.ASCII.GetBytes(code))) return true;
        }
        return false;
    }
    private static string GenerateForCounter(byte[] key, long counter)
    {
        Span<byte> data = stackalloc byte[8];
        System.Buffers.Binary.BinaryPrimitives.WriteInt64BigEndian(data, counter);
        var hash = HMACSHA1.HashData(key, data);
        var offset = hash[^1] & 0xf;
        var binary = ((hash[offset] & 0x7f) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
        return (binary % 1_000_000).ToString("D6", CultureInfo.InvariantCulture);
    }
    private static string EncodeBase32(byte[] data)
    {
        var output = new StringBuilder((data.Length * 8 + 4) / 5);
        var buffer = 0; var bits = 0;
        foreach (var b in data)
        {
            buffer = (buffer << 8) | b; bits += 8;
            while (bits >= 5) { bits -= 5; output.Append(Alphabet[(buffer >> bits) & 31]); }
        }
        if (bits > 0) output.Append(Alphabet[(buffer << (5 - bits)) & 31]);
        return output.ToString();
    }
    private static byte[] DecodeBase32(string value)
    {
        var output = new List<byte>(); var buffer = 0; var bits = 0;
        foreach (var c in value.Trim().TrimEnd('=').ToUpperInvariant())
        {
            var index = Alphabet.IndexOf(c); if (index < 0) throw new FormatException("Invalid Base32 secret.");
            buffer = (buffer << 5) | index; bits += 5;
            if (bits >= 8) { bits -= 8; output.Add((byte)(buffer >> bits)); buffer &= (1 << bits) - 1; }
        }
        return output.ToArray();
    }
}
