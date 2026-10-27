namespace brownstone_hub_api.Services.ShortStay;

// The key is server-generated and never supplied by an HTTP caller.
public interface IShortStayPhotoStorage
{
    Task Write(string key, byte[] bytes, string contentType, CancellationToken ct);
    Task Delete(string key, CancellationToken ct);
    Task<string> ReadUrl(string key, CancellationToken ct);
}
