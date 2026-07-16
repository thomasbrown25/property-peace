using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ApplicationInviteConfig : IEntityTypeConfiguration<ApplicationInvite>
    {
        public void Configure(EntityTypeBuilder<ApplicationInvite> b)
        {
            b.ToTable("ApplicationInvites", "invite");
            // Required relationship with Property
            b.HasOne(ai => ai.Property)
             .WithMany()
             .HasForeignKey(ai => ai.PropertyId)
             .IsRequired()
             .OnDelete(DeleteBehavior.Restrict);

            // Optional relationship with Unit
            b.HasOne(ai => ai.Unit)
             .WithMany()
             .HasForeignKey(ai => ai.UnitId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.Restrict);

            // Optional relationship with Application (if invite was used)
            b.HasOne(ai => ai.Application)
             .WithMany()
             .HasForeignKey(ai => ai.ApplicationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);

            // Required relationship with User (landlord who created the invite)
            b.HasOne(ai => ai.CreatedByUser)
             .WithMany()
             .HasForeignKey(ai => ai.CreatedBy)
             .IsRequired()
             .OnDelete(DeleteBehavior.Restrict);

            // Organization relationship
            b.HasOne(ai => ai.Organization)
             .WithMany()
             .HasForeignKey(ai => ai.OrganizationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.SetNull);

            // Indexes for performance
            b.HasIndex(ai => ai.InviteToken).IsUnique();
            b.HasIndex(ai => ai.PropertyId);
            b.HasIndex(ai => ai.Email);
            b.HasIndex(ai => ai.IsUsed);
            b.HasIndex(ai => ai.ApplicationId);
            b.HasIndex(ai => ai.OrganizationId);
        }
    }
}

