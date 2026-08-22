using System.Security.Cryptography;
using System.Text;
using brownstone_hub_api.Data;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.PasswordReset;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Auth;

public sealed class PasswordResetServiceTests : IAsyncLifetime
{
    private DataContext _db = null!;

    public async Task InitializeAsync()
    {
        var options = new DbContextOptionsBuilder<DataContext>()
            .UseInMemoryDatabase($"password-reset-{Guid.NewGuid()}")
            .Options;
        _db = new DataContext(options);
    }

    [Fact]
    public async Task RequestResetAsync_KnownPasswordAccountStoresOnlyTokenHashAndEmailsConfiguredLink()
    {
        var user = new User
        {
            Email = "user@example.com",
            PasswordHash = [1, 2, 3],
            PasswordSalt = [4, 5, 6],
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        var email = new RecordingEmailService();
        var now = new DateTimeOffset(2026, 8, 22, 12, 0, 0, TimeSpan.Zero);
        var service = CreateService(email, now);

        await service.RequestResetAsync(" USER@EXAMPLE.COM ");

        var stored = await _db.PasswordResetTokens.SingleAsync();
        stored.UserId.Should().Be(user.Id);
        stored.TokenHash.Should().MatchRegex("^[A-F0-9]{64}$");
        stored.ExpiresAt.Should().Be(now.UtcDateTime.AddMinutes(30));
        email.Messages.Should().ContainSingle();
        var message = email.Messages.Single();
        message.To.Should().Be("user@example.com");
        var token = ExtractToken(message.PlainText);
        stored.TokenHash.Should().Be(Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))));
        message.PlainText.Should().Contain("https://app.propertypeace.io/reset-password?token=");
        message.PlainText.Should().NotContain(stored.TokenHash);
    }

    [Fact]
    public async Task ResetPasswordAsync_ValidTokenUpdatesPasswordConsumesTokensAndRevokesSessions()
    {
        var user = new User
        {
            Email = "user@example.com",
            PasswordHash = [1, 2, 3],
            PasswordSalt = [4, 5, 6],
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        var now = new DateTimeOffset(2026, 8, 22, 12, 0, 0, TimeSpan.Zero);
        const string rawToken = "one-time-raw-token";
        var requestedToken = new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))),
            CreatedAt = now.UtcDateTime.AddMinutes(-5),
            ExpiresAt = now.UtcDateTime.AddMinutes(25),
        };
        var otherToken = new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes("other-token"))),
            CreatedAt = now.UtcDateTime.AddMinutes(-10),
            ExpiresAt = now.UtcDateTime.AddMinutes(20),
        };
        var refreshToken = new UserRefreshToken
        {
            UserId = user.Id,
            TokenHash = new string('A', 64),
            CreatedAt = now.UtcDateTime.AddHours(-1),
            ExpiresAt = now.UtcDateTime.AddDays(1),
        };
        _db.AddRange(requestedToken, otherToken, refreshToken);
        await _db.SaveChangesAsync();
        var service = CreateService(new RecordingEmailService(), now);

        var result = await service.ResetPasswordAsync(rawToken, "NewPassword1!");

        result.Success.Should().BeTrue();
        requestedToken.ConsumedAt.Should().Be(now.UtcDateTime);
        otherToken.ConsumedAt.Should().Be(now.UtcDateTime);
        refreshToken.RevokedAt.Should().Be(now.UtcDateTime);
        user.PasswordSalt.Should().HaveCount(128);
        using var hmac = new HMACSHA512(user.PasswordSalt);
        user.PasswordHash.Should().Equal(hmac.ComputeHash(Encoding.UTF8.GetBytes("NewPassword1!")));
    }

    [Fact]
    public async Task ResetPasswordAsync_ExpiredOrConsumedTokenReturnsSafeFailure()
    {
        var user = new User
        {
            Email = "user@example.com",
            PasswordHash = [1],
            PasswordSalt = [2],
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        var now = new DateTimeOffset(2026, 8, 22, 12, 0, 0, TimeSpan.Zero);
        const string rawToken = "expired-token";
        _db.PasswordResetTokens.Add(new PasswordResetToken
        {
            UserId = user.Id,
            TokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken))),
            CreatedAt = now.UtcDateTime.AddHours(-1),
            ExpiresAt = now.UtcDateTime.AddMinutes(-1),
        });
        await _db.SaveChangesAsync();
        var service = CreateService(new RecordingEmailService(), now);

        var result = await service.ResetPasswordAsync(rawToken, "NewPassword1!");

        result.Success.Should().BeFalse();
        result.Message.Should().Be("This password reset link is invalid or has expired.");
        user.PasswordHash.Should().Equal(1);
    }

    private PasswordResetService CreateService(RecordingEmailService email, DateTimeOffset now)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["FrontendBaseUrl"] = "https://app.propertypeace.io/",
            })
            .Build();
        return new PasswordResetService(
            _db,
            email,
            configuration,
            new FixedTimeProvider(now),
            NullLogger<PasswordResetService>.Instance);
    }

    private static string ExtractToken(string plainText)
    {
        const string marker = "?token=";
        var markerIndex = plainText.IndexOf(marker, StringComparison.Ordinal);
        markerIndex.Should().BeGreaterThanOrEqualTo(0);
        var start = markerIndex + marker.Length;
        var end = plainText.IndexOfAny(['\r', '\n', ' '], start);
        return end < 0 ? plainText[start..] : plainText[start..end];
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private sealed class RecordingEmailService : IEmailService
    {
        public List<EmailMessage> Messages { get; } = [];

        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent = null,
            CancellationToken cancellationToken = default)
        {
            Messages.Add(new EmailMessage(to, subject, htmlContent, plainTextContent ?? string.Empty));
            return Task.FromResult(true);
        }

        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent,
            string? senderAddress, CancellationToken cancellationToken = default) =>
            SendEmailAsync(to, subject, htmlContent, plainTextContent, cancellationToken);

        public Task<bool> SendBulkEmailAsync(List<string> to, string subject, string htmlContent,
            string? plainTextContent = null, CancellationToken cancellationToken = default) => Task.FromResult(true);
    }

    private sealed record EmailMessage(string To, string Subject, string Html, string PlainText);
}
