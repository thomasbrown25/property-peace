using brownstone_hub_api.Models;
using FluentAssertions;
using Xunit;

namespace brownstone_hub_api.Tests.Services.Screening;

public sealed class ScreeningAdverseActionRetryTests
{
    private static readonly DateTimeOffset Now = new(2026, 8, 7, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public void Recovery_lease_is_exclusive_until_expiry_and_rejects_terminal_attempts()
    {
        var attempt = Attempt(1);
        attempt.MarkRequested(Now.AddMinutes(-5));
        var first = Guid.NewGuid();

        attempt.TryAcquireRecoveryLease(first, Now, Now.AddMinutes(2)).Should().BeTrue();
        attempt.TryAcquireRecoveryLease(Guid.NewGuid(), Now.AddMinutes(1), Now.AddMinutes(3)).Should().BeFalse();
        attempt.TryAcquireRecoveryLease(Guid.NewGuid(), Now.AddMinutes(2), Now.AddMinutes(4)).Should().BeTrue();
        attempt.MarkDeadLettered();
        attempt.TryAcquireRecoveryLease(Guid.NewGuid(), Now.AddMinutes(5), Now.AddMinutes(6)).Should().BeFalse();
    }

    [Fact]
    public void Failure_schedules_retry_then_dead_letters_at_the_bound_and_clears_lease()
    {
        var retryable = Attempt(2);
        retryable.MarkRequested(Now);
        retryable.TryAcquireRecoveryLease(Guid.NewGuid(), Now, Now.AddMinutes(2)).Should().BeTrue();

        retryable.ScheduleFailure("MailboxUnavailable", Now, Now.AddMinutes(2), 3).Should().BeFalse();
        retryable.Status.Should().Be(ScreeningDeliveryAttemptStatus.Failed);
        retryable.NextAttemptAt.Should().Be(Now.AddMinutes(2));
        retryable.ProcessingLeaseId.Should().BeNull();

        var exhausted = Attempt(3);
        exhausted.MarkRequested(Now);
        exhausted.ScheduleFailure("MailboxUnavailable", Now, Now.AddMinutes(4), 3).Should().BeTrue();
        exhausted.Status.Should().Be(ScreeningDeliveryAttemptStatus.DeadLettered);
        exhausted.NextAttemptAt.Should().BeNull();
        exhausted.FailureCode.Should().Be("MaximumDeliveryAttemptsExceeded");
    }

    [Fact]
    public void Lease_honors_scheduled_eligibility_and_delivery_clears_recovery_state()
    {
        var attempt = Attempt(1);
        attempt.MarkRequested(Now);
        attempt.ScheduleFailure("Temporary", Now, Now.AddMinutes(2), 3).Should().BeFalse();

        attempt.TryAcquireRecoveryLease(Guid.NewGuid(), Now.AddMinutes(1), Now.AddMinutes(3)).Should().BeFalse();
        attempt.TryAcquireRecoveryLease(Guid.NewGuid(), Now.AddMinutes(2), Now.AddMinutes(4)).Should().BeTrue();
        attempt.MarkDelivered("reference", Now.AddMinutes(3));
        attempt.NextAttemptAt.Should().BeNull();
        attempt.ProcessingLeaseId.Should().BeNull();
        attempt.ProcessingLeaseUntil.Should().BeNull();
    }

    [Fact]
    public void Cancellation_expired_final_lease_enters_manual_review_without_an_extra_provider_attempt()
    {
        var intent = new ScreeningCancellationIntent();
        intent.TryClaim(Guid.NewGuid(), Now.AddMinutes(-2), Now.AddMinutes(-1), 1).Should().BeTrue();

        intent.FinalizeExpiredLeaseAtBound(Now, 1).Should().BeTrue();
        intent.Status.Should().Be(ScreeningCancellationIntentStatus.ManualReview);
        intent.Attempts.Should().Be(1);
        intent.FailureCode.Should().Be("ProviderOutcomeUnknown");
        intent.ProcessingLeaseId.Should().BeNull();
        intent.NextAttemptAt.Should().BeNull();
        intent.TryClaim(Guid.NewGuid(), Now, Now.AddMinutes(1), 1).Should().BeFalse();
    }

    [Fact]
    public void Dispute_expired_final_lease_dead_letters_without_an_extra_provider_attempt()
    {
        var intent = new ScreeningDisputeIntent();
        intent.TryClaim(Guid.NewGuid(), Now.AddMinutes(-2), Now.AddMinutes(-1), 1).Should().BeTrue();

        intent.FinalizeExpiredLeaseAtBound(Now, 1).Should().BeTrue();
        intent.Status.Should().Be(ScreeningDisputeIntentStatus.DeadLettered);
        intent.Attempts.Should().Be(1);
        intent.FailureCode.Should().Be("ProviderOutcomeUnknown");
        intent.ProcessingLeaseId.Should().BeNull();
        intent.NextAttemptAt.Should().BeNull();
        intent.TryClaim(Guid.NewGuid(), Now, Now.AddMinutes(1), 1).Should().BeFalse();
    }

    private static ScreeningAdverseActionDeliveryAttempt Attempt(int number) => new()
    {
        AttemptNumber = number,
        ScreeningAdverseActionId = 1,
        OrganizationId = 2,
        Channel = ScreeningAdverseActionDeliveryChannel.Email,
        NoticeContentSha256Hash = new string('a', 64),
        ProviderIdempotencyKey = new string('b', 64)
    };
}