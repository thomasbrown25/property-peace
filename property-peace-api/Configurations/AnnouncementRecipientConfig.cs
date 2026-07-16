using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class AnnouncementRecipientConfig : IEntityTypeConfiguration<AnnouncementRecipient>
    {
        public void Configure(EntityTypeBuilder<AnnouncementRecipient> b)
        {
            b.ToTable("AnnouncementRecipients", "communication");
            b.HasKey(x => x.Id);

            b.HasOne(r => r.Announcement)
                .WithMany(a => a.Recipients)
                .HasForeignKey(r => r.AnnouncementId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            b.HasIndex(r => r.AnnouncementId);
            b.HasIndex(r => r.TenantId);
            b.HasIndex(r => r.UnitId);
            b.HasIndex(r => r.PropertyId);
            b.HasIndex(r => r.OrganizationId);
        }
    }
}
