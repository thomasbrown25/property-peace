using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class StateLateFeeLawConfig : IEntityTypeConfiguration<StateLateFeeLaw>
    {
        public void Configure(EntityTypeBuilder<StateLateFeeLaw> b)
        {
            b.ToTable("StateLateFeeLaws", "lease");
            // Index on State for faster queries
            b.HasIndex(s => s.State).IsUnique();

            // Index on LastUpdated for finding states needing update
            b.HasIndex(s => s.LastUpdated);
        }
    }
}
