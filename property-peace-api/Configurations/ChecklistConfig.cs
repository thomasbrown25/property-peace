using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class ChecklistConfig : IEntityTypeConfiguration<Checklist>
    {
        public void Configure(EntityTypeBuilder<Checklist> builder)
        {
            builder.ToTable("Checklists", "checklist");
            builder.HasKey(c => c.Id);

            builder.Property(c => c.Title)
                .IsRequired()
                .HasMaxLength(200);

            builder.Property(c => c.GeneralNotes)
                .HasColumnType("nvarchar(max)");

            builder.Property(c => c.ConditionNotes)
                .HasColumnType("nvarchar(max)");

            builder.Property(c => c.RoomNamesJson)
                .HasColumnType("nvarchar(max)");

            builder.Property(c => c.TenantSignature)
                .HasMaxLength(2000); // Base64 signature or reference

            builder.Property(c => c.LandlordSignature)
                .HasMaxLength(2000);

            // Relationships
            builder.HasOne(c => c.Property)
                .WithMany()
                .HasForeignKey(c => c.PropertyId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(c => c.Unit)
                .WithMany()
                .HasForeignKey(c => c.UnitId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(c => c.Lease)
                .WithMany()
                .HasForeignKey(c => c.LeaseId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(c => c.Tenant)
                .WithMany()
                .HasForeignKey(c => c.TenantId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasOne(c => c.Landlord)
                .WithMany()
                .HasForeignKey(c => c.LandlordId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasMany(c => c.Items)
                .WithOne(ci => ci.Checklist)
                .HasForeignKey(ci => ci.ChecklistId)
                .OnDelete(DeleteBehavior.Cascade);

            // Organization relationship
            builder.HasOne(c => c.Organization)
                .WithMany()
                .HasForeignKey(c => c.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);

            // Indexes
            builder.HasIndex(c => c.PropertyId);
            builder.HasIndex(c => c.UnitId);
            builder.HasIndex(c => c.LeaseId);
            builder.HasIndex(c => c.TenantId);
            builder.HasIndex(c => c.LandlordId);
            builder.HasIndex(c => c.ChecklistType);
            builder.HasIndex(c => new { c.PropertyId, c.ChecklistType });
            builder.HasIndex(c => c.InspectionDate);
            builder.HasIndex(c => c.OrganizationId);
        }
    }
}

