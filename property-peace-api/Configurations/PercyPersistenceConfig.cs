using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class PercyConversationConfig : IEntityTypeConfiguration<PercyConversation>
    {
        public void Configure(EntityTypeBuilder<PercyConversation> b)
        {
            b.ToTable("Conversations", "percy");
            b.HasKey(x => x.Id);
            b.Property(x => x.Title).HasMaxLength(200).IsRequired();
            b.HasIndex(x => new { x.OrganizationId, x.UserId, x.IsArchived, x.UpdatedAt });
            b.HasIndex(x => new { x.Id, x.OrganizationId, x.UserId }).IsUnique();
            b.HasOne(x => x.Organization).WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        }
    }

    public class PercyMessageConfig : IEntityTypeConfiguration<PercyMessage>
    {
        public void Configure(EntityTypeBuilder<PercyMessage> b)
        {
            b.ToTable("Messages", "percy");
            b.HasKey(x => x.Id);
            b.Property(x => x.Role).HasMaxLength(16).IsRequired();
            b.Property(x => x.Content).HasColumnType("nvarchar(max)").IsRequired();
            b.Property(x => x.ResponseJson).HasColumnType("nvarchar(max)");
            b.HasIndex(x => new { x.ConversationId, x.CreatedAt });
            b.HasOne(x => x.Conversation).WithMany(x => x.Messages).HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class PercyActionConfirmationConfig : IEntityTypeConfiguration<PercyActionConfirmation>
    {
        public void Configure(EntityTypeBuilder<PercyActionConfirmation> b)
        {
            b.ToTable("ActionConfirmations", "percy");
            b.HasKey(x => x.Id);
            b.Property(x => x.ActionType).HasMaxLength(100).IsRequired();
            b.Property(x => x.ActionPayloadJson).HasColumnType("nvarchar(max)").IsRequired();
            b.Property(x => x.FriendlyLabel).HasMaxLength(200).IsRequired();
            b.Property(x => x.Status).HasMaxLength(24).IsRequired();
            b.Property(x => x.ResolutionMessage).HasMaxLength(1000);
            b.Property(x => x.Version).IsRowVersion();
            b.HasIndex(x => new { x.OrganizationId, x.UserId, x.Status, x.ExpiresAt });
            b.HasIndex(x => new { x.Id, x.OrganizationId, x.UserId }).IsUnique();
            b.HasOne(x => x.Organization).WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.Conversation).WithMany(x => x.Confirmations).HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class PercyAuditRecordConfig : IEntityTypeConfiguration<PercyAuditRecord>
    {
        public void Configure(EntityTypeBuilder<PercyAuditRecord> b)
        {
            b.ToTable("AuditRecords", "percy");
            b.HasKey(x => x.Id);
            b.Property(x => x.EventType).HasMaxLength(100).IsRequired();
            b.Property(x => x.Outcome).HasMaxLength(40).IsRequired();
            b.Property(x => x.Detail).HasMaxLength(2000).IsRequired();
            b.HasIndex(x => new { x.OrganizationId, x.UserId, x.CreatedAt });
            b.HasIndex(x => new { x.ConfirmationId, x.CreatedAt });
            b.HasOne(x => x.Organization).WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        }
    }
}
