using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayRefundAttemptConfig : IEntityTypeConfiguration<ShortStayRefundAttempt>
{
    public void Configure(EntityTypeBuilder<ShortStayRefundAttempt> b)
    {
        b.ToTable("ShortStayRefundAttempts", "listing", t =>
        {
            t.HasCheckConstraint("CK_ShortStayRefundAttempts_Count", "[AttemptCount] >= 0 AND (([AttemptCount] = 0 AND [FirstAttemptAtUtc] IS NULL AND [LastAttemptAtUtc] IS NULL) OR ([AttemptCount] > 0 AND [FirstAttemptAtUtc] IS NOT NULL AND [LastAttemptAtUtc] >= [FirstAttemptAtUtc]))");
            t.HasCheckConstraint("CK_ShortStayRefundAttempts_Review", "([Status] = 'ManualReview' AND [ManualReviewAtUtc] IS NOT NULL) OR ([Status] <> 'ManualReview' AND [ManualReviewAtUtc] IS NULL)");
            t.HasCheckConstraint("CK_ShortStayRefundAttempts_Status", "[Status] IN ('Ready','Pending','ManualReview','Succeeded')");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.PaymentIntentId).HasMaxLength(255).IsRequired();
        b.Property(x => x.IdempotencyKey).HasMaxLength(255).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        b.HasIndex(x => new { x.ReservationId, x.PaymentIntentId }).IsUnique();
        b.HasIndex(x => x.ReservationId).IsUnique();
        b.HasIndex(x => x.IdempotencyKey).IsUnique();
        b.HasOne(x => x.Reservation).WithMany().HasForeignKey(x => x.ReservationId).OnDelete(DeleteBehavior.NoAction);
    }
}
