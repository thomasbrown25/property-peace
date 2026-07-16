using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ListingAmenityConfig : IEntityTypeConfiguration<ListingAmenity>
    {
        public void Configure(EntityTypeBuilder<ListingAmenity> b)
        {
            b.ToTable("ListingAmenities", "listing");
            b.HasOne(la => la.Listing)
             .WithMany(l => l.ListingAmenities)
             .HasForeignKey(la => la.ListingId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(la => la.DefaultAmenity)
             .WithMany()
             .HasForeignKey(la => la.DefaultAmenityId)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(la => la.CustomAmenity)
             .WithMany()
             .HasForeignKey(la => la.CustomAmenityId)
             .OnDelete(DeleteBehavior.NoAction);

            b.Property(la => la.IsAcquired).HasDefaultValue(true);
            b.HasIndex(la => la.ListingId);
        }
    }
}
