using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayNightlyRateOverrideConfig : IEntityTypeConfiguration<ShortStayNightlyRateOverride>
{
    public void Configure(EntityTypeBuilder<ShortStayNightlyRateOverride> b)
    {
        b.ToTable("ShortStayNightlyRateOverrides", "listing", t =>
            t.HasCheckConstraint("CK_ShortStayNightlyRateOverrides_NightlyRate", "[NightlyRate] > 0"));
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.UnitId, x.Date }).IsUnique();
        b.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).IsRequired()
            .OnDelete(DeleteBehavior.NoAction);
        b.Property(x => x.Date).IsRequired();
        b.Property(x => x.NightlyRate).HasPrecision(18, 2).IsRequired();
    }
}
