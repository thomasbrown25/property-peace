using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class LeaseShieldStateLawSectionConfig : IEntityTypeConfiguration<LeaseShieldStateLawSection>
    {
        public void Configure(EntityTypeBuilder<LeaseShieldStateLawSection> b)
        {
            b.ToTable("StateLawSections", "lease_shield");
            b.HasIndex(x => new { x.State, x.SectionCode }).IsUnique();
            b.HasIndex(x => x.State);
        }
    }
}
