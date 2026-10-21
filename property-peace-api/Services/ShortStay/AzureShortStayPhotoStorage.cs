using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;

namespace brownstone_hub_api.Services.ShortStay;

// Dedicated private container; never reuse the generic publicly configurable listing-images container.
public sealed class AzureShortStayPhotoStorage(BlobServiceClient client) : IShortStayPhotoStorage
{
    private const string Container = "short-stay-listing-photos-private";
    private BlobContainerClient Bucket => client.GetBlobContainerClient(Container);
    public async Task Write(string key, byte[] bytes, string contentType, CancellationToken ct)
    {
        var bucket = Bucket;
        await bucket.CreateIfNotExistsAsync(PublicAccessType.None, cancellationToken: ct);
        // An existing container could have been made public externally: fail closed by forcing private access.
        await bucket.SetAccessPolicyAsync(PublicAccessType.None, cancellationToken: ct);
        await bucket.GetBlobClient(key).UploadAsync(new BinaryData(bytes),
            new BlobUploadOptions { HttpHeaders = new BlobHttpHeaders { ContentType = contentType, CacheControl = "private, no-store" },
                Conditions = new Azure.Storage.Blobs.Models.BlobRequestConditions { IfNoneMatch = Azure.ETag.All } }, ct);
    }
    public async Task Delete(string key, CancellationToken ct) =>
        await Bucket.GetBlobClient(key).DeleteIfExistsAsync(cancellationToken: ct);

    public async Task<string> ReadUrl(string key, CancellationToken ct)
    {
        var bucket = Bucket;
        var properties = await bucket.GetPropertiesAsync(cancellationToken: ct);
        if (properties.Value.PublicAccess != PublicAccessType.None) throw new InvalidOperationException("Private storage required");
        var blob = bucket.GetBlobClient(key);
        if (!blob.CanGenerateSasUri) throw new InvalidOperationException("Read signing unavailable");
        return blob.GenerateSasUri(new BlobSasBuilder
        {
            BlobContainerName = Container, BlobName = key, Resource = "b",
            StartsOn = DateTimeOffset.UtcNow.AddMinutes(-1), ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(5),
            ContentDisposition = "inline", CacheControl = "private, no-store"
        }.WithReadPermission()).ToString();
    }
}

internal static class ShortStaySasExtensions
{
    internal static BlobSasBuilder WithReadPermission(this BlobSasBuilder builder)
    {
        builder.SetPermissions(BlobSasPermissions.Read);
        return builder;
    }
}
