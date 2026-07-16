using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class LeaseShieldStateLawSourceConfig : IEntityTypeConfiguration<LeaseShieldStateLawSource>
    {
        public void Configure(EntityTypeBuilder<LeaseShieldStateLawSource> b)
        {
            b.ToTable("StateLawSources", "lease_shield");
            b.HasIndex(x => x.State).IsUnique();
        }
    }
}
