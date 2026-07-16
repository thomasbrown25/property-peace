using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class StaffMemberConfig : IEntityTypeConfiguration<StaffMember>
    {
        public void Configure(EntityTypeBuilder<StaffMember> b)
        {
            b.ToTable("StaffMembers", "staff");
            b.HasKey(s => s.Id);

            b.Property(s => s.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            b.Property(s => s.UpdatedAt).HasDefaultValueSql("GETUTCDATE()");

            b.Property(s => s.HourlyRate)
                .HasColumnType("decimal(18,2)");

            // User relationship (optional - nullable for placeholder staff members)
            b.HasOne(s => s.User)
                .WithMany()
                .HasForeignKey(s => s.UserId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.NoAction);

            // Organization relationship
            b.HasOne(s => s.Organization)
                .WithMany()
                .HasForeignKey(s => s.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            // Time entries relationship
            b.HasMany(s => s.TimeEntries)
                .WithOne(t => t.StaffMember)
                .HasForeignKey(t => t.StaffMemberId)
                .OnDelete(DeleteBehavior.Cascade);

            // Indexes
            b.HasIndex(s => s.UserId);
            b.HasIndex(s => s.OrganizationId);
            b.HasIndex(s => new { s.OrganizationId, s.IsActive });
        }
    }
}
