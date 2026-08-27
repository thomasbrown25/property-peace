export type RentPaymentMarketingState = "unavailable" | "live";

export const rentPaymentLaunchState: RentPaymentMarketingState =
  process.env.RENT_PAYMENTS_MARKETING_STATE === "live" ? "live" : "unavailable";

export const rentPaymentsAreLive = rentPaymentLaunchState === "live";