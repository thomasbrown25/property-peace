using brownstone_hub_api.Services.EmailVerificationService;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.EmailVerification;

public class EmailVerificationProofTests
{
    private static readonly string Secret = Convert.ToBase64String(Enumerable.Range(1, 32).Select(value => (byte)value).ToArray());

    [Fact]
    public void TryValidate_AcceptsMatchingCanonicalEmailWithinLifetime()
    {
        var issuedAt = DateTime.UtcNow;
        var proof = EmailVerificationProof.Create(42, " User@Example.com ", issuedAt, Secret);

        var valid = EmailVerificationProof.TryValidate(
            proof,
            "user@example.com",
            issuedAt.AddMinutes(5),
            TimeSpan.FromMinutes(10),
            Secret,
            out var verificationId);

        valid.Should().BeTrue();
        verificationId.Should().Be(42);
    }

    [Fact]
    public void TryValidate_RejectsProofForAnotherEmail()
    {
        var issuedAt = DateTime.UtcNow;
        var proof = EmailVerificationProof.Create(42, "user@example.com", issuedAt, Secret);

        var valid = EmailVerificationProof.TryValidate(
            proof,
            "attacker@example.com",
            issuedAt,
            TimeSpan.FromMinutes(10),
            Secret,
            out _);

        valid.Should().BeFalse();
    }

    [Fact]
    public void TryValidate_RejectsExpiredProof()
    {
        var issuedAt = DateTime.UtcNow.AddMinutes(-11);
        var proof = EmailVerificationProof.Create(42, "user@example.com", issuedAt, Secret);

        var valid = EmailVerificationProof.TryValidate(
            proof,
            "user@example.com",
            DateTime.UtcNow,
            TimeSpan.FromMinutes(10),
            Secret,
            out _);

        valid.Should().BeFalse();
    }

    [Fact]
    public void TryValidate_RejectsTamperedProof()
    {
        var issuedAt = DateTime.UtcNow;
        var proof = EmailVerificationProof.Create(42, "user@example.com", issuedAt, Secret);
        var tampered = proof[..^1] + (proof[^1] == 'A' ? 'B' : 'A');

        var valid = EmailVerificationProof.TryValidate(
            tampered,
            "user@example.com",
            issuedAt,
            TimeSpan.FromMinutes(10),
            Secret,
            out _);

        valid.Should().BeFalse();
    }
}
