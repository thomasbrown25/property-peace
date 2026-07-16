using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class DocumentTemplateConfig : IEntityTypeConfiguration<DocumentTemplate>
    {
        public void Configure(EntityTypeBuilder<DocumentTemplate> builder)
        {
            builder.ToTable("DocumentTemplates", "document");
            builder.HasKey(dt => dt.Id);

            builder.Property(dt => dt.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(dt => dt.Description)
                .HasMaxLength(500);

            builder.Property(dt => dt.TemplateContent)
                .HasColumnType("nvarchar(max)");

            builder.Property(dt => dt.BlobName)
                .HasMaxLength(500);

            builder.Property(dt => dt.BlobUrl)
                .HasMaxLength(1000);

            builder.Property(dt => dt.VariablePlaceholders)
                .HasMaxLength(2000);

            // Relationships
            builder.HasOne(dt => dt.Landlord)
                .WithMany()
                .HasForeignKey(dt => dt.LandlordId)
                .OnDelete(DeleteBehavior.Cascade);

            // Organization relationship
            builder.HasOne(dt => dt.Organization)
                .WithMany()
                .HasForeignKey(dt => dt.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes
            builder.HasIndex(dt => dt.LandlordId);
            builder.HasIndex(dt => new { dt.LandlordId, dt.DocumentType });
            builder.HasIndex(dt => new { dt.LandlordId, dt.IsDeleted });
            builder.HasIndex(dt => dt.OrganizationId);
        }
    }
}

