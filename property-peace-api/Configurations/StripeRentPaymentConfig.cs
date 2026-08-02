using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public sealed class StripeRentPaymentConfig : IEntityTypeConfiguration<StripeRentPayment>
    {
        public void Configure(EntityTypeBuilder<StripeRentPayment> builder)
        {
            builder.ToTable("StripeRentPayments", "financial");
            builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            builder.Property(x => x.AmountCents).IsRequired();
            builder.Property(x => x.RowVersion).IsRowVersion();
            builder.ToTable(table =>
            {
                table.HasCheckConstraint("CK_StripeRentPayments_PositiveAmount", "[AmountCents] > 0");
                table.HasCheckConstraint("CK_StripeRentPayments_NonnegativeCounters",
                    "[RefundedAmountCents] >= 0 AND [DisputedAmountCents] >= 0 AND [ReversedAmountCents] >= 0 AND [ReversalTargetAmountCents] >= 0 AND [ReversalIncrementAmountCents] >= 0");
                table.HasCheckConstraint("CK_StripeRentPayments_LossWithinAmount",
                    "[RefundedAmountCents] <= [AmountCents] AND [DisputedAmountCents] <= [AmountCents]");
                table.HasCheckConstraint("CK_StripeRentPayments_ReversalWithinAmount",
                    "[ReversedAmountCents] <= [AmountCents] AND [ReversalTargetAmountCents] <= [AmountCents] AND [ReversalIncrementAmountCents] <= [AmountCents] AND (([ReversalTargetAmountCents] = 0 AND [ReversalIncrementAmountCents] = 0) OR ([ReversalTargetAmountCents] > [ReversedAmountCents] AND [ReversalIncrementAmountCents] = [ReversalTargetAmountCents] - [ReversedAmountCents]))");
            });
            builder.HasIndex(x => x.OperationId).IsUnique();
            builder.HasIndex(x => x.PaymentIntentId).IsUnique();
            builder.HasIndex(x => x.StripeTransferId).IsUnique().HasFilter("[StripeTransferId] IS NOT NULL");
            builder.HasIndex(x => new { x.Status, x.TransferEligibleAt });
            builder.HasOne(x => x.Lease).WithMany().HasForeignKey(x => x.LeaseId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(x => x.Organization).WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        }
    }
}
