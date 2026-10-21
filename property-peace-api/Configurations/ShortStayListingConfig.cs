using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayListingConfig : IEntityTypeConfiguration<ShortStayListing>
{
    public void Configure(EntityTypeBuilder<ShortStayListing> b)
    {
        b.ToTable("ShortStayListings", "listing", t =>
        {
            t.HasCheckConstraint("CK_ShortStayListings_NightlyBasePrice", "[NightlyBasePrice] > 0");
            t.HasCheckConstraint("CK_ShortStayListings_CleaningFee", "[CleaningFee] >= 0");
            t.HasCheckConstraint("CK_ShortStayListings_MinimumNights", "[MinimumNights] >= 1");
            t.HasCheckConstraint("CK_ShortStayListings_Capacity", "[Capacity] >= 1");
            t.HasCheckConstraint("CK_ShortStayListings_Status", "[Status] IN ('Draft', 'Published')");
            t.HasCheckConstraint("CK_ShortStayListings_LodgingTaxRatePercent", "[LodgingTaxRatePercent] IS NULL OR ([LodgingTaxRatePercent] >= 0 AND [LodgingTaxRatePercent] <= 100)");
            t.HasCheckConstraint("CK_ShortStayListings_TaxAttestation", "([LodgingTaxRatePercent] IS NULL AND [TaxPolicyAttestedAtUtc] IS NULL AND [TaxPolicyAttestedByUserId] IS NULL) OR ([LodgingTaxRatePercent] IS NOT NULL AND [TaxPolicyAttestedAtUtc] IS NOT NULL AND [TaxPolicyAttestedByUserId] > 0)");
        });
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.UnitId).IsUnique();
        b.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).IsRequired()
            .OnDelete(DeleteBehavior.NoAction);
        b.Property(x => x.NightlyBasePrice).HasPrecision(18, 2).IsRequired();
        b.Property(x => x.CleaningFee).HasPrecision(18, 2).IsRequired();
        b.Property(x => x.LodgingTaxRatePercent).HasPrecision(9, 4);
        b.Property(x => x.MinimumNights).IsRequired();
        b.Property(x => x.Capacity).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(32)
            .HasDefaultValue(ShortStayListingStatus.Draft).IsRequired();
        b.Property(x => x.HouseRules).HasMaxLength(4000);
        b.Property(x => x.Amenities).HasMaxLength(4000);
        b.Property(x => x.CancellationPolicy).HasMaxLength(2000);
        b.Property(x => x.PublicTitle).HasMaxLength(100);
        b.Property(x => x.PublicSummary).HasMaxLength(1200);
    }
}
