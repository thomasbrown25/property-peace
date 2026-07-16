using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ActionSuppressionConfig : IEntityTypeConfiguration<ActionSuppression>
    {
        public void Configure(EntityTypeBuilder<ActionSuppression> b)
        {
            b.ToTable("ActionSuppressions", "core");

            b.HasKey(x => x.Id);

            // Relationships
            b.HasOne(x => x.Organization)
                .WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .IsRequired()
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(x => x.CreatedByUser)
                .WithMany()
                .HasForeignKey(x => x.CreatedBy)
                .IsRequired()
                .OnDelete(DeleteBehavior.Restrict);

            // Indexes for efficient queries
            b.HasIndex(x => new { x.ActionType, x.EntityId, x.OrganizationId });
            b.HasIndex(x => x.OrganizationId);
            b.HasIndex(x => x.SuppressedUntil);
            b.HasIndex(x => x.IsActive);
        }
    }
}
