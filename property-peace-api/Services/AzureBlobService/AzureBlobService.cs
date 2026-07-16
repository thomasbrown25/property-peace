

using Azure.Storage;
using Azure.Storage.Blobs;
using Azure.Storage.Sas;

namespace brownstone_hub_api.Services.AzureBlobService
{
    public class AzureBlobService(IConfiguration configuration) : IAzureBlobService
    {
        private readonly IConfiguration _configuration = configuration;

        public string GenerateBlobSasUri(BlobServiceClient blobServiceClient, BlobClient blobClient, TimeSpan duration)
        {
            // Use UTC to avoid timezone issues
            // Set start time to 5 minutes ago to account for clock skew between server and Azure Storage
            var startTime = DateTimeOffset.UtcNow.AddMinutes(-5);
            var expiryTime = DateTimeOffset.UtcNow.Add(duration);
            
            var sasBuilder = new BlobSasBuilder
            {
                BlobContainerName = blobClient.BlobContainerName,
                BlobName = blobClient.Name,
                Resource = "b",
                StartsOn = startTime, // Set to 5 minutes ago to account for clock skew
                ExpiresOn = expiryTime
            };

            sasBuilder.SetPermissions(BlobSasPermissions.Read);

            // Try to get AccountKey from configuration, fallback to extracting from connection string
            var accountKey = _configuration["AzureBlobStorage:AccountKey"];
            
            if (string.IsNullOrEmpty(accountKey))
            {
                // Extract AccountKey from connection string
                var connectionString = _configuration.GetConnectionString("AzureBlobStorage");
                if (!string.IsNullOrEmpty(connectionString))
                {
                    var parts = connectionString.Split(';');
                    foreach (var part in parts)
                    {
                        if (part.StartsWith("AccountKey=", StringComparison.OrdinalIgnoreCase))
                        {
                            accountKey = part.Substring("AccountKey=".Length);
                            break;
                        }
                    }
                }
            }

            if (string.IsNullOrEmpty(accountKey))
            {
                throw new InvalidOperationException("Azure Blob Storage AccountKey not found in configuration. Please set AzureBlobStorage:AccountKey or include it in the AzureBlobStorage connection string.");
            }

            var sharedKeyCredential = new StorageSharedKeyCredential(
                blobServiceClient.AccountName,
                accountKey
            );

            var sasToken = sasBuilder.ToSasQueryParameters(sharedKeyCredential).ToString();
            return $"{blobClient.Uri}?{sasToken}";
        }
    }
}