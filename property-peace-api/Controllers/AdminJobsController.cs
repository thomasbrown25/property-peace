using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using brownstone_hub_api.Repositories.JobRunHistories;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.StateLawSources;
using brownstone_hub_api.Repositories.StateDepositLaws;
using brownstone_hub_api.Repositories.StateLateFeeLaws;
using brownstone_hub_api.Services.JobRunnerService;

namespace brownstone_hub_api.Controllers
{
    [ApiController]
    [Route("api/admin/jobs")]
    [Authorize(Roles = "Admin")]
    public class AdminJobsController : ControllerBase
    {
        private static readonly string[] AllStateCodes = new[]
        {
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
            "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
            "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
            "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
            "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC"
        };

        private readonly IJobRunnerService _jobRunnerService;
        private readonly IJobRunHistoryRepository _historyRepository;
        private readonly ILeaseRepository _leaseRepository;
        private readonly IStateLawSourceRepository _stateLawSourceRepository;
        private readonly IStateDepositLawRepository _stateDepositLawRepository;
        private readonly IStateLateFeeLawRepository _stateLateFeeLawRepository;
        private readonly ILogger<AdminJobsController> _logger;

        public AdminJobsController(
            IJobRunnerService jobRunnerService,
            IJobRunHistoryRepository historyRepository,
            ILeaseRepository leaseRepository,
            IStateLawSourceRepository stateLawSourceRepository,
            IStateDepositLawRepository stateDepositLawRepository,
            IStateLateFeeLawRepository stateLateFeeLawRepository,
            ILogger<AdminJobsController> logger)
        {
            _jobRunnerService = jobRunnerService;
            _historyRepository = historyRepository;
            _leaseRepository = leaseRepository;
            _stateLawSourceRepository = stateLawSourceRepository;
            _stateDepositLawRepository = stateDepositLawRepository;
            _stateLateFeeLawRepository = stateLateFeeLawRepository;
            _logger = logger;
        }

        [HttpGet]
        public IActionResult GetJobs()
        {
            var jobs = _jobRunnerService.GetJobDefinitions();
            return Ok(new { success = true, data = jobs.Select(j => new { id = j.Id, name = j.Name }).ToList() });
        }

        [HttpPost("run")]
        public async Task<IActionResult> RunJob([FromBody] RunJobRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.JobId))
                return BadRequest(new { success = false, message = "JobId is required" });

            var (success, error) = await _jobRunnerService.RunJobAsync(request.JobId, request.LeaseId);
            if (success)
                return Ok(new { success = true, message = "Job completed successfully" });
            return BadRequest(new { success = false, message = error ?? "Job failed" });
        }

        [HttpGet("leases")]
        public async Task<IActionResult> GetLeases()
        {
            var list = await _leaseRepository.GetLeasesForAdminListAsync();
            return Ok(new { success = true, data = list.Select(l => new { id = l.Id, label = l.Label }).ToList() });
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetHistory([FromQuery] int limit = 100)
        {
            var history = await _historyRepository.GetHistoryAsync(Math.Min(limit, 200));
            var data = history.Select(h => new
            {
                id = h.Id,
                jobId = h.JobId,
                jobName = h.JobName,
                startedAt = h.StartedAt,
                completedAt = h.CompletedAt,
                status = h.Status,
                message = h.Message
            }).ToList();
            return Ok(new { success = true, data });
        }

        [HttpGet("state-law-sources")]
        public async Task<IActionResult> GetStateLawSources()
        {
            var fromDb = await _stateLawSourceRepository.GetAllAsync();
            var dict = fromDb.ToDictionary(x => x.State, StringComparer.OrdinalIgnoreCase);
            var data = AllStateCodes.OrderBy(s => s).Select(state =>
            {
                var row = dict.TryGetValue(state, out var r) ? r : null;
                return new
                {
                    state,
                    lateFeeUrl = row?.LateFeeUrl,
                    securityDepositUrl = row?.SecurityDepositUrl,
                    updatedAt = row?.UpdatedAt
                };
            }).ToList();
            return Ok(new { success = true, data });
        }

        [HttpPut("state-law-sources")]
        public async Task<IActionResult> UpdateStateLawSource([FromBody] UpdateStateLawSourceRequest request)
        {
            if (string.IsNullOrWhiteSpace(request?.State))
                return BadRequest(new { success = false, message = "State is required" });
            var state = request.State.ToUpperInvariant();
            if (!AllStateCodes.Contains(state))
                return BadRequest(new { success = false, message = "Invalid state code" });
            var updated = await _stateLawSourceRepository.UpsertAsync(state, request.LateFeeUrl, request.SecurityDepositUrl);
            return Ok(new
            {
                success = true,
                data = new
                {
                    state = updated.State,
                    lateFeeUrl = updated.LateFeeUrl,
                    securityDepositUrl = updated.SecurityDepositUrl,
                    updatedAt = updated.UpdatedAt
                }
            });
        }

        [HttpGet("generated-laws")]
        public async Task<IActionResult> GetGeneratedLaws()
        {
            // Pull directly from lease.StateDepositLaws and lease.StateLateFeeLaws
            var depositLaws = await _stateDepositLawRepository.GetAllAsync();
            var lateFeeLaws = await _stateLateFeeLawRepository.GetAllAsync();
            return Ok(new
            {
                success = true,
                data = new
                {
                    depositLaws = depositLaws.OrderBy(x => x.State).Select(l => new
                    {
                        state = l.State,
                        bulletPointsText = l.BulletPointsText,
                        lastUpdated = l.LastUpdated,
                        lastUpdatedBy = l.LastUpdatedBy
                    }).ToList(),
                    lateFeeLaws = lateFeeLaws.OrderBy(x => x.State).Select(l => new
                    {
                        state = l.State,
                        gracePeriodDescription = l.GracePeriodDescription,
                        feeAmountDescription = l.FeeAmountDescription,
                        lastUpdated = l.LastUpdated,
                        lastUpdatedBy = l.LastUpdatedBy
                    }).ToList()
                }
            });
        }
    }

    public class RunJobRequest
    {
        public string? JobId { get; set; }
        /// <summary>Required for RentReminder job: the lease to run the rent reminder for.</summary>
        public long? LeaseId { get; set; }
    }

    public class UpdateStateLawSourceRequest
    {
        public string? State { get; set; }
        public string? LateFeeUrl { get; set; }
        public string? SecurityDepositUrl { get; set; }
    }
}
