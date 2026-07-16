using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class MaintenanceEventConfig : IEntityTypeConfiguration<MaintenanceEvent>
    {
        public void Configure(EntityTypeBuilder<MaintenanceEvent> b)
        {
            b.ToTable("MaintenanceEvents", "maintenance");
            b.HasKey(x => x.Id);

            b.Property(x => x.EventType).HasConversion<string>().IsRequired();
            b.Property(x => x.ChangedAt).HasDefaultValueSql("GETUTCDATE()");

            b.HasIndex(x => new { x.MaintenanceId, x.ChangedAt });

            b.HasOne(x => x.Maintenance)
             .WithMany(m => m.Events)
             .HasForeignKey(x => x.MaintenanceId)
             .OnDelete(DeleteBehavior.Cascade);
        }
    }
}