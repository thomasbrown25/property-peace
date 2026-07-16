using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class StateLawSourceConfig : IEntityTypeConfiguration<StateLawSource>
    {
        public void Configure(EntityTypeBuilder<StateLawSource> b)
        {
            b.ToTable("StateLawSources", "admin");
            b.HasIndex(x => x.State).IsUnique();
        }
    }
}
