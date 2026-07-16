using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;
using FileEntity = brownstone_hub_api.Models.File;

namespace brownstone_hub_api.Configurations
{
    public class FileConfig : IEntityTypeConfiguration<FileEntity>
    {
        public void Configure(EntityTypeBuilder<FileEntity> builder)
        {
            builder.ToTable("Files", "document");
            builder.HasKey(f => f.Id);

            builder.Property(f => f.Title)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(f => f.FileName)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(f => f.BlobName)
                .IsRequired()
                .HasMaxLength(500);

            builder.Property(f => f.BlobUrl)
                .IsRequired()
                .HasMaxLength(1000);

            builder.Property(f => f.SharingInfo)
                .HasMaxLength(2000);

            // Category relationship
            // Using NoAction to avoid multiple cascade paths through Organization → FileCategories → Files
            builder.HasOne(f => f.Category)
                .WithMany(c => c.Files)
                .HasForeignKey(f => f.CategoryId)
                .OnDelete(DeleteBehavior.NoAction);

            // Property relationship
            // Using NoAction to avoid multiple cascade paths through Organization → Properties → Files
            builder.HasOne(f => f.Property)
                .WithMany()
                .HasForeignKey(f => f.PropertyId)
                .OnDelete(DeleteBehavior.NoAction);

            // Unit relationship
            // Using NoAction to avoid multiple cascade paths through Organization → Properties → Units → Files
            builder.HasOne(f => f.Unit)
                .WithMany()
                .HasForeignKey(f => f.UnitId)
                .OnDelete(DeleteBehavior.NoAction);

            // Lease relationship
            // Using NoAction to avoid multiple cascade paths
            builder.HasOne(f => f.Lease)
                .WithMany()
                .HasForeignKey(f => f.LeaseId)
                .OnDelete(DeleteBehavior.NoAction);

            // Organization relationship
            // Using NoAction instead of Cascade to avoid multiple cascade paths
            // Deletion is handled explicitly in HardDeleteOrganizationCompletely
            builder.HasOne(f => f.Organization)
                .WithMany()
                .HasForeignKey(f => f.OrganizationId)
                .OnDelete(DeleteBehavior.NoAction);

            // CreatedBy relationship
            // Using NoAction to avoid multiple cascade paths through Organization → Users → Files
            builder.HasOne(f => f.CreatedByUser)
                .WithMany()
                .HasForeignKey(f => f.CreatedBy)
                .OnDelete(DeleteBehavior.NoAction);

            // UpdatedBy relationship
            // Using NoAction to avoid multiple cascade paths through Organization → Users → Files
            builder.HasOne(f => f.UpdatedByUser)
                .WithMany()
                .HasForeignKey(f => f.UpdatedBy)
                .OnDelete(DeleteBehavior.NoAction);

            // Indexes
            builder.HasIndex(f => f.OrganizationId);
            builder.HasIndex(f => f.CategoryId);
            builder.HasIndex(f => f.PropertyId);
            builder.HasIndex(f => f.UnitId);
            builder.HasIndex(f => f.LeaseId);
            builder.HasIndex(f => f.CreatedBy);
            builder.HasIndex(f => f.UpdatedBy);
        }
    }
}

