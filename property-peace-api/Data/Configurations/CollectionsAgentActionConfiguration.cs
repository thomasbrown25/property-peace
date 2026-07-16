using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Data.Configurations
{
    public class CollectionsAgentActionConfiguration : IEntityTypeConfiguration<CollectionsAgentAction>
    {
        public void Configure(EntityTypeBuilder<CollectionsAgentAction> builder)
        {
            builder.ToTable("CollectionsAgentActions");

            builder.Property(a => a.ActionType)
                .HasMaxLength(50)
                .IsRequired();

            builder.Property(a => a.FollowUpType)
                .HasMaxLength(100);

            builder.Property(a => a.Message)
                .HasMaxLength(1000)
                .IsRequired();

            builder.Property(a => a.TenantNameSnapshot)
                .HasMaxLength(250)
                .HasDefaultValue(string.Empty);

            builder.Property(a => a.PropertyNameSnapshot)
                .HasMaxLength(250)
                .HasDefaultValue(string.Empty);

            builder.Property(a => a.UnitNameSnapshot)
                .HasMaxLength(100)
                .HasDefaultValue(string.Empty);

            builder.Property(a => a.CreatedAt)
                .HasDefaultValueSql("GETUTCDATE()");

            builder.Property(a => a.IsManual)
                .HasDefaultValue(false);

            builder.HasIndex(a => new { a.OrganizationId, a.CreatedAt });
            builder.HasIndex(a => a.LeaseId);
            builder.HasIndex(a => a.MessageId);

            builder.HasOne(a => a.Organization)
                .WithMany()
                .HasForeignKey(a => a.OrganizationId)
                .OnDelete(DeleteBehavior.NoAction);

            builder.HasOne(a => a.Lease)
                .WithMany()
                .HasForeignKey(a => a.LeaseId)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}
