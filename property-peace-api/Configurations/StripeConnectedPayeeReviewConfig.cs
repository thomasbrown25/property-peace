using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public sealed class StripeConnectedPayeeReviewConfig : IEntityTypeConfiguration<StripeConnectedPayeeReview>
    {
        public void Configure(EntityTypeBuilder<StripeConnectedPayeeReview> builder)
        {
            builder.ToTable("StripeConnectedPayeeReviews", "financial");
            builder.Property(x => x.StripeAccountId).HasMaxLength(255).IsRequired();
            builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            builder.Property(x => x.ApprovalEvidence).HasMaxLength(500);
            builder.Property(x => x.ApprovalNotes).HasMaxLength(2000);
            builder.Property(x => x.SuspensionReason).HasMaxLength(1000);
            builder.Property(x => x.StripeTransferCapabilityStatus).HasMaxLength(64);
            builder.Property(x => x.StripeDisabledReason).HasMaxLength(255);
            builder.Property(x => x.ExternalAccountFingerprint).HasMaxLength(255);
            builder.Property(x => x.LastStripeEventId).HasMaxLength(255);
            builder.Property(x => x.PayoutSchedulePolicy).HasMaxLength(32);
            builder.Property(x => x.RowVersion).IsRowVersion();
            builder.HasIndex(x => x.StripeAccountId).IsUnique();
            builder.HasIndex(x => x.UserId).IsUnique().HasFilter("[UserId] IS NOT NULL");
            builder.HasIndex(x => new { x.Status, x.UpdatedAt });
            builder.HasIndex(x => new { x.ApprovedOrganizationId, x.Status });
            // Preserve review ownership and block user deletion until financial approval records are handled explicitly.
            builder.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        }
    }
}
