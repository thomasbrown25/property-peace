# Email assets

Place **logo-with-text.png** (Property Peace logo) in this folder so it is **embedded in broadcast emails** and displays even when email clients block external images.

**To add the logo:**
1. Copy `logo-with-text.png` from the frontend app:
   `property-peace-app/src/assets/images/logos/logo-with-text.png`
   into this folder:
   `property-peace-api/Assets/Email/logo-with-text.png`
2. Rebuild/restart the API.

If this file is missing, the API falls back to the **EmailLogoUrl** or **FrontendBaseUrl** config (external URL). Many email clients block external images by default, so embedding the logo here gives the most reliable display.
