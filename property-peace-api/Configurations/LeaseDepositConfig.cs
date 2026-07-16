using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseDepositConfig : IEntityTypeConfiguration<LeaseDeposit>
    {
        public void Configure(EntityTypeBuilder<LeaseDeposit> b)
        {
            b.ToTable("LeaseDeposits", "lease");
            b.HasIndex(x => x.LeaseId);
            b.HasIndex(x => x.OrganizationId);
            b.HasOne(x => x.Lease)
                .WithMany(l => l.LeaseDeposits)
                .HasForeignKey(x => x.LeaseId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Organization)
                .WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
            b.Property(x => x.Name).HasMaxLength(200);
        }
    }
}
