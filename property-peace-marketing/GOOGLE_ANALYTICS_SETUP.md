# Google Analytics 4 Setup Guide

## Overview
This guide explains how to set up Google Analytics 4 (GA4) for the Brownstone Hub marketing website.

## Step 1: Create Google Analytics 4 Property

1. Go to [Google Analytics](https://analytics.google.com/)
2. Sign in with your Google account
3. Click "Admin" (gear icon) in the bottom left
4. In the "Property" column, click "Create Property"
5. Enter property name: "Brownstone Hub Marketing"
6. Select time zone and currency
7. Click "Next" and complete the business information
8. Click "Create"

## Step 2: Get Your Measurement ID

1. In your new GA4 property, go to "Admin" → "Data Streams"
2. Click "Add stream" → "Web"
3. Enter website URL: `https://brownstonehub.com`
4. Enter stream name: "Brownstone Hub Marketing"
5. Click "Create stream"
6. Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)

## Step 3: Add Measurement ID to Environment Variables

1. Create a `.env.local` file in the `property-peace-marketing` directory (if it doesn't exist)
2. Add your Measurement ID:
   ```
   NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
   ```
   Replace `G-XXXXXXXXXX` with your actual Measurement ID

3. **Important**: Add `.env.local` to `.gitignore` to keep your ID private

## Step 4: Verify Installation

1. Build and deploy your site:
   ```bash
   npm run build
   ```

2. Visit your website and navigate through a few pages

3. In Google Analytics, go to "Reports" → "Realtime"
4. You should see your own visit appear within 30 seconds

## Step 5: Set Up Conversions (Optional)

Track important events like:
- Trial sign-ups
- Demo requests
- Feature page visits

### To set up conversions:

1. In GA4, go to "Admin" → "Events"
2. Click "Create event"
3. Name your event (e.g., "trial_signup")
4. Configure the event parameters
5. Mark as "Conversion" if it's a conversion event

## Current Implementation

The Google Analytics script is already integrated in `app/layout.tsx`. It will automatically:
- Load the GA4 script
- Initialize tracking
- Track page views
- Work with Next.js static export

## Testing

To test that GA4 is working:

1. Open your website in an incognito/private browser window
2. Navigate through several pages
3. Check Google Analytics Realtime report
4. You should see your activity

## Troubleshooting

### Analytics not showing data:
- Verify `NEXT_PUBLIC_GA_ID` is set correctly in `.env.local`
- Check browser console for errors
- Ensure the site is deployed (GA doesn't work on localhost in some cases)
- Verify the Measurement ID format is correct (starts with `G-`)

### Script not loading:
- Check that `NEXT_PUBLIC_GA_ID` environment variable is set
- Verify the variable name matches exactly (case-sensitive)
- Rebuild the site after adding the environment variable

## Privacy Considerations

- Google Analytics collects user data
- Consider adding a cookie consent banner for GDPR compliance
- Review Google Analytics data retention settings
- Consider using Google Analytics with IP anonymization enabled

## Additional Resources

- [Google Analytics 4 Documentation](https://support.google.com/analytics/answer/10089681)
- [GA4 Setup Assistant](https://support.google.com/analytics/answer/9304153)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
