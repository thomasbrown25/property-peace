using System.Security.Cryptography;

namespace brownstone_hub_api.Models;

public enum ShortStayReservationStatus
{
    Held, PendingPayment, Processing, Confirmed, Expired, Failed, RefundRequired, Refunded, Disputed
}

// Internal persistence aggregate only. No anonymous guest boundary or payment command is exposed.
public class ShortStayReservation
{
    public long Id { get; private set; }
    public string PublicCode { get; private set; } = string.Empty;
    public string OperationId { get; private set; } = string.Empty;
    public long UnitId { get; private set; }
    public long PropertyId { get; private set; }
    public long OrganizationId { get; private set; }
    public long GuestUserId { get; private set; }
    public long PayeeUserId { get; private set; }
    public string DestinationStripeAccountId { get; private set; } = string.Empty;
    public DateOnly CheckInDate { get; private set; }
    public DateOnly CheckOutDate { get; private set; }
    public int GuestCount { get; private set; }
    public long TotalCents { get; private set; }
    public long NightlySubtotalCents { get; private set; }
    public long DiscountCents { get; private set; }
    public long CleaningFeeCents { get; private set; }
    public long TaxCents { get; private set; }
    // Stripe PaymentIntent create amount is limited to eight digits in the smallest unit (USD cents).
    // https://docs.stripe.com/api/payment_intents/create#payment_intent_create-amount
    public const long MaximumUsdPaymentCents = 99_999_999;
    public string Currency { get; private set; } = "usd";
    public ShortStayReservationStatus Status { get; private set; }
    public DateTimeOffset HoldExpiresAtUtc { get; private set; }
    public string? StripePaymentIntentId { get; set; }
    public DateTimeOffset? PaymentConfirmedAtUtc { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; private set; }
    public DateTimeOffset UpdatedAtUtc { get; private set; }
    public long RowVersion { get; private set; } = 1;
    public ICollection<ShortStayReservationNight> Nights { get; private set; } = new List<ShortStayReservationNight>();
    public ICollection<ShortStayOccupancyClaim> Claims { get; private set; } = new List<ShortStayOccupancyClaim>();

    private ShortStayReservation() { }

    public static ShortStayReservation CreateHold(long unitId, long propertyId, long organizationId,
        long guestUserId, long payeeUserId, string destinationStripeAccountId, DateOnly checkInDate,
        DateOnly checkOutDate, int guestCount, IReadOnlyList<long> nightlyPricesCents,
        DateTimeOffset expiresAtUtc, DateTimeOffset nowUtc, long cleaningFeeCents = 0, long taxCents = 0, string? operationId = null,
        long discountCents = 0)
    {
        if (cleaningFeeCents < 0 || taxCents < 0)
            throw new ArgumentException("Fees cannot be negative.");
        if (unitId <= 0 || propertyId <= 0 || organizationId <= 0 || guestUserId <= 0 || payeeUserId <= 0 ||
            string.IsNullOrWhiteSpace(destinationStripeAccountId) ||
            checkOutDate <= checkInDate || guestCount <= 0 ||
            nightlyPricesCents is null || nightlyPricesCents.Count != checkOutDate.DayNumber - checkInDate.DayNumber ||
            nightlyPricesCents.Any(x => x <= 0) ||
            expiresAtUtc.Offset != TimeSpan.Zero || nowUtc.Offset != TimeSpan.Zero || expiresAtUtc <= nowUtc)
            throw new ArgumentException("A hold needs an authenticated guest, payee, valid local nights, positive quote and future UTC expiry.");

        long subtotal;
        long total;
        try
        {
            subtotal = nightlyPricesCents.Aggregate(0L, (sum, price) => checked(sum + price));
            if (discountCents < 0 || discountCents >= subtotal) throw new ArgumentException("Invalid nightly discount.", nameof(discountCents));
            subtotal = checked(subtotal - discountCents);
            total = checked(checked(subtotal + cleaningFeeCents) + taxCents);
        }
        catch (OverflowException ex) { throw new ArgumentException("Quote exceeds supported cents range.", nameof(nightlyPricesCents), ex); }
        if (total > MaximumUsdPaymentCents)
            throw new ArgumentException("Quote exceeds Stripe's USD PaymentIntent amount limit.", nameof(nightlyPricesCents));

        var reservation = new ShortStayReservation
        {
            PublicCode = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)),
            OperationId = operationId ?? Guid.NewGuid().ToString("N"),
            UnitId = unitId, PropertyId = propertyId, OrganizationId = organizationId,
            GuestUserId = guestUserId, PayeeUserId = payeeUserId,
            DestinationStripeAccountId = destinationStripeAccountId,
            CheckInDate = checkInDate, CheckOutDate = checkOutDate, GuestCount = guestCount,
            NightlySubtotalCents = subtotal, DiscountCents = discountCents, CleaningFeeCents = cleaningFeeCents, TaxCents = taxCents,
            TotalCents = total,
            Status = ShortStayReservationStatus.Held,
            HoldExpiresAtUtc = expiresAtUtc, CreatedAtUtc = nowUtc, UpdatedAtUtc = nowUtc
        };
        for (var i = 0; i < nightlyPricesCents.Count; i++)
        {
            var date = checkInDate.AddDays(i);
            reservation.Nights.Add(new ShortStayReservationNight
            {
                UnitId = unitId, Date = date, PriceCents = nightlyPricesCents[i]
            });
            reservation.Claims.Add(new ShortStayOccupancyClaim { UnitId = unitId, Date = date });
        }
        return reservation;
    }

    public void ExpireHold(DateTimeOffset nowUtc)
    {
        if (Status != ShortStayReservationStatus.Held || HoldExpiresAtUtc > nowUtc)
            throw new InvalidOperationException("Only elapsed unpaid holds can expire.");
        Status = ShortStayReservationStatus.Expired;
        UpdatedAtUtc = nowUtc;
        RowVersion++;
    }

    public void BeginPayment(DateTimeOffset nowUtc)
    {
        if (Status != ShortStayReservationStatus.Held || nowUtc >= HoldExpiresAtUtc || StripePaymentIntentId is not null)
            throw new InvalidOperationException("Only an unexpired unpaid hold may start payment.");
        Status = ShortStayReservationStatus.PendingPayment;
        UpdatedAtUtc = nowUtc;
        RowVersion++;
    }

    public void AttachPaymentIntent(string paymentIntentId, DateTimeOffset nowUtc)
    {
        if (Status != ShortStayReservationStatus.PendingPayment || StripePaymentIntentId is not null ||
            string.IsNullOrWhiteSpace(paymentIntentId))
            throw new InvalidOperationException("Only an initiated payment may attach its first intent.");
        StripePaymentIntentId = paymentIntentId;
        UpdatedAtUtc = nowUtc;
    }

    // Called only after fresh provider retrieval by the internal reconciler.
    public void Reconcile(ShortStayReservationStatus next, DateTimeOffset nowUtc)
    {
        if (next == Status) return;
        var allowed = Status switch
        {
            ShortStayReservationStatus.PendingPayment or ShortStayReservationStatus.Processing =>
                next is ShortStayReservationStatus.Processing or ShortStayReservationStatus.Confirmed or
                    ShortStayReservationStatus.Failed or ShortStayReservationStatus.RefundRequired,
            ShortStayReservationStatus.Expired or ShortStayReservationStatus.Failed => next == ShortStayReservationStatus.RefundRequired,
            ShortStayReservationStatus.Confirmed => next is ShortStayReservationStatus.Disputed or ShortStayReservationStatus.RefundRequired,
            _ => false
        };
        if (!allowed || StripePaymentIntentId is null)
            throw new InvalidOperationException("Invalid payment reconciliation transition.");
        Status = next;
        if (next == ShortStayReservationStatus.Confirmed) PaymentConfirmedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
        RowVersion++;
    }

    public void MarkRefunded(DateTimeOffset nowUtc)
    {
        if (Status != ShortStayReservationStatus.RefundRequired || StripePaymentIntentId is null)
            throw new InvalidOperationException("Only a refund-required reservation may be refunded.");
        Status = ShortStayReservationStatus.Refunded;
        UpdatedAtUtc = nowUtc;
        RowVersion++;
    }
}

// Immutable quote history: no unique unit/date constraint here; multiple expired attempts can retain quotes.
public class ShortStayReservationNight
{
    public long Id { get; set; }
    public long ReservationId { get; set; }
    public ShortStayReservation Reservation { get; set; } = null!;
    public long UnitId { get; set; }
    public DateOnly Date { get; set; }
    public long PriceCents { get; set; }
}

// A live claim occupies exactly one property-local night. Insert/delete with the reservation lifecycle
// in one transaction while serializing on the same unit lock; expired/failed holds release claims,
// confirmed reservations retain them. A unique (UnitId, Date) constraint is the final race barrier.
public class ShortStayOccupancyClaim
{
    public long UnitId { get; set; }
    public DateOnly Date { get; set; }
    public long ReservationId { get; set; }
    public ShortStayReservation Reservation { get; set; } = null!;
}
