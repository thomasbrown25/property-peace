using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class CustomFeatureConfig : IEntityTypeConfiguration<CustomFeature>
    {
        public void Configure(EntityTypeBuilder<CustomFeature> b)
        {
            b.ToTable("CustomFeatures", "listing");
            b.Property(f => f.Name).HasMaxLength(200).IsRequired();
            b.HasOne(f => f.Organization)
                .WithMany()
                .HasForeignKey(f => f.OrganizationId)
                .OnDelete(DeleteBehavior.NoAction);
            b.HasOne(f => f.CreatedByUser)
                .WithMany()
                .HasForeignKey(f => f.CreatedBy)
                .OnDelete(DeleteBehavior.NoAction);
            b.HasIndex(f => f.OrganizationId);
        }
    }
}
