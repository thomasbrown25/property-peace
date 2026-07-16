using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace brownstone_hub_api.Configurations
{
    public class TimeEntryConfig : IEntityTypeConfiguration<TimeEntry>
    {
        public void Configure(EntityTypeBuilder<TimeEntry> b)
        {
            b.ToTable("TimeEntries", "staff");
            b.HasKey(t => t.Id);

            b.Property(t => t.Status)
                .HasConversion(new EnumToStringConverter<ETimeEntryStatus>())
                .HasMaxLength(50)
                .IsRequired();

            b.Property(t => t.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            b.Property(t => t.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");

            b.Property(t => t.HoursWorked)
                .HasColumnType("decimal(18,2)");

            b.Property(t => t.BreakHours)
                .HasColumnType("decimal(18,2)");

            // Staff member relationship
            b.HasOne(t => t.StaffMember)
                .WithMany(s => s.TimeEntries)
                .HasForeignKey(t => t.StaffMemberId)
                .OnDelete(DeleteBehavior.NoAction);

            // Property relationship
            b.HasOne(t => t.Property)
                .WithMany()
                .HasForeignKey(t => t.PropertyId)
                .OnDelete(DeleteBehavior.NoAction);

            // Maintenance request relationship (optional)
            b.HasOne(t => t.MaintenanceRequest)
                .WithMany()
                .HasForeignKey(t => t.MaintenanceRequestId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Unit relationship (optional)
            b.HasOne(t => t.Unit)
                .WithMany()
                .HasForeignKey(t => t.UnitId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Organization relationship
            b.HasOne(t => t.Organization)
                .WithMany()
                .HasForeignKey(t => t.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            // Approved by relationship
            b.HasOne(t => t.ApprovedBy)
                .WithMany()
                .HasForeignKey(t => t.ApprovedById)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.NoAction);

            // Breaks relationship
            b.HasMany(t => t.Breaks)
                .WithOne(b => b.TimeEntry)
                .HasForeignKey(b => b.TimeEntryId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            b.HasIndex(t => t.StaffMemberId);
            b.HasIndex(t => t.PropertyId);
            b.HasIndex(t => t.OrganizationId);
            b.HasIndex(t => t.MaintenanceRequestId);
            b.HasIndex(t => t.Status);
            b.HasIndex(t => new { t.OrganizationId, t.Status });
            b.HasIndex(t => new { t.PropertyId, t.StartTime });
            b.HasIndex(t => new { t.StaffMemberId, t.StartTime });
        }
    }
}
