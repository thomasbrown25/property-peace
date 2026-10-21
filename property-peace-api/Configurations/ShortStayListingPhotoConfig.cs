using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayListingPhotoConfig : IEntityTypeConfiguration<ShortStayListingPhoto>
{
    public void Configure(EntityTypeBuilder<ShortStayListingPhoto> b)
    {
        b.ToTable("ShortStayListingPhotos", "listing", t =>
        {
            t.HasCheckConstraint("CK_ShortStayListingPhotos_DisplayOrder", "[DisplayOrder] >= 0");
            t.HasCheckConstraint("CK_ShortStayListingPhotos_BlobName", "[BlobName] <> ''");
        });
        b.HasKey(x => x.Id);
        b.HasOne(x => x.ShortStayListing).WithMany(x => x.Photos)
            .HasForeignKey(x => x.ShortStayListingId).IsRequired()
            .OnDelete(DeleteBehavior.NoAction);
        b.Property(x => x.BlobName).HasMaxLength(512).IsRequired();
        b.Property(x => x.DisplayOrder).IsRequired();
        b.Property(x => x.IsCoverPhoto).IsRequired();
        b.Property(x => x.CreatedAtUtc).IsRequired();
        b.HasIndex(x => x.BlobName).IsUnique();
        b.HasIndex(x => new { x.ShortStayListingId, x.DisplayOrder }).IsUnique();
        b.HasIndex(x => x.ShortStayListingId).IsUnique().HasFilter("[IsCoverPhoto] = 1");
    }
}
