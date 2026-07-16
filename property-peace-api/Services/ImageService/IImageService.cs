
using brownstone_hub_api.Shared;

namespace brownstone_hub_api.Services.ImageService
{
    public interface IImageService<TEntity, TLoadDto, TAddDto>
        where TEntity : class, IImageEntity
    {
        Task<ServiceResponse<List<TLoadDto>>> AddImages(long refId, List<IFormFile> files);
        Task<ServiceResponse<bool>> DeleteImage(string blobName);
        Task<ServiceResponse<bool>> DeleteImageById(long id);
        Task<ServiceResponse<bool>> DeleteImagesByRefId(long refId); // ✅ NEW
        Task<ServiceResponse<List<TLoadDto>>> GetImagesByRefId(long refId);
        Task<ServiceResponse<bool>> SetCoverPhoto(long refId, long imageId);
    }


}