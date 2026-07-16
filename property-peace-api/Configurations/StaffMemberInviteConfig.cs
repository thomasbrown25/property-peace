using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class StaffMemberInviteConfig : IEntityTypeConfiguration<StaffMemberInvite>
    {
        public void Configure(EntityTypeBuilder<StaffMemberInvite> b)
        {
            b.ToTable("StaffMemberInvites", "staff");
            // Required relationship with StaffMember
            b.HasOne(si => si.StaffMember)
             .WithMany(sm => sm.Invites)
             .HasForeignKey(si => si.StaffMemberId)
             .IsRequired()
             .OnDelete(DeleteBehavior.Restrict); // Changed from Cascade to avoid multiple cascade paths

            // Required relationship with User (landlord who created the invite)
            b.HasOne(si => si.CreatedByUser)
             .WithMany()
             .HasForeignKey(si => si.CreatedBy)
             .IsRequired()
             .OnDelete(DeleteBehavior.Restrict);

            // Organization relationship
            b.HasOne(si => si.Organization)
             .WithMany()
             .HasForeignKey(si => si.OrganizationId)
             .IsRequired(false)
             .OnDelete(DeleteBehavior.NoAction); // Changed from SetNull to avoid multiple cascade paths

            // Indexes for performance
            b.HasIndex(si => si.InviteToken).IsUnique();
            b.HasIndex(si => si.StaffMemberId);
            b.HasIndex(si => si.Email);
            b.HasIndex(si => si.IsUsed);
            b.HasIndex(si => si.OrganizationId);
        }
    }
}
