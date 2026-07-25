using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class PasskeyCeremonyConfig : IEntityTypeConfiguration<PasskeyCeremony>
    {
        public void Configure(EntityTypeBuilder<PasskeyCeremony> builder)
        {
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Type).HasMaxLength(20).IsRequired();
            builder.Property(x => x.OptionsJson).IsRequired();
            builder.HasIndex(x => x.ExpiresAt);
        }
    }
}
