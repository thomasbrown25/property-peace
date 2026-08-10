using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.WebUtilities;

namespace brownstone_hub_api.Services.EmailVerificationService;

internal static class EmailVerificationProof
{
    private sealed record Payload(long VerificationId, string Email, long IssuedAtUnixSeconds);

    public static string Create(long verificationId, string email, DateTime verifiedAtUtc, string secret)
    {
        var payload = new Payload(
            verificationId,
            CanonicalizeEmail(email),
            new DateTimeOffset(DateTime.SpecifyKind(verifiedAtUtc, DateTimeKind.Utc)).ToUnixTimeSeconds());
        var encodedPayload = WebEncoders.Base64UrlEncode(JsonSerializer.SerializeToUtf8Bytes(payload));
        var signature = Sign(encodedPayload, secret);
        return $"{encodedPayload}.{WebEncoders.Base64UrlEncode(signature)}";
    }

    public static bool TryValidate(
        string? proof,
        string email,
        DateTime nowUtc,
        TimeSpan lifetime,
        string secret,
        out long verificationId)
    {
        verificationId = 0;
        if (string.IsNullOrWhiteSpace(proof) || string.IsNullOrWhiteSpace(secret)) return false;

        var parts = proof.Split('.', 2);
        if (parts.Length != 2) return false;

        byte[] suppliedSignature;
        try
        {
            suppliedSignature = WebEncoders.Base64UrlDecode(parts[1]);
        }
        catch (FormatException)
        {
            return false;
        }

        var expectedSignature = Sign(parts[0], secret);
        if (!CryptographicOperations.FixedTimeEquals(suppliedSignature, expectedSignature)) return false;

        Payload? payload;
        try
        {
            payload = JsonSerializer.Deserialize<Payload>(WebEncoders.Base64UrlDecode(parts[0]));
        }
        catch (Exception exception) when (exception is FormatException or JsonException)
        {
            return false;
        }

        if (payload == null || payload.VerificationId <= 0 ||
            !string.Equals(payload.Email, CanonicalizeEmail(email), StringComparison.Ordinal))
        {
            return false;
        }

        var issuedAtUtc = DateTimeOffset.FromUnixTimeSeconds(payload.IssuedAtUnixSeconds).UtcDateTime;
        if (issuedAtUtc > nowUtc.AddMinutes(1) || issuedAtUtc < nowUtc.Subtract(lifetime)) return false;

        verificationId = payload.VerificationId;
        return true;
    }

    public static string CanonicalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static byte[] Sign(string encodedPayload, string secret)
    {
        using var hmac = new HMACSHA256(Convert.FromBase64String(secret));
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(encodedPayload));
    }
}
