using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ConversationConfig : IEntityTypeConfiguration<Conversation>
    {
        public void Configure(EntityTypeBuilder<Conversation> b)
        {
            b.ToTable("Conversations", "communication");
            b.HasKey(c => c.Id);
            
            b.Property(c => c.Title)
                .HasMaxLength(255)
                .IsRequired();
            
            b.Property(c => c.Description)
                .HasMaxLength(1000);
            
            b.Property(c => c.LastMessagePreview)
                .HasMaxLength(500);
            
            // AI Analysis fields
            b.Property(c => c.AiSummary)
                .HasMaxLength(2000);
            
            b.Property(c => c.UrgentItemsJson)
                .HasMaxLength(5000);
            
            b.HasIndex(c => c.HasUrgentItems);
            b.HasIndex(c => new { c.LandlordId, c.HasUrgentItems });
            
            b.HasIndex(c => c.LandlordId);
            b.HasIndex(c => new { c.LandlordId, c.IsArchived });
            b.HasIndex(c => c.LastMessageAt);
            
            // Organization relationship
            b.HasOne(c => c.Organization)
                .WithMany()
                .HasForeignKey(c => c.OrganizationId)
                .IsRequired(false)
                .OnDelete(DeleteBehavior.SetNull);
            
            b.HasIndex(c => c.OrganizationId);
            
            // Relationships
            b.HasOne(c => c.Landlord)
                .WithMany()
                .HasForeignKey(c => c.LandlordId)
                .OnDelete(DeleteBehavior.Restrict);
            
            b.HasOne(c => c.Property)
                .WithMany()
                .HasForeignKey(c => c.PropertyId)
                .OnDelete(DeleteBehavior.SetNull);
            
            b.HasOne(c => c.Lease)
                .WithMany()
                .HasForeignKey(c => c.LeaseId)
                .OnDelete(DeleteBehavior.SetNull);
            
            b.HasOne(c => c.Tenant)
                .WithMany()
                .HasForeignKey(c => c.TenantId)
                .OnDelete(DeleteBehavior.SetNull);
        }
    }
}

