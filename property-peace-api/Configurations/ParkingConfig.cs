using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class ParkingConfig : IEntityTypeConfiguration<Parking>
    {
        public void Configure(EntityTypeBuilder<Parking> b)
        {
            b.ToTable("Parking", "lease");
            b.HasIndex(x => x.LeaseId).IsUnique();
            b.HasIndex(x => x.OrganizationId);
            b.HasOne(x => x.Lease)
                .WithOne(l => l.Parking)
                .HasForeignKey<Parking>(x => x.LeaseId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Organization)
                .WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
