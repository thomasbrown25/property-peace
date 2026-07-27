using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.SupportAndFeedback;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/support-and-feedback")]
    [Authorize(Roles = "Admin")]
    public class SupportAndFeedbackController : ControllerBase
    {
        private readonly DataContext _context;
        private readonly ILogger<SupportAndFeedbackController> _logger;

        public SupportAndFeedbackController(
            DataContext context,
            ILogger<SupportAndFeedbackController> logger)
        {
            _context = context;
            _logger = logger;
        }

        /// <summary>
        /// Get all support and feedback requests (admin only)
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAllSupportAndFeedback(
            [FromQuery] ESupportAndFeedbackType? type = null,
            [FromQuery] bool? isResolved = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 50)
        {
            try
            {
                var query = _context.SupportAndFeedbacks
                    .Include(sf => sf.User)
                    .AsQueryable();

                // Filter by type if provided
                if (type.HasValue)
                {
                    query = query.Where(sf => sf.Type == type.Value);
                }

                // Filter by resolved status if provided
                if (isResolved.HasValue)
                {
                    query = query.Where(sf => sf.IsResolved == isResolved.Value);
                }

                // Filter by favorite if requested (check query param)
                var isFavoriteParam = Request.Query["isFavorite"].ToString();
                if (!string.IsNullOrEmpty(isFavoriteParam) && bool.TryParse(isFavoriteParam, out var isFavorite))
                {
                    query = query.Where(sf => sf.IsFavorite == isFavorite);
                }

                // Get total count for pagination
                var totalCount = await query.CountAsync();

                // Apply pagination
                var items = await query
                    .OrderByDescending(sf => sf.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(sf => new LoadSupportAndFeedbackDto
                    {
                        Id = sf.Id,
                        UserId = sf.UserId,
                        Type = sf.Type,
                        SubType = sf.SubType,
                        Subject = sf.Subject,
                        Message = sf.Message,
                        CreatedAt = sf.CreatedAt,
                        LastActivityAt = sf.LastActivityAt,
                        ResolvedAt = sf.ResolvedAt,
                        TicketNumber = sf.TicketNumber,
                        ConversationId = sf.ConversationId,
                        LastMessageBy = sf.ConversationId == null ? null : _context.Conversations
                            .Where(conversation => conversation.Id == sf.ConversationId)
                            .Select(conversation => conversation.LastMessageBy)
                            .FirstOrDefault(),
                        MessageCount = sf.ConversationId == null ? 1 : _context.Messages
                            .Count(message => message.ConversationId == sf.ConversationId && !message.IsDeleted),
                        IsResolved = sf.IsResolved,
                        IsFavorite = sf.IsFavorite
                    })
                    .ToListAsync();

                // Get user names for the items
                var userIds = items.Select(i => i.UserId).Distinct().ToList();
                var users = await _context.Users
                    .Where(u => userIds.Contains(u.Id))
                    .Select(u => new { u.Id, Name = $"{u.FirstName} {u.LastName}".Trim(), u.Email })
                    .ToListAsync();

                var userDict = users.ToDictionary(u => u.Id, u => new { u.Name, u.Email });

                // Enrich items with user information
                var enrichedItems = items.Select(item => new
                {
                    item.Id,
                    item.UserId,
                    UserName = userDict.ContainsKey(item.UserId) ? userDict[item.UserId].Name : "Unknown",
                    UserEmail = userDict.ContainsKey(item.UserId) ? userDict[item.UserId].Email : null,
                    Type = (int)item.Type, // Convert enum to int for consistent frontend handling
                    item.SubType,
                    item.Subject,
                    item.Message,
                    item.CreatedAt,
                    item.LastActivityAt,
                    item.ResolvedAt,
                    item.TicketNumber,
                    item.ConversationId,
                    item.LastMessageBy,
                    item.MessageCount,
                    CanReply = item.ConversationId != null,
                    item.IsResolved,
                    item.IsFavorite
                }).ToList();

                return Ok(new
                {
                    success = true,
                    data = enrichedItems,
                    pagination = new
                    {
                        page,
                        pageSize,
                        totalCount,
                        totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving support and feedback requests");
                return StatusCode(500, new { success = false, message = "An error occurred while retrieving support and feedback requests" });
            }
        }

        /// <summary>
        /// Get a single support and feedback request by ID (admin only)
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetSupportAndFeedbackById(long id)
        {
            try
            {
                var item = await _context.SupportAndFeedbacks
                    .Include(sf => sf.User)
                    .Where(sf => sf.Id == id)
                    .Select(sf => new
                    {
                        sf.Id,
                        sf.UserId,
                        UserName = $"{sf.User.FirstName} {sf.User.LastName}".Trim(),
                        UserEmail = sf.User.Email,
                        Type = (int)sf.Type, // Convert enum to int for consistent frontend handling
                        sf.SubType,
                        sf.Subject,
                        sf.Message,
                        sf.CreatedAt,
                        sf.LastActivityAt,
                        sf.ResolvedAt,
                        sf.TicketNumber,
                        sf.ConversationId,
                        sf.IsResolved,
                        sf.IsFavorite
                    })
                    .FirstOrDefaultAsync();

                if (item == null)
                {
                    return NotFound(new { success = false, message = "Support and feedback request not found" });
                }

                return Ok(new { success = true, data = item });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving support and feedback request {Id}", id);
                return StatusCode(500, new { success = false, message = "An error occurred while retrieving the support and feedback request" });
            }
        }

        /// <summary>
        /// Update the resolved status of a support and feedback request (admin only)
        /// </summary>
        [HttpPut("{id}/resolve")]
        public async Task<IActionResult> UpdateResolvedStatus(long id, [FromBody] bool isResolved)
        {
            try
            {
                var item = await _context.SupportAndFeedbacks.FindAsync(id);
                if (item == null)
                {
                    return NotFound(new { success = false, message = "Support and feedback request not found" });
                }

                item.IsResolved = isResolved;
                item.ResolvedAt = isResolved ? DateTime.UtcNow : null;
                item.LastActivityAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Support and feedback request {(isResolved ? "marked as resolved" : "marked as unresolved")}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating resolved status for support and feedback request {Id}", id);
                return StatusCode(500, new { success = false, message = "An error occurred while updating the support and feedback request" });
            }
        }

        /// <summary>
        /// Toggle the favorite status of a support and feedback request (admin only)
        /// </summary>
        [HttpPut("{id}/favorite")]
        public async Task<IActionResult> ToggleFavorite(long id, [FromBody] ToggleFavoriteDto dto)
        {
            try
            {
                var item = await _context.SupportAndFeedbacks.FindAsync(id);
                if (item == null)
                {
                    return NotFound(new { success = false, message = "Support and feedback request not found" });
                }

                item.IsFavorite = dto.IsFavorite;
                await _context.SaveChangesAsync();

                return Ok(new { success = true, message = $"Support and feedback request {(dto.IsFavorite ? "marked as favorite" : "removed from favorites")}" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating favorite status for support and feedback request {Id}", id);
                return StatusCode(500, new { success = false, message = "An error occurred while updating the support and feedback request" });
            }
        }
    }
}

