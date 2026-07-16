# Twilio SMS Setup Guide

This guide will help you set up Twilio as your SMS provider for Brownstone Hub.

## Why Twilio?

Twilio is a reliable, widely-used SMS service provider with:
- Excellent documentation and developer support
- Competitive pricing
- High deliverability rates
- Easy setup and integration
- Support for both US and international numbers

## Setup Steps

### 1. Create a Twilio Account

1. Go to [https://www.twilio.com](https://www.twilio.com)
2. Sign up for a free account (includes $15.50 trial credit)
3. Verify your email and phone number

### 2. Get Your Twilio Credentials

1. Log in to your Twilio Console: [https://console.twilio.com](https://console.twilio.com)
2. Navigate to **Account** → **API Keys & Tokens**
3. You'll need:
   - **Account SID**: Found on your dashboard (starts with `AC`)
   - **Auth Token**: Click "Show" to reveal it (keep this secret!)

### 3. Get a Twilio Phone Number

1. In the Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Select your country (e.g., United States)
3. Choose a phone number (you can filter by capabilities)
4. Click **Buy** (free for trial accounts)
5. Copy the phone number (format: `+1234567890`)

### 4. Configure Your Application

Update your `appsettings.json` or Azure App Configuration with:

```json
{
  "SmsProvider": "Twilio",
  "Twilio": {
    "AccountSid": "YOUR_ACCOUNT_SID_HERE",
    "AuthToken": "YOUR_AUTH_TOKEN_HERE",
    "FromPhoneNumber": "+1234567890"
  }
}
```

**Important Security Notes:**
- Never commit credentials to source control
- Use Azure App Configuration or User Secrets for production
- The `SmsProvider` setting controls which service is used:
  - `"Twilio"` - Uses Twilio SMS service
  - `"Azure"` - Uses Azure Communication Services (default)

### 5. Test Your Setup

After configuring, restart your application. The logs should show:
```
[Config] Using Twilio as SMS provider
Twilio SMS service initialized successfully.
```

## Switching Between Providers

To switch back to Azure Communication Services, simply change:

```json
{
  "SmsProvider": "Azure"
}
```

Or remove the `SmsProvider` setting (defaults to Azure for backward compatibility).

## Pricing

### Twilio Pricing (as of 2024)
- **US SMS**: ~$0.0075 per message (sent or received)
- **International SMS**: Varies by country
- **Free Trial**: $15.50 credit included

### Azure Communication Services Pricing
- **US SMS**: ~$0.0075 per message
- Similar pricing structure

Both services have similar pricing, so choose based on reliability and ease of use.

## Troubleshooting

### SMS Not Sending

1. **Check Configuration**
   - Verify `AccountSid`, `AuthToken`, and `FromPhoneNumber` are set correctly
   - Ensure `SmsProvider` is set to `"Twilio"`

2. **Check Logs**
   - Look for error messages in application logs
   - Common issues:
     - Invalid phone number format (must be E.164: `+1234567890`)
     - Insufficient account balance
     - Unverified phone number (trial accounts can only send to verified numbers)

3. **Trial Account Limitations**
   - Trial accounts can only send SMS to verified phone numbers
   - Upgrade to a paid account to send to any number

4. **Phone Number Format**
   - The service automatically normalizes phone numbers to E.164 format
   - Supports formats like: `(123) 456-7890`, `123-456-7890`, `1234567890`, `+11234567890`

### Verify Phone Numbers (Trial Accounts)

1. Go to **Phone Numbers** → **Verified Caller IDs**
2. Add and verify phone numbers you want to send to
3. This is only required for trial accounts

## Additional Resources

- [Twilio SMS Documentation](https://www.twilio.com/docs/sms)
- [Twilio .NET SDK](https://www.twilio.com/docs/libraries/csharp-dotnet)
- [Twilio Console](https://console.twilio.com)
- [Twilio Support](https://support.twilio.com)

## Alternative SMS Providers

If Twilio doesn't work for you, other options include:

1. **AWS SNS** - Good if you're already using AWS
2. **Vonage (formerly Nexmo)** - Similar to Twilio
3. **Plivo** - Developer-friendly API
4. **MessageBird** - Good for international messaging

The codebase is designed to easily add additional SMS providers by implementing the `ISmsService` interface.
