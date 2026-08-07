using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ScreeningIncidentConfig : IEntityTypeConfiguration<ScreeningIncident>
{
    public void Configure(EntityTypeBuilder<ScreeningIncident> b)
    {
        b.ToTable("ScreeningIncidents", "screening", table =>
            table.HasCheckConstraint("CK_ScreeningIncidents_Resolution", "[ResolvedAt] IS NULL OR [ContainedAt] IS NOT NULL"));
        b.HasKey(x => x.Id); Fields.BigInt(b.Property(x => x.Id));
        Fields.NullableBigInt(b.Property(x => x.TenantScreeningOrderId)); Fields.NullableBigInt(b.Property(x => x.OrganizationId));
        Fields.Text(b.Property(x => x.ProviderKey), 100); Fields.Text(b.Property(x => x.ProviderEventId), 200);
        Fields.EnumText(b.Property(x => x.IncidentType)); Fields.EnumText(b.Property(x => x.Severity)); Fields.EnumText(b.Property(x => x.Status));
        Fields.Timestamp(b.Property(x => x.DetectedAt)); Fields.Timestamp(b.Property(x => x.ContainedAt)); Fields.Timestamp(b.Property(x => x.ResolvedAt));
        Fields.NullableBigInt(b.Property(x => x.ActorUserId)); Fields.RequiredHash(b.Property(x => x.AffectedResourceSha256Hash));
        Fields.RequiredText(b.Property(x => x.DetectionSource), 100); Fields.Text(b.Property(x => x.FailureEvidenceReference), 200);
        Fields.Text(b.Property(x => x.RemediationEvidenceReference), 200); Fields.Text(b.Property(x => x.NotificationEvidenceReference), 200);
        b.HasIndex(x => new { x.OrganizationId, x.Status, x.DetectedAt });
        b.HasIndex(x => new { x.ProviderKey, x.ProviderEventId, x.IncidentType }).HasFilter("[ProviderEventId] IS NOT NULL");
        b.HasIndex(x => new { x.TenantScreeningOrderId, x.DetectedAt });
        b.HasOne<TenantScreeningOrder>().WithMany().HasForeignKey(x => x.TenantScreeningOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}

public sealed class ScreeningIncidentEventConfig : IEntityTypeConfiguration<ScreeningIncidentEvent>
{
    public void Configure(EntityTypeBuilder<ScreeningIncidentEvent> b)
    {
        b.ToTable("ScreeningIncidentEvents", "screening", table => table.HasCheckConstraint("CK_ScreeningIncidentEvents_Revision", "[Revision] > 0"));
        b.HasKey(x => x.Id); Fields.BigInt(b.Property(x => x.Id)); Fields.BigInt(b.Property(x => x.ScreeningIncidentId));
        Fields.BigInt(b.Property(x => x.Revision)); Fields.EnumText(b.Property(x => x.Status)); Fields.Timestamp(b.Property(x => x.OccurredAt));
        Fields.NullableBigInt(b.Property(x => x.ActorUserId)); Fields.Text(b.Property(x => x.EvidenceReference), 200);
        b.HasIndex(x => new { x.ScreeningIncidentId, x.Revision }).IsUnique();
        b.HasIndex(x => new { x.Status, x.OccurredAt });
        b.HasOne(x => x.Incident).WithMany().HasForeignKey(x => x.ScreeningIncidentId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.Restrict);
    }
}
