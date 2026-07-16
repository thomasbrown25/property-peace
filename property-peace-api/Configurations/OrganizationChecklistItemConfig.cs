using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class OrganizationChecklistItemConfig : IEntityTypeConfiguration<OrganizationChecklistItem>
    {
        public void Configure(EntityTypeBuilder<OrganizationChecklistItem> builder)
        {
            builder.ToTable("OrganizationChecklistItems", "checklist");
            builder.HasKey(oci => oci.Id);

            builder.Property(oci => oci.Name)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(oci => oci.Description)
                .HasMaxLength(500);

            builder.Property(oci => oci.Category)
                .HasMaxLength(100);

            // Relationships
            builder.HasOne(oci => oci.Organization)
                .WithMany()
                .HasForeignKey(oci => oci.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            builder.HasIndex(oci => oci.OrganizationId);
            builder.HasIndex(oci => new { oci.OrganizationId, oci.IsDeleted });
        }
    }
}

