using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Services.ActivationFunnel;
using brownstone_hub_api.Services.ESignatureService;
using FluentAssertions;
using Moq;
using Xunit;

namespace brownstone_hub_api.Tests.ActivationFunnel;

public sealed class ActivationMilestoneWiringTests
{
    private static readonly DateTime CompletedAt = new(2026, 8, 11, 10, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task Connect_completed_records_once_from_server_mapping_after_durable_apply()
    {
        var mapping = new LeaseConnectInfoDto { LeaseId = 41, OrganizationId = 7, EnvelopeId = "env-41" };
        var update = new DocuSignConnectUpdate("env-41", ESignatureStatus.Completed, CompletedAt,
            new Dictionary<string, DateTime> { ["tenant@example.test"] = CompletedAt.AddMinutes(-1) }, CompletedAt);
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.ApplyDocuSignConnectUpdateAsync(mapping, update, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocuSignConnectApplyResult(true, 1));
        var recorder = new CapturingRecorder();
        var processor = new DocuSignConnectProcessor(repository.Object, recorder);

        await processor.SynchronizeAsync(mapping, update, CancellationToken.None);
        await processor.SynchronizeAsync(mapping, update, CancellationToken.None);

        recorder.Requests.Should().HaveCount(2);
        recorder.Requests.Should().OnlyContain(x => x.OrganizationId == 7 &&
            x.Milestone == ActivationMilestones.LeaseSigned && x.SubjectId == "lease:41" &&
            x.OccurredAtUtc == new DateTimeOffset(CompletedAt) && x.SourceEventType == "docusign-envelope" &&
            x.SourceEventId == "env-41");
    }

    [Fact]
    public async Task Connect_partial_or_failed_persistence_or_cross_mapping_records_nothing()
    {
        var mapping = new LeaseConnectInfoDto { LeaseId = 41, OrganizationId = 7, EnvelopeId = "env-41" };
        var partial = new DocuSignConnectUpdate("env-41", ESignatureStatus.PartiallySigned, null,
            new Dictionary<string, DateTime> { ["tenant@example.test"] = CompletedAt }, CompletedAt);
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.ApplyDocuSignConnectUpdateAsync(mapping, partial, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocuSignConnectApplyResult(true, 1));
        var recorder = new CapturingRecorder();
        var processor = new DocuSignConnectProcessor(repository.Object, recorder);

        await processor.SynchronizeAsync(mapping, partial, CancellationToken.None);
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => processor.SynchronizeAsync(mapping,
            partial with { EnvelopeId = "env-other" }, CancellationToken.None));

        var failed = partial with { Status = ESignatureStatus.Completed, CompletedAt = CompletedAt };
        repository.Setup(x => x.ApplyDocuSignConnectUpdateAsync(mapping, failed, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("transaction rolled back"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => processor.SynchronizeAsync(mapping, failed, CancellationToken.None));
        recorder.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task Connect_rejected_authoritative_transition_records_nothing()
    {
        var mapping = new LeaseConnectInfoDto { LeaseId = 41, OrganizationId = 7, EnvelopeId = "env-41" };
        var completed = new DocuSignConnectUpdate("env-41", ESignatureStatus.Completed, CompletedAt,
            new Dictionary<string, DateTime> { ["tenant@example.test"] = CompletedAt }, CompletedAt);
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.ApplyDocuSignConnectUpdateAsync(mapping, completed, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocuSignConnectApplyResult(false, 0));
        var recorder = new CapturingRecorder();

        var result = await new DocuSignConnectProcessor(repository.Object, recorder)
            .SynchronizeAsync(mapping, completed, CancellationToken.None);

        result.Applied.Should().BeFalse();
        recorder.Requests.Should().BeEmpty();
    }

    [Fact]
    public async Task Connect_completed_replay_repairs_missing_occurrence_from_persisted_completion_time()
    {
        var persistedCompletion = CompletedAt.AddMinutes(-7);
        var mapping = new LeaseConnectInfoDto { LeaseId = 41, OrganizationId = 7, EnvelopeId = "env-41" };
        var completed = new DocuSignConnectUpdate("env-41", ESignatureStatus.Completed, CompletedAt,
            new Dictionary<string, DateTime>(), CompletedAt);
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.ApplyDocuSignConnectUpdateAsync(mapping, completed, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocuSignConnectApplyResult(false, 0, ESignatureStatus.Completed, persistedCompletion));
        var recorder = new CapturingRecorder();

        var result = await new DocuSignConnectProcessor(repository.Object, recorder)
            .SynchronizeAsync(mapping, completed, CancellationToken.None);

        result.Applied.Should().BeFalse();
        recorder.Requests.Should().ContainSingle().Which.OccurredAtUtc
            .Should().Be(new DateTimeOffset(persistedCompletion));
    }

    [Fact]
    public async Task Connect_conflicting_terminal_replay_does_not_record_completed_occurrence()
    {
        var mapping = new LeaseConnectInfoDto { LeaseId = 41, OrganizationId = 7, EnvelopeId = "env-41" };
        var completed = new DocuSignConnectUpdate("env-41", ESignatureStatus.Completed, CompletedAt,
            new Dictionary<string, DateTime>(), CompletedAt);
        var repository = new Mock<ILeaseRepository>(MockBehavior.Strict);
        repository.Setup(x => x.ApplyDocuSignConnectUpdateAsync(mapping, completed, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new DocuSignConnectApplyResult(false, 0, ESignatureStatus.Declined, null));
        var recorder = new CapturingRecorder();

        await new DocuSignConnectProcessor(repository.Object, recorder)
            .SynchronizeAsync(mapping, completed, CancellationToken.None);

        recorder.Requests.Should().BeEmpty();
    }

    [Fact]
    public void Screening_and_invite_wiring_is_post_authority_post_persistence_and_contains_no_sensitive_data()
    {
        var screening = ReadSource("property-peace-api", "Services", "Screening", "TenantScreeningService.cs");
        screening.Should().Contain("RecordScreeningCompletedAsync");
        screening.Should().Contain("ScreeningTransitionSource.ProviderWebhook");
        screening.Should().Contain("ScreeningTransitionSource.ProviderPolling");

        var invites = ReadSource("property-peace-api", "Services", "TenantInviteService", "TenantInviteService.cs");
        var create = invites.IndexOf("CreateInvite(invite, userId, organizationId, token", StringComparison.Ordinal);
        var sent = invites.IndexOf("SendInviteEmailAsync(created, token)", StringComparison.Ordinal);
        var record = invites.IndexOf("RecordTenantInvitedAsync(created", StringComparison.Ordinal);
        var scopedTenant = invites.IndexOf("t.Id == invite.TenantId && t.OrganizationId == organizationId", StringComparison.Ordinal);
        create.Should().BeGreaterThan(-1);
        sent.Should().BeGreaterThan(create, "delivery is attempted only after durable invite persistence");
        scopedTenant.Should().BeGreaterThan(-1);
        create.Should().BeGreaterThan(scopedTenant, "cross-organization tenants are rejected before persistence or recording");
        record.Should().BeGreaterThan(sent, "an invite occurrence is emitted only after authoritative delivery acceptance");
        invites.Should().Contain("RecordTenantInvitedAsync(replacement");
        invites.Should().NotContain("ActivationOccurrenceRequest(organizationId, ActivationMilestones.TenantInvited, invite.Email");

        var expiration = invites.IndexOf("if (invite.ExpiresAt < DateTime.Now)", StringComparison.Ordinal);
        var followingSection = invites.IndexOf("// Get property and landlord information", expiration, StringComparison.Ordinal);
        expiration.Should().BeGreaterThan(-1);
        invites[expiration..followingSection].Should().NotContain("DeleteInvite",
            "expiration invalidates access but must not erase durable invite or activation history");
    }

    private sealed class CapturingRecorder : IActivationOccurrenceRecorder
    {
        public List<ActivationOccurrenceRequest> Requests { get; } = [];
        public Task<bool> RecordAsync(ActivationOccurrenceRequest request, CancellationToken cancellationToken = default)
        {
            Requests.Add(request);
            return Task.FromResult(Requests.Count == 1);
        }
    }

    private static string ReadSource(params string[] segments)
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current is not null)
        {
            var candidate = Path.Combine(new[] { current.FullName }.Concat(segments).ToArray());
            if (File.Exists(candidate)) return File.ReadAllText(candidate);
            current = current.Parent;
        }
        throw new FileNotFoundException(string.Join(Path.DirectorySeparatorChar, segments));
    }
}
