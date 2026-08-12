using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class MessageDeliveryConfig : IEntityTypeConfiguration<MessageDelivery>
{
    public void Configure(EntityTypeBuilder<MessageDelivery> b)
    {
        b.ToTable("MessageDeliveries", "communication");
        b.HasKey(x => x.Id);
        b.Property(x => x.Channel).HasConversion<string>().HasMaxLength(16).IsRequired();
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(24).IsRequired();
        b.Property(x => x.ProtectedDestination).HasMaxLength(2000);
        b.Property(x => x.MaskedDestination).HasMaxLength(320);
        b.Property(x => x.BodySnapshot).HasMaxLength(10000).IsRequired();
        b.Property(x => x.HtmlBodySnapshot).HasMaxLength(20000);
        b.Property(x => x.SubjectSnapshot).HasMaxLength(500);
        b.Property(x => x.ProtectedFromAddress).HasMaxLength(2000);
        b.Property(x => x.Provider).HasMaxLength(100);
        b.Property(x => x.ProviderMessageId).HasMaxLength(255);
        b.Property(x => x.ErrorCode).HasMaxLength(100);
        b.Property(x => x.ErrorDetail).HasMaxLength(500);
        b.Property(x => x.IdempotencyKey).HasMaxLength(300).IsRequired();
        b.Property(x => x.RowVersion).IsRowVersion();

        b.HasIndex(x => new { x.OrganizationId, x.IdempotencyKey }).IsUnique();
        b.HasIndex(x => new { x.Provider, x.ProviderMessageId }).IsUnique()
            .HasFilter("[ProviderMessageId] IS NOT NULL");
        b.HasIndex(x => new { x.Status, x.NextAttemptAtUtc, x.ProcessingLeaseUntilUtc });
        b.HasIndex(x => new { x.OrganizationId, x.ConversationTimelineEntryId });

        // Restrict protects the independent, already-saved communication record from delivery cleanup.
        b.HasOne(x => x.ConversationTimelineEntry).WithMany().HasForeignKey(x => x.ConversationTimelineEntryId).OnDelete(DeleteBehavior.Restrict);
        b.HasOne(x => x.Message).WithMany().HasForeignKey(x => x.MessageId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne(x => x.RecipientUser).WithMany().HasForeignKey(x => x.RecipientUserId).OnDelete(DeleteBehavior.NoAction);
    }
}
