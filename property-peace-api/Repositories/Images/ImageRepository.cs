using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Repositories.Images;
using brownstone_hub_api.Shared;
using Microsoft.EntityFrameworkCore;

public class ImageRepository<TEntity, TLoadDto, TAddDto> : IImageRepository<TEntity, TLoadDto, TAddDto>
    where TEntity : class, IImageEntity
    where TLoadDto : class
    where TAddDto : class
{
    private readonly DataContext _context;
    private readonly IMapper _mapper;
    private readonly DbSet<TEntity> _dbSet;

    public ImageRepository(DataContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
        _dbSet = context.Set<TEntity>();
    }

    public async Task<TLoadDto> AddImage(TAddDto image)
    {
        var entity = _mapper.Map<TEntity>(image);
        await _dbSet.AddAsync(entity);
        await _context.SaveChangesAsync();

        return _mapper.Map<TLoadDto>(entity);
    }

    public async Task<List<TLoadDto>> GetImagesByRefId(long refId)
    {
        var images = await _dbSet
            .Where(x => x.RefId == refId)
            .ToListAsync();

        return _mapper.Map<List<TLoadDto>>(images);
    }

    public async Task<TLoadDto> DeleteImage(long id)
    {
        var entity = await _dbSet.FindAsync(id)
            ?? throw new KeyNotFoundException($"{typeof(TEntity).Name} with ID {id} not found.");

        _dbSet.Remove(entity);
        await _context.SaveChangesAsync();

        return _mapper.Map<TLoadDto>(entity);
    }

    public async Task DeleteImagesByRefId(long refId)
    {
        var entities = await _dbSet.Where(x => x.RefId == refId).ToListAsync();
        if (entities.Any())
        {
            _dbSet.RemoveRange(entities);
            await _context.SaveChangesAsync();
        }
    }

    public async Task SetCoverPhoto(long refId, long imageId)
    {
        var coverProp = typeof(TEntity).GetProperty("IsCoverPhoto");
        if (coverProp == null) return;

        var entities = await _dbSet.Where(x => x.RefId == refId).ToListAsync();
        foreach (var e in entities)
            coverProp.SetValue(e, false);
        var cover = entities.FirstOrDefault(x => x.Id == imageId);
        if (cover != null)
            coverProp.SetValue(cover, true);
        await _context.SaveChangesAsync();
    }
}
