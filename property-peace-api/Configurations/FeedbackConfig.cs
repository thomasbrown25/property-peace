using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using brownstone_hub_api.Models;

namespace brownstone_hub_api.Configurations
{
    public class FeedbackConfig : IEntityTypeConfiguration<Feedback>
    {
        public void Configure(EntityTypeBuilder<Feedback> builder)
        {
            builder.HasKey(f => f.Id);
            
            builder.Property(f => f.Type)
                .IsRequired()
                .HasMaxLength(50);
            
            builder.Property(f => f.Subject)
                .IsRequired()
                .HasMaxLength(500);
            
            builder.Property(f => f.Message)
                .IsRequired();
            
            builder.Property(f => f.CreatedAt)
                .IsRequired();
            
            builder.Property(f => f.IsResolved)
                .IsRequired()
                .HasDefaultValue(false);
            
            // Relationship with User
            builder.HasOne(f => f.User)
                .WithMany()
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            
            // Indexes
            builder.HasIndex(f => f.UserId);
            builder.HasIndex(f => f.Type);
            builder.HasIndex(f => f.CreatedAt);
        }
    }
}

