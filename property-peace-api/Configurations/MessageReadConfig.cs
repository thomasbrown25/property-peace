using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class MessageReadConfig : IEntityTypeConfiguration<MessageRead>
    {
        public void Configure(EntityTypeBuilder<MessageRead> b)
        {
            b.ToTable("MessageReads", "communication");
            b.HasKey(mr => mr.Id);
            
            b.HasIndex(mr => mr.MessageId);
            b.HasIndex(mr => mr.UserId);
            b.HasIndex(mr => new { mr.MessageId, mr.UserId });
            
            // Relationships
            b.HasOne(mr => mr.Message)
                .WithMany(m => m.ReadReceipts)
                .HasForeignKey(mr => mr.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
            
            b.HasOne(mr => mr.User)
                .WithMany()
                .HasForeignKey(mr => mr.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            
            // Unique constraint: one read receipt per user per message
            b.HasIndex(mr => new { mr.MessageId, mr.UserId })
                .IsUnique();
        }
    }
}

