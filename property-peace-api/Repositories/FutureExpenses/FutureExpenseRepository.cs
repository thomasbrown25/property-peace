using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.FutureExpense;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.FutureExpenses
{
    public class FutureExpenseRepository(DataContext context, ILogger<FutureExpenseRepository> logger, IMapper mapper) : IFutureExpenseRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<FutureExpenseRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        public async Task<LoadFutureExpenseDto> AddFutureExpense(AddFutureExpenseDto futureExpense, long? organizationId = null)
        {
            try
            {
                _logger.LogInformation("[FutureExpenseRepository] AddFutureExpense called: LandlordId={LandlordId}, OrganizationId={OrganizationId}, PropertyId={PropertyId}, Name={Name}, Amount={Amount}, DueDate={DueDate}", 
                    futureExpense.LandlordId, organizationId, futureExpense.PropertyId, futureExpense.Name, futureExpense.Amount, futureExpense.DueDate);

                var entity = _mapper.Map<Models.FutureExpense>(futureExpense);
                entity.CreatedAt = DateTime.Now;
                
                if (organizationId.HasValue)
                {
                    entity.OrganizationId = organizationId.Value;
                    _logger.LogInformation("[FutureExpenseRepository] Set OrganizationId={OrganizationId} on entity", organizationId.Value);
                }

                await _context.FutureExpenses.AddAsync(entity);
                await _context.SaveChangesAsync();
                _logger.LogInformation("[FutureExpenseRepository] FutureExpense saved with Id={Id}", entity.Id);

                var savedFutureExpense = await _context.FutureExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .FirstOrDefaultAsync(e => e.Id == entity.Id);

                if (savedFutureExpense == null)
                {
                    _logger.LogError("[FutureExpenseRepository] Failed to retrieve saved future expense with Id={Id}", entity.Id);
                    throw new Exception("Failed to retrieve saved future expense");
                }

                return _mapper.Map<LoadFutureExpenseDto>(savedFutureExpense);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FutureExpenseRepository] Error adding future expense: {Message}", ex.Message);
                throw;
            }
        }

        public async Task<bool> DeleteFutureExpense(long futureExpenseId)
        {
            try
            {
                var futureExpense = await _context.FutureExpenses.FindAsync(futureExpenseId);
                if (futureExpense == null)
                    return false;

                _context.FutureExpenses.Remove(futureExpense);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FutureExpenseRepository] Error deleting future expense {FutureExpenseId}", futureExpenseId);
                throw;
            }
        }

        public async Task<LoadFutureExpenseDto?> GetFutureExpenseById(long futureExpenseId)
        {
            try
            {
                var futureExpense = await _context.FutureExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .FirstOrDefaultAsync(e => e.Id == futureExpenseId);

                return futureExpense == null ? null : _mapper.Map<LoadFutureExpenseDto>(futureExpense);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FutureExpenseRepository] Error retrieving future expense {FutureExpenseId}", futureExpenseId);
                throw;
            }
        }

        public async Task<List<LoadFutureExpenseDto>> GetFutureExpensesByOrganizationId(long organizationId, long? propertyId = null)
        {
            try
            {
                var query = _context.FutureExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .Where(e => e.OrganizationId == organizationId && !e.Property.IsDeleted)
                    .AsQueryable();

                if (propertyId.HasValue)
                    query = query.Where(e => e.PropertyId == propertyId.Value);

                var futureExpenses = await query
                    .OrderBy(e => e.DueDate)
                    .ThenBy(e => e.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadFutureExpenseDto>>(futureExpenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FutureExpenseRepository] Error retrieving future expenses for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<List<LoadFutureExpenseDto>> GetFutureExpensesByLandlordId(long landlordId, long? propertyId = null)
        {
            try
            {
                var query = _context.FutureExpenses
                    .Include(e => e.Property)
                    .Include(e => e.Unit)
                    .Include(e => e.VendorEntity)
                    .Where(e => e.LandlordId == landlordId && !e.Property.IsDeleted)
                    .AsQueryable();

                if (propertyId.HasValue)
                    query = query.Where(e => e.PropertyId == propertyId.Value);

                var futureExpenses = await query
                    .OrderBy(e => e.DueDate)
                    .ThenBy(e => e.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadFutureExpenseDto>>(futureExpenses);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[FutureExpenseRepository] Error retrieving future expenses for landlord {LandlordId}", landlordId);
                throw;
            }
        }
    }
}
