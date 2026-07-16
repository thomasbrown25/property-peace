using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ConversationParticipantConfig : IEntityTypeConfiguration<ConversationParticipant>
    {
        public void Configure(EntityTypeBuilder<ConversationParticipant> b)
        {
            b.ToTable("ConversationParticipants", "communication");
            b.HasKey(cp => cp.Id);
            
            b.HasIndex(cp => cp.ConversationId);
            b.HasIndex(cp => cp.UserId);
            b.HasIndex(cp => new { cp.ConversationId, cp.UserId, cp.IsDeleted });
            
            // Relationships
            b.HasOne(cp => cp.Conversation)
                .WithMany(c => c.Participants)
                .HasForeignKey(cp => cp.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
            
            b.HasOne(cp => cp.User)
                .WithMany()
                .HasForeignKey(cp => cp.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            
            // Unique constraint: one active participant per user per conversation
            b.HasIndex(cp => new { cp.ConversationId, cp.UserId })
                .IsUnique()
                .HasFilter("[IsDeleted] = 0");
        }
    }
}

