using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class MessageConfig : IEntityTypeConfiguration<Message>
    {
        public void Configure(EntityTypeBuilder<Message> b)
        {
            b.ToTable("Messages", "communication");
            b.HasKey(m => m.Id);
            
            b.Property(m => m.Content)
                .HasMaxLength(5000)
                .IsRequired();
            
            b.Property(m => m.AttachmentUrl)
                .HasMaxLength(1000);
            
            b.Property(m => m.AttachmentName)
                .HasMaxLength(500);
            
            b.HasIndex(m => m.ConversationId);
            b.HasIndex(m => new { m.ConversationId, m.CreatedAt });
            b.HasIndex(m => m.SenderId);
            b.HasIndex(m => m.IsUrgent);
            b.HasIndex(m => new { m.ConversationId, m.IsUrgent });
            
            // Organization relationship
            b.HasOne(m => m.Organization)
                .WithMany()
                .HasForeignKey(m => m.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
            
            b.HasIndex(m => m.OrganizationId);
            
            // Relationships
            b.HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
            
            b.HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderId)
                .OnDelete(DeleteBehavior.Restrict);
            
            b.HasOne(m => m.ReplyToMessage)
                .WithMany()
                .HasForeignKey(m => m.ReplyToMessageId)
                .OnDelete(DeleteBehavior.NoAction);
        }
    }
}

