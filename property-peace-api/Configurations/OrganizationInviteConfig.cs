using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class OrganizationInviteConfig : IEntityTypeConfiguration<OrganizationInvite>
    {
        public void Configure(EntityTypeBuilder<OrganizationInvite> b)
        {
            b.ToTable("OrganizationInvites", "organization");
            b.HasKey(oi => oi.Id);

            b.HasOne(oi => oi.Organization)
                .WithMany(o => o.Invites)
                .HasForeignKey(oi => oi.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            b.HasOne(oi => oi.InvitedByUser)
                .WithMany()
                .HasForeignKey(oi => oi.InvitedBy)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(oi => oi.AcceptedByUser)
                .WithMany()
                .HasForeignKey(oi => oi.AcceptedBy)
                .OnDelete(DeleteBehavior.NoAction);

            b.Property(oi => oi.Email)
                .IsRequired()
                .HasMaxLength(255);

            b.Property(oi => oi.Role)
                .IsRequired()
                .HasMaxLength(50);

            b.Property(oi => oi.Token)
                .IsRequired()
                .HasMaxLength(255);

            b.Property(oi => oi.IsAccepted)
                .HasDefaultValue(false);

            // Token should be unique
            b.HasIndex(oi => oi.Token)
                .IsUnique();

            b.HasIndex(oi => oi.OrganizationId);
            b.HasIndex(oi => oi.Email);
            b.HasIndex(oi => oi.IsAccepted);
            b.HasIndex(oi => oi.ExpiresAt);
        }
    }
}

