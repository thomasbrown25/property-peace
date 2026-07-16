using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class TenantLeaseConfig : IEntityTypeConfiguration<TenantLease>
    {
        public void Configure(EntityTypeBuilder<TenantLease> b)
        {
            b.ToTable("TenantLeases", "lease");
            // Composite primary key
            b.HasKey(tl => new { tl.TenantId, tl.LeaseId });

            // Configure relationships
            b.HasOne(tl => tl.Tenant)
             .WithMany(t => t.TenantLeases)
             .HasForeignKey(tl => tl.TenantId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(tl => tl.Lease)
             .WithMany(l => l.TenantLeases)
             .HasForeignKey(tl => tl.LeaseId)
             .OnDelete(DeleteBehavior.Cascade);

            // Indexes for common queries
            b.HasIndex(tl => tl.TenantId);
            b.HasIndex(tl => tl.LeaseId);
            b.HasIndex(tl => tl.CreatedAt);
        }
    }
}
