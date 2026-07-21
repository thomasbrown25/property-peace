using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class StorageObjectConfig : IEntityTypeConfiguration<StorageObject>
    {
        public void Configure(EntityTypeBuilder<StorageObject> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Category).IsRequired().HasMaxLength(80);
            builder.Property(x => x.EntityType).HasMaxLength(80);
            builder.Property(x => x.FileName).HasMaxLength(512);
            builder.Property(x => x.BlobContainer).HasMaxLength(255);
            builder.Property(x => x.BlobName).IsRequired().HasMaxLength(1024);
            builder.Property(x => x.BlobUrl).HasMaxLength(2048);
            builder.Property(x => x.ContentType).HasMaxLength(255);
            builder.Property(x => x.Source).IsRequired().HasMaxLength(80);
            builder.Property(x => x.MetadataJson).HasColumnType("nvarchar(max)");
            builder.Property(x => x.CreatedAt).HasDefaultValueSql("GETUTCDATE()");

            builder.HasOne(x => x.Organization)
                .WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(x => x.UploadedByUser)
                .WithMany()
                .HasForeignKey(x => x.UploadedByUserId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasOne(x => x.OwnerUser)
                .WithMany()
                .HasForeignKey(x => x.OwnerUserId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasIndex(x => x.CreatedAt);
            builder.HasIndex(x => new { x.OrganizationId, x.CreatedAt });
            builder.HasIndex(x => new { x.UploadedByUserId, x.CreatedAt });
            builder.HasIndex(x => new { x.OwnerUserId, x.CreatedAt });
            builder.HasIndex(x => new { x.Category, x.CreatedAt });
            builder.HasIndex(x => new { x.EntityType, x.EntityId });
            builder.HasIndex(x => new { x.BlobContainer, x.BlobName });
        }
    }
}
