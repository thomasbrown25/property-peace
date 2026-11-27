export function getTrustedStripeAuthorizationUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.hostname !== 'connect.stripe.com' || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
