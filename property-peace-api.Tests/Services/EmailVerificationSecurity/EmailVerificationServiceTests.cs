using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.EmailVerificationService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.EmailVerificationSecurity;

public sealed class EmailVerificationServiceTests : IDisposable
{
    private readonly Data.DataContext _context = DbContextFactory.Create();

    [Fact]
    public async Task VerifyCode_IssuesProofWithFreshRegistrationWindow()
    {
        var secret = Convert.ToBase64String(new byte[32]);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = secret,
            })
            .Build();
        var service = new EmailVerificationService(
            _context,
            Mock.Of<IEmailService>(),
            NullLogger<EmailVerificationService>.Instance,
            configuration);
        var originalExpiry = DateTime.UtcNow.AddSeconds(5);
        var verification = new brownstone_hub_api.Models.EmailVerification
        {
            Email = "user@example.com",
            Code = "123456",
            CreatedAt = DateTime.UtcNow.AddMinutes(-9),
            ExpiresAt = originalExpiry,
            IsVerified = false,
        };
        _context.EmailVerifications.Add(verification);
        await _context.SaveChangesAsync();

        var result = await service.VerifyCodeAsync("USER@example.com", "123456");

        result.Success.Should().BeTrue();
        result.Data.Should().NotBeNullOrWhiteSpace();
        verification.IsVerified.Should().BeTrue();
        verification.VerifiedAt.Should().NotBeNull();
        verification.ExpiresAt.Should().BeAfter(originalExpiry.AddMinutes(9));
        EmailVerificationProof.TryValidate(
            result.Data,
            "user@example.com",
            DateTime.UtcNow,
            TimeSpan.FromMinutes(10),
            secret,
            out var verificationId).Should().BeTrue();
        verificationId.Should().Be(verification.Id);
    }

    public void Dispose() => _context.Dispose();
}
