using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class AnnouncementConfig : IEntityTypeConfiguration<Announcement>
    {
        public void Configure(EntityTypeBuilder<Announcement> b)
        {
            b.ToTable("Announcements", "communication");
            b.HasKey(x => x.Id);

            b.HasOne(a => a.Organization)
                .WithMany()
                .HasForeignKey(a => a.OrganizationId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired();

            b.HasOne(a => a.CreatedBy)
                .WithMany()
                .HasForeignKey(a => a.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired();

            b.HasMany(a => a.Recipients)
                .WithOne(r => r.Announcement)
                .HasForeignKey(r => r.AnnouncementId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Property(a => a.Message)
                .HasMaxLength(5000)
                .IsRequired();

            b.Property(a => a.FormattedMessage)
                .HasMaxLength(5000);

            b.HasIndex(a => a.OrganizationId);
            b.HasIndex(a => a.CreatedByUserId);
            b.HasIndex(a => a.CreatedAt);
        }
    }
}
