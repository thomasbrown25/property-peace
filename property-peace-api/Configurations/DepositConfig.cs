using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class DepositConfig : IEntityTypeConfiguration<Deposit>
    {
        public void Configure(EntityTypeBuilder<Deposit> b)
        {
            b.ToTable("Deposits", "financial");
            b.HasKey(d => d.Id);

            b.Property(d => d.Amount).HasPrecision(18, 2);
            b.Property(d => d.RefundAmount).HasPrecision(18, 2);

            b.HasOne(d => d.Lease)
                .WithMany(l => l.Deposits)
                .HasForeignKey(d => d.LeaseId)
                .OnDelete(DeleteBehavior.Cascade);
                
            // Organization relationship
            b.HasOne(d => d.Organization)
                .WithMany()
                .HasForeignKey(d => d.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
                
            b.HasIndex(d => d.OrganizationId);
        }
    }
}