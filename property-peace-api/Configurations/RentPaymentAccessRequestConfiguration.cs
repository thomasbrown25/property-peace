using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class RentPaymentAccessRequestConfiguration : IEntityTypeConfiguration<RentPaymentAccessRequest>
{
    public void Configure(EntityTypeBuilder<RentPaymentAccessRequest> builder)
    {
        builder.ToTable("RentPaymentAccessRequests", "financial");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.PublicId).IsRequired();
        builder.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.DecisionReason).HasMaxLength(1000);
        builder.Property(x => x.InternalNotes).HasMaxLength(2000);
        builder.Property(x => x.RowVersion).IsRowVersion();

        builder.HasIndex(x => x.OrganizationId).IsUnique();
        builder.HasIndex(x => x.PublicId).IsUnique();

        builder.HasMany(x => x.AuditEvents)
            .WithOne(x => x.RentPaymentAccessRequest)
            .HasForeignKey(x => x.RentPaymentAccessRequestId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
