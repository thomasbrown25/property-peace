using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace brownstone_hub_api.Configurations
{
    public class NotificationConfig : IEntityTypeConfiguration<Notification>
    {
        public void Configure(EntityTypeBuilder<Notification> b)
        {
            b.ToTable("Notifications", "communication");
            b.HasKey(x => x.Id);
            
            // Organization relationship (optional - some notifications may not be organization-specific)
            b.HasOne(n => n.Organization)
                .WithMany()
                .HasForeignKey(n => n.OrganizationId)
                .OnDelete(DeleteBehavior.SetNull)
                .IsRequired(false);
            
            b.HasIndex(x => x.UserId);
            b.HasIndex(x => new { x.UserId, x.IsRead });
            b.HasIndex(x => new { x.UserId, x.OrganizationId });
            
            // Store enum as string
            b.Property(x => x.Type)
                .HasConversion(new EnumToStringConverter<ENotificationType>())
                .HasMaxLength(50)
                .IsRequired();
            
            b.Property(x => x.Title)
                .HasMaxLength(255)
                .IsRequired();
                
            b.Property(x => x.Message)
                .HasMaxLength(1000)
                .IsRequired();
            
            // Activity tracking fields
            b.Property(x => x.PerformedByName)
                .HasMaxLength(255)
                .IsRequired(false);
            
            b.HasIndex(x => x.PerformedByUserId);
            b.HasIndex(x => x.CreatedAt);
        }
    }
}

