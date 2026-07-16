using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class MaintenanceRequestConfig : IEntityTypeConfiguration<MaintenanceRequest>
    {
        public void Configure(EntityTypeBuilder<MaintenanceRequest> b)
        {
            b.ToTable("MaintenanceRequests", "maintenance");
            b.HasKey(m => m.Id);

            b.Property(m => m.Status).HasConversion<string>().IsRequired();
            b.Property(m => m.Priority).HasConversion<string>().IsRequired();

            // If you want DB-side defaults; for SQL Server prefer UTC
            b.Property(m => m.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            b.Property(m => m.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");

            b.HasOne(m => m.Property)
             .WithMany(p => p.MaintenanceRequests)
             .HasForeignKey(m => m.PropertyId)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasMany(m => m.Images)
             .WithOne(i => i.MaintenanceRequest)
             .HasForeignKey(i => i.RefId)
             .OnDelete(DeleteBehavior.Cascade);

            // Vendor relationship
            b.HasOne(m => m.VendorEntity)
             .WithMany(v => v.MaintenanceRequests)
             .HasForeignKey(m => m.VendorId)
             .OnDelete(DeleteBehavior.SetNull);

            // Organization relationship
            b.HasOne(m => m.Organization)
             .WithMany()
             .HasForeignKey(m => m.OrganizationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasIndex(m => m.Status);
            b.HasIndex(m => m.Priority);
            b.HasIndex(m => new { m.PropertyId, m.Status });
            b.HasIndex(m => m.VendorId);
            b.HasIndex(m => m.OrganizationId);
            b.HasIndex(m => m.OrderNumber).IsUnique(false); // Allow duplicates but enable fast lookups
        }
    }
}