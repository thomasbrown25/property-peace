using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class MaintenanceActivityEventConfig : IEntityTypeConfiguration<MaintenanceActivityEvent>
{
    public void Configure(EntityTypeBuilder<MaintenanceActivityEvent> b)
    {
        b.ToTable("MaintenanceActivityEvents", "maintenance");
        b.HasKey(x => x.Id);
        b.Property(x => x.EventType).HasMaxLength(100).IsRequired();
        b.Property(x => x.SubjectType).HasMaxLength(100).IsRequired();
        b.Property(x => x.Visibility).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.Summary).HasMaxLength(500).IsRequired();
        b.Property(x => x.MetadataJson).HasMaxLength(4000).IsRequired();
        b.HasIndex(x => new { x.MaintenanceRequestId, x.Id });
        b.HasOne(x => x.MaintenanceRequest).WithMany(x => x.ActivityEvents).HasForeignKey(x => x.MaintenanceRequestId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class MaintenanceAttachmentConfig : IEntityTypeConfiguration<MaintenanceAttachment>
{
    public void Configure(EntityTypeBuilder<MaintenanceAttachment> b)
    {
        b.ToTable("MaintenanceAttachments", "maintenance");
        b.HasKey(x => x.Id);
        b.Property(x => x.Purpose).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.MediaType).HasConversion<string>().HasMaxLength(20);
        b.Property(x => x.LifecycleState).HasConversion<string>().HasMaxLength(30);
        b.Property(x => x.FileName).HasMaxLength(255).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
        b.Property(x => x.BlobName).HasMaxLength(500).IsRequired();
        b.Property(x => x.StagingBlobName).HasMaxLength(500);
        b.HasIndex(x => x.BlobName).IsUnique();
        b.HasIndex(x => new { x.MaintenanceRequestId, x.Purpose, x.ResolutionCycle, x.LifecycleState });
        b.HasIndex(x => new { x.LifecycleState, x.LifecycleLeaseUntilUtc, x.Id });
        b.HasOne(x => x.MaintenanceRequest).WithMany(x => x.Attachments).HasForeignKey(x => x.MaintenanceRequestId).OnDelete(DeleteBehavior.Cascade);
    }
}
