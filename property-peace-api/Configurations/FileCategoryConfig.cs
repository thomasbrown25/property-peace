using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class FileCategoryConfig : IEntityTypeConfiguration<FileCategory>
    {
        public void Configure(EntityTypeBuilder<FileCategory> builder)
        {
            builder.ToTable("FileCategories", "document");
            builder.HasKey(fc => fc.Id);

            builder.Property(fc => fc.Name)
                .IsRequired()
                .HasMaxLength(200);

            // Organization relationship
            // Using NoAction instead of Cascade to avoid multiple cascade paths
            // Deletion is handled explicitly in HardDeleteOrganizationCompletely
            builder.HasOne(fc => fc.Organization)
                .WithMany()
                .HasForeignKey(fc => fc.OrganizationId)
                .OnDelete(DeleteBehavior.NoAction);

            // Indexes
            builder.HasIndex(fc => fc.OrganizationId);
            builder.HasIndex(fc => fc.Name);
        }
    }
}

