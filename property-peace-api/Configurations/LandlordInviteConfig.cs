using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class LandlordInviteConfig : IEntityTypeConfiguration<LandlordInvite>
    {
        public void Configure(EntityTypeBuilder<LandlordInvite> b)
        {
            b.ToTable("LandlordInvites", "invite");
            // Required relationship with User (admin who created the invite)
            b.HasOne(li => li.CreatedByUser)
             .WithMany()
             .HasForeignKey(li => li.CreatedBy)
             .IsRequired()
             .OnDelete(DeleteBehavior.Restrict);

            // Indexes for performance
            b.HasIndex(li => li.InviteToken).IsUnique();
            b.HasIndex(li => li.Email);
            b.HasIndex(li => li.IsUsed);
            b.HasIndex(li => li.CreatedBy);
        }
    }
}
