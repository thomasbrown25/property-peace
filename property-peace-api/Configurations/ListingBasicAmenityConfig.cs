using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ListingBasicAmenityConfig : IEntityTypeConfiguration<ListingBasicAmenity>
    {
        public void Configure(EntityTypeBuilder<ListingBasicAmenity> b)
        {
            b.ToTable("ListingBasicAmenities", "listing");
            b.HasOne(lba => lba.Listing)
                .WithMany(l => l.ListingBasicAmenities)
                .HasForeignKey(lba => lba.ListingId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(lba => lba.BasicAmenity)
                .WithMany()
                .HasForeignKey(lba => lba.BasicAmenityId)
                .OnDelete(DeleteBehavior.NoAction);
            b.HasIndex(lba => lba.ListingId);
        }
    }
}
