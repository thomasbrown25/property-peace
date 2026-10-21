using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayIcalOccurrenceConfig : IEntityTypeConfiguration<ShortStayIcalOccurrence>
{
    public void Configure(EntityTypeBuilder<ShortStayIcalOccurrence> b)
    {
        b.ToTable("ShortStayIcalOccurrences", "listing", t =>
        {
            t.HasCheckConstraint("CK_ShortStayIcalOccurrences_DateRange", "[EndDate] > [StartDate]");
            t.HasCheckConstraint("CK_ShortStayIcalOccurrences_UidKey", "[UidKey] <> ''");
            t.HasCheckConstraint("CK_ShortStayIcalOccurrences_RecurrenceKey", "[RecurrenceKey] <> ''");
        });
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.SubscriptionId, x.UidKey, x.RecurrenceKey }).IsUnique();
        b.HasIndex(x => new { x.SubscriptionId, x.StartDate, x.EndDate });
        b.HasOne(x => x.Subscription).WithMany(x => x.Occurrences).HasForeignKey(x => x.SubscriptionId)
            .IsRequired().OnDelete(DeleteBehavior.Cascade);
        b.Property(x => x.UidKey).HasMaxLength(64).IsRequired();
        b.Property(x => x.RecurrenceKey).HasMaxLength(64).IsRequired();
        b.Property(x => x.StartDate).IsRequired();
        b.Property(x => x.EndDate).IsRequired();
    }
}
