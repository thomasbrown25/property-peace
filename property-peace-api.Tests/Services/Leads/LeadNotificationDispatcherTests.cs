using System.Collections.Concurrent;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.Leads;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leads;

public sealed class LeadNotificationDispatcherTests
{
    private static DataContext Db(string name) => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(name).Options);

    [Theory]
    [InlineData(LeadNotificationKind.ShowingConfirmation, ShowingStatus.Confirmed, "Showing confirmed")]
    [InlineData(LeadNotificationKind.ShowingReminder, ShowingStatus.Confirmed, "Showing reminder")]
    [InlineData(LeadNotificationKind.ShowingCancellation, ShowingStatus.Cancelled, "Showing cancelled")]
    [InlineData(LeadNotificationKind.ShowingRescheduled, ShowingStatus.Confirmed, "Showing rescheduled")]
    public async Task Sends_truthful_org_scoped_content_for_each_showing_event(
        LeadNotificationKind kind, ShowingStatus status, string subject)
    {
        var name = $"{nameof(Sends_truthful_org_scoped_content_for_each_showing_event)}-{kind}";
        await using var db = Db(name); Seed(db, kind, status); await db.SaveChangesAsync();
        var email = new FakeEmail();
        var dispatcher = new LeadNotificationDispatcher(db, email, TimeProvider.System,
            NullLogger<LeadNotificationDispatcher>.Instance);

        (await dispatcher.DispatchPendingAsync(default)).Should().Be(1);

        var sent = email.Messages.Should().ContainSingle().Subject;
        sent.Subject.Should().Be(subject);
        sent.Text.Should().Contain("Showing reference: 50").And.Contain("listing HOME-10")
            .And.Contain("management code delivered separately").And.NotContain("secret-token");
        db.LeadNotificationIntents.Single().Status.Should().Be(NotificationIntentStatus.Sent);
    }

    [Fact]
    public async Task Provider_failure_is_retried_with_backoff_then_dead_letters()
    {
        var name = nameof(Provider_failure_is_retried_with_backoff_then_dead_letters);
        await using var db = Db(name); Seed(db, LeadNotificationKind.ShowingConfirmation, ShowingStatus.Confirmed);
        await db.SaveChangesAsync();
        var email = new FakeEmail { Accept = false };
        var dispatcher = new LeadNotificationDispatcher(db, email, TimeProvider.System,
            NullLogger<LeadNotificationDispatcher>.Instance);

        (await dispatcher.DispatchPendingAsync(default)).Should().Be(0);
        var row = db.LeadNotificationIntents.Single();
        row.AttemptCount.Should().Be(1); row.Status.Should().Be(NotificationIntentStatus.Pending);
        row.NextAttemptAtUtc.Should().BeAfter(DateTime.UtcNow);

        for (var attempt = 2; attempt <= 5; attempt++)
        {
            row.NextAttemptAtUtc = DateTime.UtcNow.AddSeconds(-1); await db.SaveChangesAsync();
            await dispatcher.DispatchPendingAsync(default);
        }
        row.Status.Should().Be(NotificationIntentStatus.Failed);
        row.AttemptCount.Should().Be(5);
        row.LastError.Should().NotContain("secret-token");
    }

    [Fact]
    public async Task Stale_intent_is_cancelled_without_external_delivery()
    {
        var name = nameof(Stale_intent_is_cancelled_without_external_delivery);
        await using var db = Db(name);
        Seed(db, LeadNotificationKind.ShowingReminder, ShowingStatus.Cancelled);
        await db.SaveChangesAsync();
        var email = new FakeEmail();
        var dispatcher = new LeadNotificationDispatcher(db, email, TimeProvider.System,
            NullLogger<LeadNotificationDispatcher>.Instance);

        (await dispatcher.DispatchPendingAsync(default)).Should().Be(0);

        email.Messages.Should().BeEmpty();
        var row = db.LeadNotificationIntents.Single();
        row.Status.Should().Be(NotificationIntentStatus.Cancelled);
        row.LeaseId.Should().BeNull();
        row.LeaseUntilUtc.Should().BeNull();
    }

    [Fact]
    public async Task Exception_details_and_secrets_are_not_persisted_or_logged()
    {
        const string secret = "secret-token-value";
        var name = nameof(Exception_details_and_secrets_are_not_persisted_or_logged);
        await using var db = Db(name);
        Seed(db, LeadNotificationKind.ShowingConfirmation, ShowingStatus.Confirmed);
        await db.SaveChangesAsync();
        var logger = new CapturingLogger();
        var dispatcher = new LeadNotificationDispatcher(db, new ThrowingEmail(secret), TimeProvider.System, logger);

        (await dispatcher.DispatchPendingAsync(default)).Should().Be(0);

        db.LeadNotificationIntents.Single().LastError.Should().Be(nameof(InvalidOperationException));
        logger.Messages.Should().NotContain(message => message.Contains(secret, StringComparison.Ordinal));
        logger.Messages.Should().ContainSingle(message =>
            message.Contains("intent 70 failed", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task Concurrent_workers_claim_once_and_do_not_duplicate_delivery()
    {
        var name = nameof(Concurrent_workers_claim_once_and_do_not_duplicate_delivery);
        await using (var seed = Db(name)) { Seed(seed, LeadNotificationKind.ShowingReminder, ShowingStatus.Confirmed); await seed.SaveChangesAsync(); }
        await using var one = Db(name); await using var two = Db(name);
        var email = new FakeEmail();
        var a = new LeadNotificationDispatcher(one, email, TimeProvider.System, NullLogger<LeadNotificationDispatcher>.Instance);
        var b = new LeadNotificationDispatcher(two, email, TimeProvider.System, NullLogger<LeadNotificationDispatcher>.Instance);

        await Task.WhenAll(a.DispatchPendingAsync(default), b.DispatchPendingAsync(default));

        email.Messages.Should().ContainSingle();
        await using var verify = Db(name);
        verify.LeadNotificationIntents.Single().Status.Should().Be(NotificationIntentStatus.Sent);
    }

    private static void Seed(DataContext db, LeadNotificationKind kind, ShowingStatus status)
    {
        var now = DateTime.UtcNow;
        db.Listings.Add(new Listing { Id = 10, PropertyId = 20, OrganizationId = 1, CreatedBy = 99,
            ListingNumber = "HOME-10", Status = EListingStatus.Active, CreatedAt = now });
        db.Leads.Add(new Lead { Id = 40, OrganizationId = 1, ListingId = 10, PropertyId = 20,
            Name = "Prospect", Email = "prospect@example.test", NormalizedEmail = "prospect@example.test",
            ContactIdentityHash = "identity", VerificationTokenHash = "verification", CreatedAtUtc = now, UpdatedAtUtc = now });
        db.Showings.Add(new Showing { Id = 50, OrganizationId = 1, LeadId = 40, ListingId = 10,
            PropertyId = 20, AvailabilityId = 60, StartsAtUtc = now.AddDays(2), EndsAtUtc = now.AddDays(2).AddHours(1),
            BoundaryTimeZoneId = "UTC", Status = status, IdempotencyKeyHash = "key", RequestHash = "hash", CreatedAtUtc = now });
        db.LeadNotificationIntents.Add(new LeadNotificationIntent { Id = 70, OrganizationId = 1, LeadId = 40,
            ShowingId = 50, Kind = kind, Status = NotificationIntentStatus.Pending,
            NotBeforeUtc = now.AddMinutes(-1), CreatedAtUtc = now });
    }

    private sealed class FakeEmail : IEmailService
    {
        public bool Accept { get; set; } = true;
        public ConcurrentQueue<(string To, string Subject, string Html, string Text)> Messages { get; } = new();
        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent = null,
            CancellationToken cancellationToken = default)
        { Messages.Enqueue((to, subject, htmlContent, plainTextContent ?? "")); return Task.FromResult(Accept); }
        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent,
            string? senderAddress, CancellationToken cancellationToken = default) =>
            SendEmailAsync(to, subject, htmlContent, plainTextContent, cancellationToken);
        public Task<bool> SendBulkEmailAsync(List<string> to, string subject, string htmlContent,
            string? plainTextContent = null, CancellationToken cancellationToken = default) => Task.FromResult(Accept);
    }

    private sealed class ThrowingEmail(string secret) : IEmailService
    {
        private static Task<bool> Throw(string value) => throw new InvalidOperationException(value);
        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent,
            string? plainTextContent = null, CancellationToken cancellationToken = default) => Throw(secret);
        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent, string? plainTextContent,
            string? senderAddress, CancellationToken cancellationToken = default) => Throw(secret);
        public Task<bool> SendBulkEmailAsync(List<string> to, string subject, string htmlContent,
            string? plainTextContent = null, CancellationToken cancellationToken = default) => Throw(secret);
    }

    private sealed class CapturingLogger : ILogger<LeadNotificationDispatcher>
    {
        public List<string> Messages { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter) => Messages.Add(formatter(state, exception));
    }
}
