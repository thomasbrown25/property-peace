using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class MarketingEmailOptOutConfig : IEntityTypeConfiguration<MarketingEmailOptOut>
{
    public void Configure(EntityTypeBuilder<MarketingEmailOptOut> builder)
    {
        builder.ToTable("MarketingEmailOptOuts", "communication");
        builder.HasKey(x => x.EmailHash);
        builder.Property(x => x.EmailHash)
            .HasMaxLength(64)
            .HasColumnType("varchar(64)");
        builder.Property(x => x.UnsubscribedAtUtc)
            .HasColumnType("datetimeoffset");
    }
}
