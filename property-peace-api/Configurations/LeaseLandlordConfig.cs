using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseLandlordConfig : IEntityTypeConfiguration<LeaseLandlord>
    {
        public void Configure(EntityTypeBuilder<LeaseLandlord> b)
        {
            b.ToTable("LeaseLandlords", "lease");
            b.HasOne(x => x.Lease)
                .WithMany(l => l.LeaseLandlords)
                .HasForeignKey(x => x.LeaseId)
                .OnDelete(DeleteBehavior.Cascade);
            b.Property(x => x.EntityType).HasMaxLength(50);
            b.Property(x => x.FirstName).HasMaxLength(200);
            b.Property(x => x.LastName).HasMaxLength(200);
            b.Property(x => x.CompanyName).HasMaxLength(300);
            b.Property(x => x.Email).HasMaxLength(256);
            b.Property(x => x.Phone).HasMaxLength(50);
            b.Property(x => x.StreetAddress).HasMaxLength(500);
            b.Property(x => x.Unit).HasMaxLength(50);
            b.Property(x => x.City).HasMaxLength(200);
            b.Property(x => x.State).HasMaxLength(50);
            b.Property(x => x.ZipCode).HasMaxLength(20);
        }
    }
}
