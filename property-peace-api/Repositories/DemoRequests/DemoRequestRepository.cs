using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.DemoRequest;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.DemoRequests
{
    public class DemoRequestRepository(DataContext context, IMapper mapper, ILogger<DemoRequestRepository> logger) : IDemoRequestRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<DemoRequestRepository> _logger = logger;

        public async Task<LoadDemoRequestDto> AddDemoRequest(AddDemoRequestDto demoRequest)
        {
            try
            {
                var newRequest = _mapper.Map<Models.DemoRequest>(demoRequest);
                newRequest.CreatedAt = DateTime.UtcNow;

                await _context.DemoRequests.AddAsync(newRequest);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Demo request {RequestId} created for {Email}", newRequest.Id, newRequest.Email);

                var result = await _context.DemoRequests
                    .FirstOrDefaultAsync(dr => dr.Id == newRequest.Id);

                return _mapper.Map<LoadDemoRequestDto>(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding demo request");
                throw new Exception("Error adding demo request", ex);
            }
        }

        public async Task<LoadDemoRequestDto?> GetDemoRequestById(long id)
        {
            try
            {
                var demoRequest = await _context.DemoRequests
                    .FirstOrDefaultAsync(dr => dr.Id == id);

                if (demoRequest == null)
                    return null;

                return _mapper.Map<LoadDemoRequestDto>(demoRequest);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting demo request {RequestId}", id);
                throw new Exception($"Error getting demo request {id}", ex);
            }
        }

        public async Task<List<LoadDemoRequestDto>> GetAllDemoRequests()
        {
            try
            {
                var demoRequests = await _context.DemoRequests
                    .OrderByDescending(dr => dr.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadDemoRequestDto>>(demoRequests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting all demo requests");
                throw new Exception("Error getting all demo requests", ex);
            }
        }

        public async Task<List<LoadDemoRequestDto>> GetDemoRequestsByDateRange(DateTime? startDate, DateTime? endDate)
        {
            try
            {
                var query = _context.DemoRequests.AsQueryable();

                if (startDate.HasValue)
                {
                    query = query.Where(dr => dr.CreatedAt >= startDate.Value);
                }

                if (endDate.HasValue)
                {
                    query = query.Where(dr => dr.CreatedAt <= endDate.Value);
                }

                var demoRequests = await query
                    .OrderByDescending(dr => dr.CreatedAt)
                    .ToListAsync();

                return _mapper.Map<List<LoadDemoRequestDto>>(demoRequests);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting demo requests by date range");
                throw new Exception("Error getting demo requests by date range", ex);
            }
        }

        public async Task<LoadDemoRequestDto?> UpdateDemoRequest(long id, string? calendlyEventUri, DateTime? scheduledDateTime, string? calendlyInviteeUri)
        {
            try
            {
                var demoRequest = await _context.DemoRequests
                    .FirstOrDefaultAsync(dr => dr.Id == id);

                if (demoRequest == null)
                    return null;

                if (!string.IsNullOrEmpty(calendlyEventUri))
                    demoRequest.CalendlyEventUri = calendlyEventUri;
                
                if (scheduledDateTime.HasValue)
                    demoRequest.ScheduledDateTime = scheduledDateTime.Value;
                
                if (!string.IsNullOrEmpty(calendlyInviteeUri))
                    demoRequest.CalendlyInviteeUri = calendlyInviteeUri;

                await _context.SaveChangesAsync();

                return _mapper.Map<LoadDemoRequestDto>(demoRequest);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating demo request {RequestId}", id);
                throw new Exception($"Error updating demo request {id}", ex);
            }
        }
    }
}
