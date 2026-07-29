using System.Text.RegularExpressions;
using brownstone_hub_api.Dtos.Mfa;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.MfaService;
using brownstone_hub_api.Services.SmsService;
using brownstone_hub_api.Tests.Helpers;
using FluentAssertions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Mfa;

public sealed class MfaServiceTests : IDisposable
{
    private static readonly DateTimeOffset Now = new(2026, 7, 28, 12, 0, 0, TimeSpan.Zero);
    private readonly Data.DataContext _db = DbContextFactory.Create();
    private readonly Mock<ISmsService> _sms = new();
    private readonly FakeTimeProvider _clock = new(Now);
    private readonly MfaService _sut;

    public MfaServiceTests()
    {
        _db.Users.Add(new User { Id = 7, Email = "person@example.com", PhoneNumber = "+15551234567" });
        _db.SaveChanges();
        var dataProtection = DataProtectionProvider.Create(new DirectoryInfo(Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString())));
        _sut = new MfaService(
            _db,
            _sms.Object,
            dataProtection,
            _clock,
            Options.Create(new MfaOptions { Issuer = "Property Peace", ChallengeLifetimeMinutes = 5, MaximumAttempts = 3 }),
            NullLogger<MfaService>.Instance);
    }

    [Fact]
    public async Task SmsEnrollment_HashesCode_MasksPhone_AndCodeIsSingleUse()
    {
        string? body = null;
        _sms.Setup(x => x.SendSmsAsync("+15551234567", It.IsAny<string>(), It.IsAny<CancellationToken>(), null))
            .Callback<string, string, CancellationToken, string?>((_, message, _, _) => body = message)
            .ReturnsAsync(true);

        var started = await _sut.BeginSmsEnrollmentAsync(7, "+1 (555) 123-4567", default);
        var code = Regex.Match(body!, @"\b\d{6}\b").Value;
        var stored = await _db.MfaChallenges.FindAsync(started.ChallengeId);

        started.MaskedPhone.Should().Be("********4567");
        code.Should().HaveLength(6);
        stored!.CodeHash.Should().NotBe(code);
        stored.CodeHash.Should().NotBeNullOrWhiteSpace();
        stored.CodeSalt.Should().NotBeNullOrWhiteSpace();

        (await _sut.VerifyEnrollmentAsync(7, started.ChallengeId, code, default)).Enabled.Should().BeTrue();
        var replay = await _sut.VerifyEnrollmentAsync(7, started.ChallengeId, code, default);
        replay.Success.Should().BeFalse();
    }

    [Fact]
    public async Task SmsChallenge_Expires_IsAttemptLimited_AndDoesNotSendTokens()
    {
        _db.MfaEnrollments.Add(new MfaEnrollment
        {
            UserId = 7, Method = MfaMethod.Sms, IsEnabled = true, PhoneNumber = "+15551234567", VerifiedAt = Now.UtcDateTime
        });
        await _db.SaveChangesAsync();
        _sms.Setup(x => x.SendSmsAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>(), null)).ReturnsAsync(true);

        var started = await _sut.BeginLoginAsync(7, default);
        for (var i = 0; i < 3; i++)
            (await _sut.VerifyLoginAsync(started.ChallengeId, "000000", default)).Success.Should().BeFalse();

        (await _sut.VerifyLoginAsync(started.ChallengeId, "000000", default)).Error.Should().Be(MfaError.Locked);
        _clock.Advance(TimeSpan.FromMinutes(6));
        (await _sut.VerifyLoginAsync(started.ChallengeId, "000000", default)).Error.Should().Be(MfaError.Expired);
    }

    [Fact]
    public async Task TotpSecret_IsEncryptedAtRest_AndValidCodeCompletesEnrollmentAndLogin()
    {
        var setup = await _sut.BeginTotpEnrollmentAsync(7, default);
        var pending = await _db.MfaEnrollments.SingleAsync(x => x.UserId == 7 && x.Method == MfaMethod.Totp);
        var pendingChallenge = await _db.MfaChallenges.SingleAsync(x => x.Id == setup.ChallengeId);

        pending.ProtectedSecret.Should().BeNull();
        pendingChallenge.PendingValueProtected.Should().NotBeNullOrWhiteSpace();
        pendingChallenge.PendingValueProtected.Should().NotContain(setup.Secret);
        setup.OtpAuthUri.Should().StartWith("otpauth://totp/");

        var code = TotpGenerator.Generate(setup.Secret, Now);
        (await _sut.VerifyEnrollmentAsync(7, setup.ChallengeId, code, default)).Enabled.Should().BeTrue();

        var login = await _sut.BeginLoginAsync(7, default);
        var verified = await _sut.VerifyLoginAsync(login.ChallengeId, code, default);
        verified.Success.Should().BeTrue();
        (await _sut.VerifyLoginAsync(login.ChallengeId, code, default)).Success.Should().BeFalse();
    }

    [Fact]
    public async Task ReplacingEnrollment_PreservesEnabledMethodUntilNewCodeIsVerified()
    {
        _db.MfaEnrollments.Add(new MfaEnrollment
        {
            UserId = 7,
            Method = MfaMethod.Totp,
            IsEnabled = true,
            ProtectedSecret = "existing-protected-secret",
            VerifiedAt = Now.UtcDateTime
        });
        await _db.SaveChangesAsync();

        await _sut.BeginTotpEnrollmentAsync(7, default);

        var enrollment = await _db.MfaEnrollments.SingleAsync(x => x.UserId == 7 && x.Method == MfaMethod.Totp);
        enrollment.IsEnabled.Should().BeTrue();
        enrollment.ProtectedSecret.Should().Be("existing-protected-secret");
    }

    [Fact]
    public async Task Disable_SoftDisablesEnrollment_WithoutViolatingChallengeRelationship()
    {
        var enrollment = new MfaEnrollment
        {
            UserId = 7,
            Method = MfaMethod.Sms,
            IsEnabled = true,
            PhoneNumber = "+15551234567",
            VerifiedAt = Now.UtcDateTime
        };
        _db.MfaEnrollments.Add(enrollment);
        _db.MfaChallenges.Add(new MfaChallenge
        {
            UserId = 7,
            Enrollment = enrollment,
            Method = MfaMethod.Sms,
            Purpose = MfaChallengePurpose.Login,
            ExpiresAt = Now.AddMinutes(5).UtcDateTime,
            MaximumAttempts = 3,
            CreatedAt = Now.UtcDateTime
        });
        await _db.SaveChangesAsync();

        await _sut.DisableAsync(7, MfaMethod.Sms, default);

        var stored = await _db.MfaEnrollments.SingleAsync(x => x.Id == enrollment.Id);
        stored.IsEnabled.Should().BeFalse();
        stored.PhoneNumber.Should().BeNull();
        (await _db.MfaChallenges.CountAsync(x => x.EnrollmentId == enrollment.Id)).Should().Be(1);
    }

    public void Dispose() => _db.Dispose();

    private sealed class FakeTimeProvider(DateTimeOffset now) : TimeProvider
    {
        private DateTimeOffset _now = now;
        public override DateTimeOffset GetUtcNow() => _now;
        public void Advance(TimeSpan amount) => _now += amount;
    }
}
