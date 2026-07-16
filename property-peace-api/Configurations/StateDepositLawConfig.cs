using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class StateDepositLawConfig : IEntityTypeConfiguration<StateDepositLaw>
    {
        public void Configure(EntityTypeBuilder<StateDepositLaw> b)
        {
            b.ToTable("StateDepositLaws", "lease");
            b.HasIndex(s => s.State).IsUnique();
            b.HasIndex(s => s.LastUpdated);
        }
    }
}
