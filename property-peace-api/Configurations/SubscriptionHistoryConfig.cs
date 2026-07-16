using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class SubscriptionHistoryConfig : IEntityTypeConfiguration<SubscriptionHistory>
    {
        public void Configure(EntityTypeBuilder<SubscriptionHistory> b)
        {
            b.ToTable("SubscriptionHistories", "subscription");
            b.HasKey(sh => sh.Id);

            b.HasOne(sh => sh.Subscription)
                .WithMany(s => s.History)
                .HasForeignKey(sh => sh.SubscriptionId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Property(sh => sh.EventType)
                .IsRequired()
                .HasMaxLength(50);

            b.HasIndex(sh => sh.SubscriptionId);
            b.HasIndex(sh => sh.Timestamp);
            b.HasIndex(sh => new { sh.SubscriptionId, sh.Timestamp });
        }
    }
}

