using System.Net;
using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Helpers;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.PasswordReset;

public interface IPasswordResetService
{
    Task RequestResetAsync(string email, CancellationToken cancellationToken = default);
    Task<PasswordResetResult> ResetPasswordAsync(string token, string newPassword, CancellationToken cancellationToken = default);
}

public sealed record PasswordResetResult(bool Success, string Message);

public class PasswordResetService(
    DataContext db,
    IEmailService emailService,
    IConfiguration configuration,
    TimeProvider clock,
    ILogger<PasswordResetService> logger) : IPasswordResetService
{
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);
    private const string InvalidTokenMessage = "This password reset link is invalid or has expired.";

    public async Task RequestResetAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await db.Users.FirstOrDefaultAsync(
            candidate => candidate.Email.ToLower() == normalizedEmail &&
                         !candidate.IsDeleted &&
                         !candidate.IsSuspended &&
                         candidate.PasswordHash != null &&
                         candidate.PasswordHash.Length > 0 &&
                         candidate.PasswordSalt != null &&
                         candidate.PasswordSalt.Length > 0,
            cancellationToken);
        if (user == null) return;

        var now = clock.GetUtcNow().UtcDateTime;
        var priorTokens = await db.PasswordResetTokens
            .Where(token => token.UserId == user.Id && token.ConsumedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var priorToken in priorTokens)
        {
            priorToken.ConsumedAt = now;
        }
        var rawToken = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var resetToken = new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = HashToken(rawToken),
            CreatedAt = now,
            ExpiresAt = now.Add(TokenLifetime),
        };
        db.PasswordResetTokens.Add(resetToken);
        await db.SaveChangesAsync(cancellationToken);

        var frontendBaseUrl = (configuration["FrontendBaseUrl"] ?? "https://app.propertypeace.io").TrimEnd('/');
        var resetUrl = $"{frontendBaseUrl}/reset-password?token={Uri.EscapeDataString(rawToken)}";
        var encodedUrl = WebUtility.HtmlEncode(resetUrl);
        var subject = "Reset your Property Peace password";
        var html = $"<p>Use the link below to reset your Property Peace password. This link expires in 30 minutes.</p><p><a href=\"{encodedUrl}\">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>";
        var plainText = $"Use this link to reset your Property Peace password. It expires in 30 minutes.\n\n{resetUrl}\n\nIf you did not request this, you can ignore this email.";
        try
        {
            var sent = await emailService.SendEmailAsync(user.Email, subject, html, plainText, cancellationToken);
            if (!sent) logger.LogWarning("Password reset email delivery was not accepted for user {UserId}", user.Id);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Password reset email delivery failed for user {UserId}", user.Id);
        }
    }

    public async Task<PasswordResetResult> ResetPasswordAsync(
        string token,
        string newPassword,
        CancellationToken cancellationToken = default)
    {
        var passwordValidation = PasswordValidator.ValidatePassword(newPassword);
        if (!passwordValidation.IsValid)
        {
            return new PasswordResetResult(false, passwordValidation.ErrorMessage);
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            return new PasswordResetResult(false, InvalidTokenMessage);
        }

        var now = clock.GetUtcNow().UtcDateTime;
        var tokenHash = HashToken(token);
        var resetToken = await db.PasswordResetTokens
            .AsNoTracking()
            .FirstOrDefaultAsync(candidate =>
                candidate.TokenHash == tokenHash &&
                candidate.ConsumedAt == null &&
                candidate.ExpiresAt > now,
                cancellationToken);
        if (resetToken == null)
        {
            return new PasswordResetResult(false, InvalidTokenMessage);
        }

        await using var transaction = db.Database.IsRelational()
            ? await db.Database.BeginTransactionAsync(cancellationToken)
            : null;

        if (db.Database.IsRelational())
        {
            var claimed = await db.PasswordResetTokens
                .Where(candidate =>
                    candidate.Id == resetToken.Id &&
                    candidate.ConsumedAt == null &&
                    candidate.ExpiresAt > now)
                .ExecuteUpdateAsync(
                    setters => setters.SetProperty(candidate => candidate.ConsumedAt, now),
                    cancellationToken);
            if (claimed != 1)
            {
                if (transaction != null) await transaction.RollbackAsync(cancellationToken);
                return new PasswordResetResult(false, InvalidTokenMessage);
            }
        }
        else
        {
            var trackedToken = await db.PasswordResetTokens.FindAsync([resetToken.Id], cancellationToken);
            if (trackedToken == null || trackedToken.ConsumedAt != null || trackedToken.ExpiresAt <= now)
            {
                return new PasswordResetResult(false, InvalidTokenMessage);
            }
            trackedToken.ConsumedAt = now;
        }

        var user = await db.Users.FirstOrDefaultAsync(candidate =>
            candidate.Id == resetToken.UserId &&
            !candidate.IsDeleted &&
            !candidate.IsSuspended,
            cancellationToken);
        if (user == null)
        {
            if (transaction != null) await transaction.RollbackAsync(cancellationToken);
            return new PasswordResetResult(false, InvalidTokenMessage);
        }

        using (var hmac = new HMACSHA512())
        {
            user.PasswordSalt = hmac.Key;
            user.PasswordHash = hmac.ComputeHash(Encoding.UTF8.GetBytes(newPassword));
        }

        var otherTokens = await db.PasswordResetTokens
            .Where(candidate => candidate.UserId == user.Id && candidate.ConsumedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var otherToken in otherTokens) otherToken.ConsumedAt = now;

        var activeRefreshTokens = await db.UserRefreshTokens
            .Where(candidate => candidate.UserId == user.Id && candidate.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var refreshToken in activeRefreshTokens) refreshToken.RevokedAt = now;

        await db.SaveChangesAsync(cancellationToken);
        if (transaction != null) await transaction.CommitAsync(cancellationToken);
        return new PasswordResetResult(true, "Your password has been reset.");
    }

    internal static string HashToken(string token) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
