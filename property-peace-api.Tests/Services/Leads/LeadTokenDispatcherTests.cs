using System.Collections.Concurrent;
using brownstone_hub_api.Data;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Services.EmailService;
using brownstone_hub_api.Services.Leads;
using FluentAssertions;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Leads;

public sealed class LeadTokenDispatcherTests
{
    [Fact]
    public async Task Concurrent_workers_claim_once_and_do_not_duplicate_secret_delivery()
    {
        var name = nameof(Concurrent_workers_claim_once_and_do_not_duplicate_secret_delivery);
        var protection = new EphemeralDataProtectionProvider();
        await using (var seed = Db(name))
        {
            seed.LeadTokenDeliveries.Add(Delivery(protection));
            await seed.SaveChangesAsync();
        }
        await using var one = Db(name);
        await using var two = Db(name);
        var email = new FakeEmail();
        var a = Dispatcher(one, protection, email);
        var b = Dispatcher(two, protection, email);

        var results = await Task.WhenAll(a.DispatchPendingAsync(default), b.DispatchPendingAsync(default));

        results.Sum().Should().Be(1);
        email.Messages.Should().ContainSingle();
        await using var verify = Db(name);
        var row = verify.LeadTokenDeliveries.Single();
        row.Status.Should().Be(NotificationIntentStatus.Sent);
        row.LeaseId.Should().BeNull();
        row.LeaseUntilUtc.Should().BeNull();
    }

    [Fact]
    public async Task Provider_failure_releases_lease_and_schedules_retry_without_persisting_secret()
    {
        var name = nameof(Provider_failure_releases_lease_and_schedules_retry_without_persisting_secret);
        var protection = new EphemeralDataProtectionProvider();
        await using var db = Db(name);
        db.LeadTokenDeliveries.Add(Delivery(protection));
        await db.SaveChangesAsync();

        var dispatcher = Dispatcher(db, protection, new FakeEmail { Accept = false });
        (await dispatcher.DispatchPendingAsync(default)).Should().Be(0);

        var row = db.LeadTokenDeliveries.Single();
        row.Status.Should().Be(NotificationIntentStatus.Pending);
        row.AttemptCount.Should().Be(1);
        row.NextAttemptAtUtc.Should().NotBeNull();
        row.LeaseId.Should().BeNull();
        row.LeaseUntilUtc.Should().BeNull();
        row.LastError.Should().NotContain("private-code");
    }

    private static LeadTokenDispatcher Dispatcher(DataContext db, IDataProtectionProvider protection, IEmailService email) =>
        new(db, protection, email, TimeProvider.System, NullLogger<LeadTokenDispatcher>.Instance);

    private static LeadTokenDelivery Delivery(IDataProtectionProvider protection) => new()
    {
        Id = 1,
        OrganizationId = 1,
        LeadId = 1,
        Purpose = LeadTokenPurpose.ContactVerification,
        Destination = "prospect@example.test",
        ProtectedPayload = protection.CreateProtector("lead-token-delivery-v1")
            .Protect("{\"Purpose\":0,\"Token\":\"private-code\"}"),
        Status = NotificationIntentStatus.Pending,
        CreatedAtUtc = DateTime.UtcNow.AddMinutes(-1)
    };

    private static DataContext Db(string name) => new(new DbContextOptionsBuilder<DataContext>()
        .UseInMemoryDatabase(name).Options);

    private sealed class FakeEmail : IEmailService
    {
        public bool Accept { get; init; } = true;
        public ConcurrentQueue<string> Messages { get; } = new();
        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent,
            string? plainTextContent = null, CancellationToken cancellationToken = default)
        {
            Messages.Enqueue(plainTextContent ?? "");
            return Task.FromResult(Accept);
        }
        public Task<bool> SendEmailAsync(string to, string subject, string htmlContent,
            string? plainTextContent, string? senderAddress, CancellationToken cancellationToken = default) =>
            SendEmailAsync(to, subject, htmlContent, plainTextContent, cancellationToken);
        public Task<bool> SendBulkEmailAsync(List<string> to, string subject, string htmlContent,
            string? plainTextContent = null, CancellationToken cancellationToken = default) => Task.FromResult(Accept);
    }
}
