using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class ClientInviteConfig : IEntityTypeConfiguration<Models.ClientInvite>
    {
        public void Configure(EntityTypeBuilder<Models.ClientInvite> b)
        {
            b.ToTable("ClientInvites", "client");
            // Relationships
            b.HasOne(ci => ci.Client)
                .WithMany()
                .HasForeignKey(ci => ci.ClientId)
                .OnDelete(DeleteBehavior.Restrict);

            b.HasOne(ci => ci.Organization)
                .WithMany()
                .HasForeignKey(ci => ci.OrganizationId)
                .OnDelete(DeleteBehavior.SetNull);

            b.HasOne(ci => ci.CreatedByUser)
                .WithMany()
                .HasForeignKey(ci => ci.CreatedBy)
                .OnDelete(DeleteBehavior.NoAction);

            // Indexes
            b.HasIndex(ci => ci.InviteToken).IsUnique();
            b.HasIndex(ci => ci.ClientId);
            b.HasIndex(ci => ci.Email);
        }
    }
}
