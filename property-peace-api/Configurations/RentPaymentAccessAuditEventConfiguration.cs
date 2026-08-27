using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class RentPaymentAccessAuditEventConfiguration : IEntityTypeConfiguration<RentPaymentAccessAuditEvent>
{
    public void Configure(EntityTypeBuilder<RentPaymentAccessAuditEvent> builder)
    {
        builder.ToTable("RentPaymentAccessAuditEvents", "financial");
        builder.HasKey(x => x.Id);

        builder.Property(x => x.PriorStatus).HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.NextStatus).HasConversion<string>().HasMaxLength(32);
        builder.Property(x => x.SafeMetadataJson).HasMaxLength(2000);

        builder.HasIndex(x => new { x.RentPaymentAccessRequestId, x.OccurredAtUtc });
        builder.HasIndex(x => new { x.OrganizationId, x.OccurredAtUtc });
    }
}
