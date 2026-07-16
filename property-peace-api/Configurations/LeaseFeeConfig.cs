using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class LeaseFeeConfig : IEntityTypeConfiguration<LeaseFee>
    {
        public void Configure(EntityTypeBuilder<LeaseFee> b)
        {
            b.ToTable("LeaseFees", "lease");
            // Index on LeaseId for faster queries
            b.HasIndex(lf => lf.LeaseId);

            // Index on OrganizationId
            b.HasIndex(lf => lf.OrganizationId);

            // Index on DueDate for querying fees by due date
            b.HasIndex(lf => lf.DueDate);

            // Relationship with Lease
            b.HasOne(lf => lf.Lease)
                .WithMany(l => l.LeaseFees)
                .HasForeignKey(lf => lf.LeaseId)
                .OnDelete(DeleteBehavior.Cascade);

            // Relationship with Organization
            b.HasOne(lf => lf.Organization)
                .WithMany()
                .HasForeignKey(lf => lf.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
