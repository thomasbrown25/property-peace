using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ActivityEventConfig : IEntityTypeConfiguration<ActivityEvent>
{
    public void Configure(EntityTypeBuilder<ActivityEvent> builder)
    {
        builder.ToTable("ActivityEvents", t => t.HasCheckConstraint("CK_ActivityEvents_Organization", "[OrganizationId] > 0"));
        builder.HasKey(x => x.Id);
        builder.Property(x => x.ActivityType).HasMaxLength(40).IsRequired();
        builder.Property(x => x.Operation).HasMaxLength(16).IsRequired();
        builder.Property(x => x.PerformedByName).HasMaxLength(200);
        builder.Property(x => x.Title).HasMaxLength(200).IsRequired();
        builder.Property(x => x.Message).HasMaxLength(500).IsRequired();
        builder.Property(x => x.CreatedAt).HasConversion(v => v, v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
        builder.HasIndex(x => new { x.OrganizationId, x.CreatedAt, x.Id });
        builder.HasIndex(x => new { x.OrganizationId, x.ActivityType, x.RelatedId });
        // Deliberately no FKs: history survives deletion of its organization, entity or actor.
    }
}
