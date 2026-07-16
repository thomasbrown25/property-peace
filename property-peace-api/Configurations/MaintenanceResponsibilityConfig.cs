using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class MaintenanceResponsibilityConfig : IEntityTypeConfiguration<MaintenanceResponsibility>
    {
        public void Configure(EntityTypeBuilder<MaintenanceResponsibility> b)
        {
            b.ToTable("MaintenanceResponsibility", "lease");
            b.HasIndex(x => x.LeaseId);
            b.HasIndex(x => x.OrganizationId);
            b.HasOne(x => x.Lease)
                .WithMany(l => l.MaintenanceResponsibilities)
                .HasForeignKey(x => x.LeaseId)
                .OnDelete(DeleteBehavior.Cascade);
            b.HasOne(x => x.Organization)
                .WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
