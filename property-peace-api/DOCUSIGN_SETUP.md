# DocuSign Integration Setup Guide

This guide will help you set up DocuSign e-signature integration for the Brownstone Hub application.

## Prerequisites

1. A DocuSign account (free developer account is sufficient for testing)
2. Access to DocuSign Admin console
3. Basic understanding of RSA key pairs

## Step 1: Create a DocuSign Developer Account

1. Go to [DocuSign Developer Center](https://developers.docusign.com/)
2. Sign up for a free developer account
3. Verify your email address

## Step 2: Register Your Application

1. Log in to your DocuSign account
2. Navigate to **Admin** > **Apps and Keys** (or **Integrations** > **Apps and Keys**)
3. Click **Add App / Integration Key** (or **Add App and Integration Key**)
4. Provide a name for your application (e.g., "Brownstone Hub")
5. Note the **Integration Key** (Client ID) - you'll need this later
6. Click **Save**

## Step 3: Generate RSA Key Pair

1. In your app's settings, find the **RSA Keypair** section
2. Click **Generate RSA** to create a new key pair
3. **IMPORTANT**: Download and securely store the **private key** file
   - The private key will be shown only once
   - Save it as `docusign_private_key.pem` or similar
   - Store it in a secure location (NOT in your repository)
4. The public key will be automatically uploaded to DocuSign

## Step 4: Obtain Your User ID and Account ID

1. In the **Apps and Keys** section, locate:
   - **User ID** (GUID format, e.g., `12345678-1234-1234-1234-123456789abc`)
   - **Account ID** (GUID format, e.g., `87654321-4321-4321-4321-cba987654321`)
2. Copy both values - you'll need them for configuration

## Step 5: Configure the Application

### Option A: Using appsettings.json (Development)

1. Open `property-peace-api/appsettings.json`
2. Find the `DocuSign` section and fill in the values:

```json
"DocuSign": {
  "IntegrationKey": "YOUR_INTEGRATION_KEY_HERE",
  "UserId": "YOUR_USER_ID_HERE",
  "AccountId": "YOUR_ACCOUNT_ID_HERE",
  "PrivateKeyPath": "C:\\path\\to\\docusign_private_key.pem",
  "PrivateKeyContent": "",
  "ApiBaseUrl": "https://demo.docusign.net/restapi",
  "AuthServer": "account-d.docusign.com",
  "JwtExpirationSeconds": 3600,
  "UseProduction": false
}
```

**OR** use `PrivateKeyContent` instead of `PrivateKeyPath`:

```json
"DocuSign": {
  "IntegrationKey": "YOUR_INTEGRATION_KEY_HERE",
  "UserId": "YOUR_USER_ID_HERE",
  "AccountId": "YOUR_ACCOUNT_ID_HERE",
  "PrivateKeyPath": "",
  "PrivateKeyContent": "-----BEGIN RSA PRIVATE KEY-----\n...your key content...\n-----END RSA PRIVATE KEY-----",
  "ApiBaseUrl": "https://demo.docusign.net/restapi",
  "AuthServer": "account-d.docusign.com",
  "JwtExpirationSeconds": 3600,
  "UseProduction": false
}
```

### Option B: Using Environment Variables (Recommended for Production)

Set the following environment variables:

```bash
DocuSign__IntegrationKey=YOUR_INTEGRATION_KEY
DocuSign__UserId=YOUR_USER_ID
DocuSign__AccountId=YOUR_ACCOUNT_ID
DocuSign__PrivateKeyPath=C:\path\to\docusign_private_key.pem
# OR
DocuSign__PrivateKeyContent=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
DocuSign__ApiBaseUrl=https://demo.docusign.net/restapi
DocuSign__AuthServer=account-d.docusign.com
DocuSign__JwtExpirationSeconds=3600
DocuSign__UseProduction=false
```

### Option C: Using Azure App Configuration (If configured)

Add the DocuSign settings to your Azure App Configuration with the same keys as above.

## Step 6: Configure Redirect URIs (Required Before Granting Consent)

**IMPORTANT**: Before you can grant consent, you must configure redirect URIs in your DocuSign app settings.

1. In your DocuSign account, go to **Admin** > **Apps and Keys**
2. Click on your app/integration key to open its settings
3. Find the **Redirect URIs** section (may be under "Additional Settings" or "OAuth Settings")
4. Click **Add URI** or **+ Add**
5. Add the following redirect URIs:
   - `https://www.docusign.com` (required for JWT consent)
   - `https://account-d.docusign.com` (for demo environment)
   - `https://account.docusign.com` (for production environment)
   - Optionally, add your application's callback URL if you have one
6. Click **Save** to save the redirect URIs

**Note**: For JWT authentication (which this integration uses), the redirect URI is mainly used during the consent flow. The actual redirect doesn't matter much since JWT tokens are obtained programmatically, but DocuSign requires at least one redirect URI to be registered.

## Step 7: Grant Consent (One-Time Setup)

After configuring redirect URIs, you can grant consent:

1. Construct the consent URL:
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=YOUR_INTEGRATION_KEY&redirect_uri=https://www.docusign.com
   ```
   (Replace `YOUR_INTEGRATION_KEY` with your actual Integration Key)
   
   **Important**: The redirect URI must exactly match one of your registered redirect URIs, including the trailing slash if present.

2. For **Demo environment**, use:
   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=35ec1510-615e-475f-914d-9fcc0cca186d&redirect_uri=https://www.docusign.com
   ```

3. For **Production environment**, use:
   ```
   https://account.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=YOUR_INTEGRATION_KEY&redirect_uri=https://www.docusign.com
   ```

4. Open the URL in your browser
5. Log in with your DocuSign account
6. Click **Allow** to grant consent
7. You'll be redirected to DocuSign's website - this is normal

**Note**: This consent is a one-time action. After granting consent, your application can authenticate using JWT tokens.

## Step 8: Test the Integration

1. Build and run your application:
   ```bash
   dotnet build
   dotnet run
   ```

2. Navigate to a lease detail page in your application
3. Click **Send for Signature**
4. Fill in the signer information
5. Submit the request

6. Check the logs for any errors. If you see authentication errors, verify:
   - Integration Key, User ID, and Account ID are correct
   - Private key is accessible and correctly formatted
   - Consent has been granted (Step 6)

## Step 9: Production Setup

When ready to move to production:

1. **Go Live Process**:
   - Follow DocuSign's [Go Live process](https://developers.docusign.com/docs/esign-rest-api/go-live/)
   - This typically involves:
     - Reviewing your integration
     - Providing business information
     - Getting approval from DocuSign

2. **Update Configuration**:
   ```json
   "DocuSign": {
     "ApiBaseUrl": "https://www.docusign.net/restapi",
     "AuthServer": "account.docusign.com",
     "UseProduction": true
   }
   ```

3. **Update Consent URL** (if needed):
   - Use the production consent URL from Step 6

## Troubleshooting

### Error: "Failed to obtain DocuSign authentication token"

**Possible causes:**
- Integration Key, User ID, or Account ID is incorrect
- Private key is not accessible or incorrectly formatted
- Consent has not been granted (see Step 6)
- Wrong AuthServer or ApiBaseUrl for your environment

**Solutions:**
1. Verify all configuration values are correct
2. Ensure the private key file exists and is readable
3. Grant consent using the consent URL (Step 6)
4. Check that you're using demo URLs for demo environment

### Error: "Envelope not found"

**Possible causes:**
- Envelope ID is incorrect
- Envelope was created in a different DocuSign account

**Solutions:**
1. Verify the envelope ID stored in your database
2. Ensure you're using the correct DocuSign account

### Error: "Private key not configured"

**Possible causes:**
- Both `PrivateKeyPath` and `PrivateKeyContent` are empty
- Private key file path is incorrect

**Solutions:**
1. Set either `PrivateKeyPath` or `PrivateKeyContent` in configuration
2. Verify the file path is correct and the file is accessible

## Security Best Practices

1. **Never commit private keys to version control**
   - Use environment variables or Azure Key Vault for production
   - Add `*.pem` and `*_private_key*` to `.gitignore`

2. **Use Azure Key Vault or similar for production**
   - Store sensitive configuration in a secure vault
   - Reference values from the vault in your configuration

3. **Rotate keys periodically**
   - Generate new RSA key pairs
   - Update configuration with new keys
   - Revoke old keys in DocuSign admin console

4. **Use separate accounts for development and production**
   - Keep demo and production credentials separate
   - Never use production credentials in development

## Additional Resources

- [DocuSign Developer Center](https://developers.docusign.com/)
- [DocuSign eSignature REST API Documentation](https://developers.docusign.com/docs/esign-rest-api/)
- [DocuSign C# SDK Documentation](https://github.com/docusign/docusign-csharp-client)
- [JWT Grant Authentication Guide](https://developers.docusign.com/docs/esign-rest-api/esign101/concepts/jwt/)

## Support

If you encounter issues:
1. Check the application logs for detailed error messages
2. Verify all configuration values are correct
3. Ensure consent has been granted
4. Review DocuSign's API status page
5. Consult DocuSign's developer documentation

