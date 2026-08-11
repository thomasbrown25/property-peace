using brownstone_hub_api.Models;
using brownstone_hub_api.Services.ActivationFunnel;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ActivationMilestoneOccurrenceConfig : IEntityTypeConfiguration<ActivationMilestoneOccurrence>
{
    public void Configure(EntityTypeBuilder<ActivationMilestoneOccurrence> builder)
    {
        var allowed = string.Join(", ", ActivationMilestones.All.Select(x => $"'{x}'"));
        builder.ToTable("ActivationMilestoneOccurrences", table =>
        {
            table.HasCheckConstraint("CK_ActivationMilestoneOccurrences_Milestone", $"[Milestone] IN ({allowed})");
            table.HasCheckConstraint("CK_ActivationMilestoneOccurrences_SourcePair",
                "([SourceEventType] IS NULL AND [SourceEventId] IS NULL) OR ([SourceEventType] IS NOT NULL AND [SourceEventId] IS NOT NULL)");
        });
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Milestone).HasMaxLength(64).IsRequired();
        builder.Property(x => x.SubjectId).HasMaxLength(200).IsRequired();
        builder.Property(x => x.SourceEventType).HasMaxLength(100);
        builder.Property(x => x.SourceEventId).HasMaxLength(200);
        builder.Property(x => x.OccurredAtUtc).HasPrecision(0);
        builder.Property(x => x.RecordedAtUtc).HasPrecision(0);
        builder.HasIndex(x => new { x.OrganizationId, x.Milestone, x.SubjectId })
            .IsUnique().HasDatabaseName("UX_ActivationOccurrence_OrganizationMilestoneSubject");
        builder.HasIndex(x => new { x.OrganizationId, x.SourceEventType, x.SourceEventId })
            .IsUnique().HasFilter("[SourceEventType] IS NOT NULL AND [SourceEventId] IS NOT NULL")
            .HasDatabaseName("UX_ActivationOccurrence_SourceReplay");
        builder.HasIndex(x => new { x.OccurredAtUtc, x.Milestone });
    }
}
