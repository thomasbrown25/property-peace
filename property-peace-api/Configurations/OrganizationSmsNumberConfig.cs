using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations
{
    public class OrganizationSmsNumberConfig : IEntityTypeConfiguration<OrganizationSmsNumber>
    {
        public void Configure(EntityTypeBuilder<OrganizationSmsNumber> builder)
        {
            builder.ToTable("OrganizationSmsNumbers", "messaging");

            builder.HasKey(x => x.Id);

            builder.Property(x => x.PhoneNumber)
                .IsRequired()
                .HasMaxLength(32);

            builder.Property(x => x.TwilioPhoneNumberSid)
                .IsRequired()
                .HasMaxLength(64);

            builder.Property(x => x.FriendlyName)
                .HasMaxLength(64);

            builder.Property(x => x.State)
                .HasMaxLength(2);

            builder.Property(x => x.AreaCode)
                .HasMaxLength(3);

            builder.Property(x => x.Status)
                .IsRequired()
                .HasMaxLength(32);

            builder.HasOne(x => x.Organization)
                .WithMany()
                .HasForeignKey(x => x.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne(x => x.PurchasedByUser)
                .WithMany()
                .HasForeignKey(x => x.PurchasedByUserId)
                .OnDelete(DeleteBehavior.SetNull);

            builder.HasIndex(x => x.PhoneNumber)
                .IsUnique();

            builder.HasIndex(x => new { x.OrganizationId, x.IsActive, x.IsPrimary })
                .HasFilter("[IsActive] = 1 AND [IsPrimary] = 1")
                .IsUnique();
        }
    }
}
