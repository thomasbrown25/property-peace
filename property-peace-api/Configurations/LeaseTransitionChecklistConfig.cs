using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LeaseTransitionChecklistConfig : IEntityTypeConfiguration<LeaseTransitionChecklist>
    {
        public void Configure(EntityTypeBuilder<LeaseTransitionChecklist> builder)
        {
            builder.ToTable("LeaseTransitionChecklists", "checklist");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.RequestId).HasMaxLength(64).IsRequired();
            builder.Property(x => x.UpdatedAt).IsConcurrencyToken();
            builder.HasIndex(x => new { x.OrganizationId, x.RequestId }).IsUnique();
            builder.HasIndex(x => new { x.OrganizationId, x.LeaseId, x.Phase }).IsUnique().HasFilter("[LeaseId] IS NOT NULL");
            builder.HasIndex(x => x.ConditionReportId).IsUnique().HasFilter("[ConditionReportId] IS NOT NULL");
            builder.HasOne(x => x.ConditionReport).WithMany().HasForeignKey(x => x.ConditionReportId).OnDelete(DeleteBehavior.Restrict);
            builder.HasMany(x => x.Items).WithOne(x => x.Checklist).HasForeignKey(x => x.LeaseTransitionChecklistId).OnDelete(DeleteBehavior.Cascade);
            builder.HasOne(x => x.Organization).WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(x => x.Landlord).WithMany().HasForeignKey(x => x.LandlordId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(x => x.Property).WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
            builder.HasOne(x => x.Lease).WithMany().HasForeignKey(x => x.LeaseId).OnDelete(DeleteBehavior.Restrict);
        }
    }
}
