using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace brownstone_hub_api.Configurations
{
    public class ListingConfig : IEntityTypeConfiguration<Listing>
    {
        public void Configure(EntityTypeBuilder<Listing> b)
        {
            b.ToTable("Listings", "listing");

            b.Property(l => l.MonthlyRent).HasPrecision(18, 2);
            b.Property(l => l.SecurityDeposit).HasPrecision(18, 2);
            b.Property(l => l.ApplicationFee).HasPrecision(18, 2);
            b.Property(l => l.IncomeVerificationCost).HasPrecision(18, 2);

            b.HasOne(l => l.Property)
             .WithMany()
             .HasForeignKey(l => l.PropertyId)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(l => l.Unit)
             .WithMany()
             .HasForeignKey(l => l.UnitId)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(l => l.Organization)
             .WithMany()
             .HasForeignKey(l => l.OrganizationId)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(l => l.CreatedByUser)
             .WithMany()
             .HasForeignKey(l => l.CreatedBy)
             .OnDelete(DeleteBehavior.NoAction);

            b.HasOne(l => l.ListingContact)
             .WithMany()
             .HasForeignKey(l => l.ListingContactId)
             .OnDelete(DeleteBehavior.SetNull);

            b.HasMany(l => l.Images)
             .WithOne(i => i.Listing)
             .HasForeignKey(i => i.RefId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(l => l.ListingAmenities)
             .WithOne(la => la.Listing)
             .HasForeignKey(la => la.ListingId)
             .OnDelete(DeleteBehavior.Cascade);

            b.HasMany(l => l.ListingFeatures)
             .WithOne(lf => lf.Listing)
             .HasForeignKey(lf => lf.ListingId)
             .OnDelete(DeleteBehavior.Cascade);

            // Store enums as strings
            b.Property(l => l.Status)
             .HasConversion(new EnumToStringConverter<EListingStatus>())
             .HasMaxLength(50)
             .IsRequired();

            b.Property(l => l.ScreeningType)
             .HasConversion(new EnumToStringConverter<EScreeningType>())
             .HasMaxLength(50);

            b.Property(l => l.ListingNumber)
             .HasMaxLength(50);

            b.HasIndex(l => l.ListingNumber).IsUnique().HasFilter("[ListingNumber] IS NOT NULL");
            b.HasIndex(l => l.OrganizationId);
            b.HasIndex(l => l.PropertyId);
            b.HasIndex(l => l.UnitId);
            b.HasIndex(l => l.Status);
        }
    }
}
