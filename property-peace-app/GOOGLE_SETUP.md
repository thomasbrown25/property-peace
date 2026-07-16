# Google Sign-In Setup Guide

## Quick Fix for "Missing required parameter client_id" Error

The error occurs because the Google Client ID environment variable is not set. Follow these steps:

### Step 1: Get Google Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Configure:
   - **Application type**: Web application
   - **Name**: Brownstone Hub
   - **Authorized JavaScript origins**: 
     - `http://localhost:3000` (for development)
     - Add your production URL when ready
   - **Authorized redirect URIs**:
     - `http://localhost:3000` (for development)
     - Add your production URL when ready
6. Click **Create**
7. **Copy the Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)

### Step 2: Create .env File

1. In the `property-peace-app` folder, create a file named `.env` (or `.env.local`)
2. Add the following line:
   ```
   VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   ```
3. Replace `your-client-id-here.apps.googleusercontent.com` with your actual Client ID

### Step 3: Restart Development Server

After creating/updating the `.env` file:
1. Stop your development server (Ctrl+C)
2. Restart it:
   ```bash
   npm start
   ```

### Step 4: Verify

1. Open your browser console
2. Check that the error is gone
3. Try clicking "Sign in with Google" - it should work now!

---

## Notes

- The `.env` file is typically ignored by git (for security)
- Never commit your actual Client ID to version control
- For production, set the environment variable in your hosting platform (Azure, Vercel, etc.)

---

## Troubleshooting

**Still getting the error?**
- Make sure the `.env` file is in the `property-peace-app` folder (not in `src`)
- Make sure the variable name is exactly `VITE_GOOGLE_CLIENT_ID` (case-sensitive)
- Restart your dev server after creating/updating `.env`
- Check browser console for any other errors

**Google Sign-In button not showing?**
- The button will only show if `VITE_GOOGLE_CLIENT_ID` is set
- If not set, the app will work normally but without Google Sign-In

