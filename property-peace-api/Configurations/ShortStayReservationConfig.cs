using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace brownstone_hub_api.Configurations;

public sealed class ShortStayReservationConfig : IEntityTypeConfiguration<ShortStayReservation>
{
    public void Configure(EntityTypeBuilder<ShortStayReservation> b)
    {
        b.ToTable("ShortStayReservations", "listing", t =>
        {
            t.HasCheckConstraint("CK_ShortStayReservations_Range", "[CheckOutDate] > [CheckInDate]");
            t.HasCheckConstraint("CK_ShortStayReservations_Quote", "[GuestCount] > 0 AND [NightlySubtotalCents] > 0 AND [CleaningFeeCents] >= 0 AND [TaxCents] >= 0 AND [TotalCents] = [NightlySubtotalCents] + [CleaningFeeCents] + [TaxCents] AND [TotalCents] <= 99999999 AND [Currency] = 'usd'");
            t.HasCheckConstraint("CK_ShortStayReservations_Status", "[Status] IN ('Held','PendingPayment','Processing','Confirmed','Expired','Failed','RefundRequired','Refunded','Disputed')");
            t.HasCheckConstraint("CK_ShortStayReservations_Version", "[RowVersion] > 0");
            t.HasCheckConstraint("CK_ShortStayReservations_Expiry", "[HoldExpiresAtUtc] > [CreatedAtUtc]");
            t.HasCheckConstraint("CK_ShortStayReservations_Confirmation", "[Status] <> 'Confirmed' OR ([StripePaymentIntentId] IS NOT NULL AND [PaymentConfirmedAtUtc] IS NOT NULL)");
        });
        b.HasKey(x => x.Id);
        b.Property(x => x.PublicCode).HasMaxLength(32).IsRequired();
        b.Property(x => x.OperationId).HasMaxLength(32).IsRequired();
        b.Property(x => x.DestinationStripeAccountId).HasMaxLength(255).IsRequired();
        b.Property(x => x.Currency).HasMaxLength(3).IsRequired();
        b.Property(x => x.StripePaymentIntentId).HasMaxLength(255);
        b.Property(x => x.Status).HasConversion<string>().HasMaxLength(32).IsRequired();
        b.Property(x => x.RowVersion).IsConcurrencyToken().ValueGeneratedNever();
        b.HasIndex(x => x.PublicCode).IsUnique();
        b.HasIndex(x => x.OperationId).IsUnique();
        b.HasIndex(x => x.StripePaymentIntentId).IsUnique().HasFilter("[StripePaymentIntentId] IS NOT NULL");
        b.HasIndex(x => new { x.UnitId, x.CheckInDate, x.CheckOutDate });
        b.HasIndex(x => new { x.Status, x.HoldExpiresAtUtc });
        b.HasIndex(x => new { x.OrganizationId, x.DestinationStripeAccountId }); // scoped payee lookup, NOT unique: accounts serve many reservations
        b.HasOne<Unit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne<Property>().WithMany().HasForeignKey(x => x.PropertyId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne<Organization>().WithMany().HasForeignKey(x => x.OrganizationId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.GuestUserId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne<User>().WithMany().HasForeignKey(x => x.PayeeUserId).OnDelete(DeleteBehavior.NoAction);
        b.HasAlternateKey(x => new { x.Id, x.UnitId });
        b.HasMany(x => x.Nights).WithOne(x => x.Reservation)
            .HasForeignKey(x => new { x.ReservationId, x.UnitId })
            .HasPrincipalKey(x => new { x.Id, x.UnitId }).OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class ShortStayReservationNightConfig : IEntityTypeConfiguration<ShortStayReservationNight>
{
    public void Configure(EntityTypeBuilder<ShortStayReservationNight> b)
    {
        b.ToTable("ShortStayReservationNights", "listing", t => t.HasCheckConstraint("CK_ShortStayReservationNights_Price", "[PriceCents] > 0"));
        b.HasKey(x => x.Id);
        b.HasIndex(x => new { x.ReservationId, x.Date }).IsUnique();
        b.HasAlternateKey(x => new { x.ReservationId, x.UnitId, x.Date });
        b.HasOne<Unit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.NoAction);
    }
}

public sealed class ShortStayOccupancyClaimConfig : IEntityTypeConfiguration<ShortStayOccupancyClaim>
{
    public void Configure(EntityTypeBuilder<ShortStayOccupancyClaim> b)
    {
        b.ToTable("ShortStayOccupancyClaims", "listing");
        b.HasKey(x => new { x.UnitId, x.Date }); // one live occupancy claim per unit/local date
        b.HasIndex(x => x.ReservationId);
        b.HasOne(x => x.Reservation).WithMany(x => x.Claims).HasForeignKey(x => x.ReservationId).OnDelete(DeleteBehavior.NoAction);
        b.HasOne<ShortStayReservationNight>().WithMany()
            .HasForeignKey(x => new { x.ReservationId, x.UnitId, x.Date })
            .HasPrincipalKey(x => new { x.ReservationId, x.UnitId, x.Date })
            .OnDelete(DeleteBehavior.NoAction);
        b.HasOne<Unit>().WithMany().HasForeignKey(x => x.UnitId).OnDelete(DeleteBehavior.NoAction);
    }
}
