using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ListingImageConfig : IEntityTypeConfiguration<ListingImage>
    {
        public void Configure(EntityTypeBuilder<ListingImage> b)
        {
            b.ToTable("ListingImages", "listing");
            b.HasOne(i => i.Listing)
             .WithMany(l => l.Images)
             .HasForeignKey(i => i.RefId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasIndex(i => i.RefId);
            b.HasIndex(i => i.IsCoverPhoto);
        }
    }
}
