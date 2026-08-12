using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ConversationContextLinkConfig : IEntityTypeConfiguration<ConversationContextLink>
{
    public void Configure(EntityTypeBuilder<ConversationContextLink> b)
    {
        b.ToTable("ConversationContextLinks", "communication", table => table.HasCheckConstraint(
            "CK_ConversationContextLinks_ExactlyOneTarget",
            "(CASE WHEN [PropertyId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [UnitId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [ListingId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [LeadId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [RentalApplicationId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [LeaseId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [PaymentId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [MaintenanceRequestId] IS NULL THEN 0 ELSE 1 END) = 1"));
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.ConversationId, x.PropertyId }).IsUnique().HasFilter("[PropertyId] IS NOT NULL");
        b.HasIndex(x => new { x.ConversationId, x.UnitId }).IsUnique().HasFilter("[UnitId] IS NOT NULL");
        b.HasIndex(x => new { x.ConversationId, x.ListingId }).IsUnique().HasFilter("[ListingId] IS NOT NULL");
        b.HasIndex(x => new { x.ConversationId, x.LeadId }).IsUnique().HasFilter("[LeadId] IS NOT NULL");
        b.HasIndex(x => new { x.ConversationId, x.RentalApplicationId }).IsUnique().HasFilter("[RentalApplicationId] IS NOT NULL");
        b.HasIndex(x => new { x.ConversationId, x.LeaseId }).IsUnique().HasFilter("[LeaseId] IS NOT NULL");
        b.HasIndex(x => new { x.ConversationId, x.PaymentId }).IsUnique().HasFilter("[PaymentId] IS NOT NULL");
        b.HasIndex(x => new { x.ConversationId, x.MaintenanceRequestId }).IsUnique().HasFilter("[MaintenanceRequestId] IS NOT NULL");
        b.HasOne(x => x.Conversation).WithMany().HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.Property).WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Unit).WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Listing).WithMany().HasForeignKey(x => x.ListingId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Lead).WithMany().HasForeignKey(x => x.LeadId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.RentalApplication).WithMany().HasForeignKey(x => x.RentalApplicationId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Lease).WithMany().HasForeignKey(x => x.LeaseId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Payment).WithMany().HasForeignKey(x => x.PaymentId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.MaintenanceRequest).WithMany().HasForeignKey(x => x.MaintenanceRequestId).OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class ConversationTimelineEntryConfig : IEntityTypeConfiguration<ConversationTimelineEntry>
{
    public void Configure(EntityTypeBuilder<ConversationTimelineEntry> b)
    {
        b.ToTable("ConversationTimelineEntries", "communication");
        b.HasKey(x => x.Id);
        b.Property(x => x.SourceType).HasMaxLength(100).IsRequired();
        b.Property(x => x.SourceId).HasMaxLength(200).IsRequired();
        b.Property(x => x.Summary).HasMaxLength(500).IsRequired();
        b.Property(x => x.MetadataJson).HasMaxLength(4000).IsRequired();
        b.Property(x => x.ContextKind).HasMaxLength(50);
        b.Property(x => x.ContextLabel).HasMaxLength(200);
        b.Property(x => x.Producer).HasMaxLength(100).IsRequired();
        b.Property(x => x.EventId).HasMaxLength(200).IsRequired();
        b.Property(x => x.PayloadHash).HasMaxLength(64).IsFixedLength().IsRequired();
        b.HasIndex(x => new { x.ConversationId, x.Sequence }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.Producer, x.EventId }).IsUnique();
        b.HasOne(x => x.Conversation).WithMany().HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
        b.HasOne(x => x.ActorUser).WithMany().HasForeignKey(x => x.ActorUserId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.Message).WithMany().HasForeignKey(x => x.MessageId).OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class ConversationTimelineSequenceConfig : IEntityTypeConfiguration<ConversationTimelineSequence>
{
    public void Configure(EntityTypeBuilder<ConversationTimelineSequence> b)
    {
        b.ToTable("ConversationTimelineSequences", "communication");
        b.HasKey(x => x.ConversationId);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasOne(x => x.Conversation).WithOne().HasForeignKey<ConversationTimelineSequence>(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ConversationReadWatermarkConfig : IEntityTypeConfiguration<ConversationReadWatermark>
{
    public void Configure(EntityTypeBuilder<ConversationReadWatermark> b)
    {
        b.ToTable("ConversationReadWatermarks", "communication");
        b.HasKey(x => new { x.ConversationId, x.UserId });
        b.HasIndex(x => x.UserId);
    }
}

public sealed class QuickReplyConfig : IEntityTypeConfiguration<QuickReply>
{
    public void Configure(EntityTypeBuilder<QuickReply> b)
    {
        b.ToTable("QuickReplies", "communication");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(100).IsRequired();
        b.Property(x => x.Body).HasMaxLength(2000).IsRequired();
        b.Property(x => x.ContextKind).HasMaxLength(50);
        b.HasIndex(x => new { x.OrganizationId, x.OwnerUserId, x.SortOrder });
    }
}

public sealed class ConversationFollowUpTaskConfig : IEntityTypeConfiguration<ConversationFollowUpTask>
{
    public void Configure(EntityTypeBuilder<ConversationFollowUpTask> b)
    {
        b.ToTable("ConversationFollowUpTasks", "communication");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.ContextKind).HasMaxLength(50).IsRequired();
        b.Property(x => x.IdempotencyKey).HasMaxLength(100).IsRequired();
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasIndex(x => new { x.OrganizationId, x.IdempotencyKey }).IsUnique();
        b.HasIndex(x => new { x.OrganizationId, x.ConversationId, x.Status, x.DueAtUtc });
    }
}
