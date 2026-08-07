using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class UnitLifecycleEventConfig : IEntityTypeConfiguration<UnitLifecycleEvent>
{
    public void Configure(EntityTypeBuilder<UnitLifecycleEvent> b)
    {
        b.ToTable("UnitLifecycleEvents", "property");
        b.HasKey(x => x.Id);
        b.Property(x => x.Reason).HasMaxLength(50);
        b.Property(x => x.RequestHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.PreviousRevision).HasMaxLength(64).IsRequired();
        b.Property(x => x.CorrelationTrace).HasMaxLength(200).IsRequired();
        b.Property(x => x.IdempotencyKeyHash).HasMaxLength(64).IsRequired();
        b.Property(x => x.ResultSnapshotJson).HasMaxLength(4000).IsRequired();
        b.HasIndex(x => new { x.OrganizationId, x.IdempotencyKeyHash }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.PropertyId, x.UnitId, x.PreviousRevision }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.PropertyId, x.UnitId, x.OccurredAtUtc });
        b.HasOne<Property>().WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Unit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
