using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class SupportAndFeedbackConfig : IEntityTypeConfiguration<SupportAndFeedback>
    {
        public void Configure(EntityTypeBuilder<SupportAndFeedback> builder)
        {
            builder.ToTable("SupportAndFeedbacks", "admin");
            builder.HasKey(sf => sf.Id);
            
            builder.Property(sf => sf.Type)
                .IsRequired()
                .HasConversion<int>(); // Store enum as int
            
            builder.Property(sf => sf.SubType)
                .HasMaxLength(50);
            
            builder.Property(sf => sf.Subject)
                .IsRequired()
                .HasMaxLength(500);
            
            builder.Property(sf => sf.Message)
                .IsRequired();
            
            builder.Property(sf => sf.CreatedAt)
                .IsRequired();

            builder.Property(sf => sf.LastActivityAt)
                .IsRequired();

            builder.Property(sf => sf.TicketNumber)
                .IsRequired()
                .HasMaxLength(32);
            
            builder.Property(sf => sf.IsResolved)
                .IsRequired()
                .HasDefaultValue(false);
            
            builder.Property(sf => sf.IsFavorite)
                .IsRequired()
                .HasDefaultValue(false);
            
            // Relationship with User
            builder.HasOne(sf => sf.User)
                .WithMany()
                .HasForeignKey(sf => sf.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne(sf => sf.Conversation)
                .WithOne()
                .HasForeignKey<SupportAndFeedback>(sf => sf.ConversationId)
                .OnDelete(DeleteBehavior.SetNull);
            
            // Indexes
            builder.HasIndex(sf => sf.UserId);
            builder.HasIndex(sf => sf.TicketNumber).IsUnique();
            builder.HasIndex(sf => sf.ConversationId).IsUnique().HasFilter("[ConversationId] IS NOT NULL");
            builder.HasIndex(sf => sf.Type);
            builder.HasIndex(sf => sf.CreatedAt);
            builder.HasIndex(sf => sf.IsResolved);
            builder.HasIndex(sf => sf.IsFavorite);
        }
    }
}

