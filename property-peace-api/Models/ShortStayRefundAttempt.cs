namespace brownstone_hub_api.Models;

public enum ShortStayRefundAttemptStatus { Ready, Pending, ManualReview, Succeeded }

// One immutable provider request identity per reservation/payment intent. Never rotate the key.
public sealed class ShortStayRefundAttempt
{
    public long Id { get; set; }
    public long ReservationId { get; set; }
    public ShortStayReservation Reservation { get; set; } = null!;
    public string PaymentIntentId { get; set; } = string.Empty;
    public string IdempotencyKey { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? FirstAttemptAtUtc { get; set; }
    public DateTimeOffset? LastAttemptAtUtc { get; set; }
    public int AttemptCount { get; set; }
    public ShortStayRefundAttemptStatus Status { get; set; }
    public DateTimeOffset? ManualReviewAtUtc { get; set; }
}
