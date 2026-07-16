using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class UpcomingFeatureConfig : IEntityTypeConfiguration<UpcomingFeature>
    {
        public void Configure(EntityTypeBuilder<UpcomingFeature> b)
        {
            b.ToTable("UpcomingFeatures", "admin");
            b.HasIndex(f => f.DisplayOrder);
            b.HasIndex(f => f.IsActive);
        }
    }
}

