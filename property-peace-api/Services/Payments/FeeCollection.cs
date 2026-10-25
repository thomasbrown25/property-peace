using brownstone_hub_api.Models;

namespace brownstone_hub_api.Services.Payments;

/// <summary>Net finalized fee collection, including append-only Stripe loss/recovery deltas.</summary>
public static class FeeCollection
{
    public static decimal Credited(IEnumerable<Payment> payments)
    {
        var rows = payments.ToList();
        var adjustments = rows.Where(p => p.Status == "Completed" && IsAdjustment(p)).ToList();
        var originals = rows.Where(p => p.Amount > 0 && !IsAdjustment(p)
            && (p.Status is "Completed" or "Paid"
                || (p.Status is "Refunded" or "PartiallyRefunded" or "Disputed"
                    && p.StripePaymentIntentId != null
                    && adjustments.Any(a => a.StripePaymentIntentId == p.StripePaymentIntentId))));
        return Math.Max(0m, originals.Sum(p => p.Amount) + adjustments.Sum(p => p.Amount));
    }

    public static bool IsAdjustment(Payment payment) =>
        payment.Method is "Stripe loss adjustment" or "Stripe dispute recovery adjustment";
}
