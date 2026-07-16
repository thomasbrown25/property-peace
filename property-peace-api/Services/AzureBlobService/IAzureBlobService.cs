
using Azure.Storage.Blobs;

namespace brownstone_hub_api.Services.AzureBlobService
{
    public interface IAzureBlobService
    {
        string GenerateBlobSasUri(BlobServiceClient blobServiceClient, BlobClient blobClient, TimeSpan duration);
    }
}