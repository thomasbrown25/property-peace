using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseOccupantConfig : IEntityTypeConfiguration<LeaseOccupant>
    {
        public void Configure(EntityTypeBuilder<LeaseOccupant> b)
        {
            b.ToTable("LeaseOccupants", "lease");
            b.HasOne(x => x.Lease)
                .WithMany(l => l.LeaseOccupants)
                .HasForeignKey(x => x.LeaseId)
                .OnDelete(DeleteBehavior.Cascade);
            b.Property(x => x.FirstName).HasMaxLength(200);
            b.Property(x => x.LastName).HasMaxLength(200);
            b.Property(x => x.Email).HasMaxLength(256);
        }
    }
}
