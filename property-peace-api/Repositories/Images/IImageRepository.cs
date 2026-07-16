

using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Shared;

namespace brownstone_hub_api.Repositories.Images
{
    public interface IImageRepository<TEntity, TLoadDto, TAddDto>
        where TEntity : class, IImageEntity
        where TLoadDto : class
        where TAddDto : class
    {
        Task<TLoadDto> AddImage(TAddDto image);
        Task<List<TLoadDto>> GetImagesByRefId(long refId);
        Task<TLoadDto> DeleteImage(long id);
        Task DeleteImagesByRefId(long refId);
        Task SetCoverPhoto(long refId, long imageId);
    }


}