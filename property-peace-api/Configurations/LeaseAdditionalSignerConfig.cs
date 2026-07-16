using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseAdditionalSignerConfig : IEntityTypeConfiguration<LeaseAdditionalSigner>
    {
        public void Configure(EntityTypeBuilder<LeaseAdditionalSigner> b)
        {
            b.ToTable("LeaseAdditionalSigners", "lease");
            b.HasOne(x => x.Lease)
                .WithMany(l => l.LeaseAdditionalSigners)
                .HasForeignKey(x => x.LeaseId)
                .OnDelete(DeleteBehavior.Cascade);
            b.Property(x => x.FirstName).HasMaxLength(200);
            b.Property(x => x.LastName).HasMaxLength(200);
            b.Property(x => x.Email).HasMaxLength(256);
        }
    }
}
