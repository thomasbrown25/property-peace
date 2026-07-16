using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class LeaseShieldMessageConfig : IEntityTypeConfiguration<LeaseShieldMessage>
    {
        public void Configure(EntityTypeBuilder<LeaseShieldMessage> b)
        {
            b.ToTable("Messages", "lease_shield");
            b.HasKey(m => m.Id);
            b.Property(m => m.State).HasMaxLength(2);
            b.HasIndex(m => m.ConversationId);
            b.HasOne(m => m.Conversation)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ConversationId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
