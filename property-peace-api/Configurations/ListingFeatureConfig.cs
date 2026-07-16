using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ListingFeatureConfig : IEntityTypeConfiguration<ListingFeature>
    {
        public void Configure(EntityTypeBuilder<ListingFeature> b)
        {
            b.ToTable("ListingFeatures", "listing");
            b.HasOne(lf => lf.Listing)
             .WithMany(l => l.ListingFeatures)
             .HasForeignKey(lf => lf.ListingId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(lf => lf.DefaultFeature)
                .WithMany()
                .HasForeignKey(lf => lf.DefaultFeatureId)
                .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(lf => lf.CustomFeature)
                .WithMany()
                .HasForeignKey(lf => lf.CustomFeatureId)
                .OnDelete(DeleteBehavior.NoAction);

            b.Property(lf => lf.IsAcquired).HasDefaultValue(true);
            b.HasIndex(lf => lf.ListingId);
        }
    }
}
