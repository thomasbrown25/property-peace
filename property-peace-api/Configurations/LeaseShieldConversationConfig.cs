using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class LeaseShieldConversationConfig : IEntityTypeConfiguration<LeaseShieldConversation>
    {
        public void Configure(EntityTypeBuilder<LeaseShieldConversation> b)
        {
            b.ToTable("Conversations", "lease_shield");
            b.HasKey(c => c.Id);
            b.Property(c => c.Title).HasMaxLength(500);
            b.HasIndex(c => c.UserId);
            b.HasIndex(c => new { c.UserId, c.UpdatedAt });
            b.HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            b.HasOne(c => c.Organization)
                .WithMany()
                .HasForeignKey(c => c.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}
