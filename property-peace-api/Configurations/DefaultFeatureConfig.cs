using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class DefaultFeatureConfig : IEntityTypeConfiguration<DefaultFeature>
    {
        public void Configure(EntityTypeBuilder<DefaultFeature> b)
        {
            b.ToTable("DefaultFeatures", "listing");
            b.Property(f => f.Name).HasMaxLength(200).IsRequired();
            b.HasIndex(f => f.Name).IsUnique();
        }
    }
}
