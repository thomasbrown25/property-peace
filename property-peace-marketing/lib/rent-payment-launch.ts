export const rentPaymentLaunchState = process.env.NEXT_PUBLIC_RENT_PAYMENT_LAUNCH === 'live' ? 'live' : 'unavailable';
export const rentPaymentsAreLive = rentPaymentLaunchState === 'live';
