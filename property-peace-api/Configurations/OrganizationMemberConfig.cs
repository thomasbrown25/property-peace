using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class OrganizationMemberConfig : IEntityTypeConfiguration<OrganizationMember>
    {
        public void Configure(EntityTypeBuilder<OrganizationMember> b)
        {
            b.ToTable("OrganizationMembers", "organization");
            b.HasKey(om => om.Id);

            b.HasOne(om => om.Organization)
                .WithMany(o => o.Members)
                .HasForeignKey(om => om.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(om => om.User)
                .WithMany()
                .HasForeignKey(om => om.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false); // UserId is nullable

            b.HasOne(om => om.InvitedByUser)
                .WithMany()
                .HasForeignKey(om => om.InvitedBy)
                .OnDelete(DeleteBehavior.NoAction);

            b.Property(om => om.Role)
                .IsRequired()
                .HasMaxLength(50);

            b.Property(om => om.IsActive)
                .HasDefaultValue(true);

            // Ensure a user can only be a member of an organization once (when UserId is set)
            // Note: Multiple members with null UserId are allowed (pending invites)
            b.HasIndex(om => new { om.OrganizationId, om.UserId })
                .IsUnique()
                .HasFilter("[UserId] IS NOT NULL");
            
            // Index for email lookups (for pending invites)
            b.HasIndex(om => new { om.OrganizationId, om.Email })
                .HasFilter("[Email] IS NOT NULL");

            b.HasIndex(om => om.OrganizationId);
            b.HasIndex(om => om.UserId);
            b.HasIndex(om => om.Role);
            b.HasIndex(om => om.IsActive);
        }
    }
}

