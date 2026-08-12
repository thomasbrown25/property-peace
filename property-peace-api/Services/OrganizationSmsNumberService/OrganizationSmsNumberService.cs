using brownstone_hub_api.Dtos.OrganizationSmsNumber;
using brownstone_hub_api.Entitlements.Decision;
using brownstone_hub_api.Entitlements.Policy;
using brownstone_hub_api.Models;
using brownstone_hub_api.Repositories.OrganizationSmsNumbers;
using System.Globalization;

namespace brownstone_hub_api.Services.OrganizationSmsNumberService
{
    public interface IOrganizationSmsNumberService
    {
        Task<OrganizationSmsNumberStatusDto> GetStatusAsync();
        Task<List<SmsAreaCodeDto>> GetAreaCodesAsync(string state);
        Task<List<AvailableSmsNumberDto>> SearchAsync(SearchSmsNumbersRequestDto request, CancellationToken cancellationToken = default);
        Task<OrganizationSmsNumberStatusDto> PurchaseAsync(PurchaseSmsNumberDto request, string smsWebhookUrl, CancellationToken cancellationToken = default);
        Task<OrganizationSmsNumberStatusDto> RefreshStatusAsync(long id, CancellationToken cancellationToken = default);
    }

    public class OrganizationSmsNumberService(
        IOrganizationSmsNumberRepository smsNumberRepository,
        IHttpContextAccessor httpContextAccessor,
        IEntitlementDecisionService entitlementDecisionService,
        ITwilioPhoneNumberService twilioPhoneNumberService) : IOrganizationSmsNumberService
    {
        private readonly IOrganizationSmsNumberRepository _smsNumberRepository = smsNumberRepository;
        private readonly IHttpContextAccessor _httpContextAccessor = httpContextAccessor;
        private readonly IEntitlementDecisionService _entitlementDecisionService = entitlementDecisionService;
        private readonly ITwilioPhoneNumberService _twilioPhoneNumberService = twilioPhoneNumberService;

        public async Task<OrganizationSmsNumberStatusDto> GetStatusAsync()
        {
            var (userId, orgId) = GetCurrentContext();
            var hasPremiumAccess = await HasSetupEntitlementAsync(userId, orgId);
            var activeNumber = await _smsNumberRepository.GetActivePrimaryAsync(orgId);
            return MapStatus(activeNumber, hasPremiumAccess);
        }

        public Task<List<SmsAreaCodeDto>> GetAreaCodesAsync(string state)
        {
            state = (state ?? string.Empty).Trim().ToUpperInvariant();
            var codes = UsAreaCodes
                .Where(x => string.Equals(x.State, state, StringComparison.OrdinalIgnoreCase))
                .OrderBy(x => x.AreaCode)
                .Select(x => new SmsAreaCodeDto { State = x.State, AreaCode = x.AreaCode })
                .ToList();
            return Task.FromResult(codes);
        }

        public async Task<List<AvailableSmsNumberDto>> SearchAsync(SearchSmsNumbersRequestDto request, CancellationToken cancellationToken = default)
        {
            var (userId, orgId) = GetCurrentContext();
            if (!await HasSetupEntitlementAsync(userId, orgId, cancellationToken))
            {
                throw new UnauthorizedAccessException("Dedicated SMS numbers are included with eligible Premium and Lifetime organizations.");
            }

            ValidateStateAndAreaCode(request.State, request.AreaCode);
            return await _twilioPhoneNumberService.SearchLocalNumbersAsync(request.State.Trim().ToUpperInvariant(), request.AreaCode.Trim(), cancellationToken);
        }

        public async Task<OrganizationSmsNumberStatusDto> PurchaseAsync(PurchaseSmsNumberDto request, string smsWebhookUrl, CancellationToken cancellationToken = default)
        {
            var (userId, orgId) = GetCurrentContext();
            var hasPremiumAccess = await HasSetupEntitlementAsync(userId, orgId);
            if (!hasPremiumAccess)
            {
                throw new UnauthorizedAccessException("Dedicated SMS numbers are included with eligible Premium and Lifetime organizations.");
            }

            ValidateStateAndAreaCode(request.State, request.AreaCode);

            var existing = await _smsNumberRepository.GetActivePrimaryAsync(orgId);
            if (existing != null)
            {
                throw new InvalidOperationException("This organization already has an active dedicated SMS number.");
            }

            var twilioFriendlyName = $"Property Peace Org {orgId} User {userId}";
            var purchased = await _twilioPhoneNumberService.PurchaseNumberAsync(request.PhoneNumber, smsWebhookUrl, twilioFriendlyName, cancellationToken);
            var entity = new OrganizationSmsNumber
            {
                OrganizationId = orgId,
                PurchasedByUserId = userId,
                PhoneNumber = purchased.PhoneNumber,
                TwilioPhoneNumberSid = purchased.Sid,
                FriendlyName = purchased.FriendlyName,
                State = request.State.Trim().ToUpperInvariant(),
                AreaCode = request.AreaCode.Trim(),
                Status = string.IsNullOrWhiteSpace(purchased.Status) ? "Active" : purchased.Status,
                IsActive = true,
                IsPrimary = true,
                PurchasedAt = DateTime.UtcNow
            };

            await _smsNumberRepository.AddAsync(entity);
            return MapStatus(entity, hasPremiumAccess);
        }

        public async Task<OrganizationSmsNumberStatusDto> RefreshStatusAsync(long id, CancellationToken cancellationToken = default)
        {
            var (userId, orgId) = GetCurrentContext();
            bool hasPremiumAccess;
            try
            {
                hasPremiumAccess = await HasSetupEntitlementAsync(userId, orgId, cancellationToken);
            }
            catch (Exception)
            {
                hasPremiumAccess = false;
            }

            if (!hasPremiumAccess)
            {
                throw new UnauthorizedAccessException("Dedicated SMS numbers are included with eligible Premium and Lifetime organizations.");
            }

            var number = await _smsNumberRepository.GetActivePrimaryAsync(orgId);
            if (number == null || number.Id != id)
            {
                throw new KeyNotFoundException("Dedicated SMS number was not found for this organization.");
            }

            var status = await _twilioPhoneNumberService.GetPhoneNumberStatusAsync(number.TwilioPhoneNumberSid, cancellationToken);
            if (!string.IsNullOrWhiteSpace(status) && !string.Equals(number.Status, status, StringComparison.OrdinalIgnoreCase))
            {
                number.Status = status;
                await _smsNumberRepository.UpdateAsync(number);
            }

            return MapStatus(number, hasPremiumAccess);
        }

        private (long UserId, long OrganizationId) GetCurrentContext()
        {
            var context = _httpContextAccessor.HttpContext ?? throw new UnauthorizedAccessException("User is not authenticated.");
            if (!TryGetPositiveId(context.Items["UserId"], out var userId))
                throw new UnauthorizedAccessException("User is not authenticated.");
            if (!TryGetPositiveId(context.Items["OrganizationId"], out var orgId))
                throw new InvalidOperationException("No active organization selected.");
            return (userId, orgId);
        }

        private async Task<bool> HasSetupEntitlementAsync(long userId, long organizationId, CancellationToken cancellationToken = default)
        {
            var decision = await _entitlementDecisionService.DecideAsync(
                new EntitlementDecisionRequest(
                    userId.ToString(CultureInfo.InvariantCulture),
                    organizationId,
                    FeatureKeys.DedicatedSmsNumberSetup),
                cancellationToken);
            return decision.IsAllowed;
        }

        private static bool TryGetPositiveId(object? value, out long id)
        {
            id = value switch { long longValue => longValue, int intValue => intValue, _ => 0 };
            return id > 0;
        }

        private static OrganizationSmsNumberStatusDto MapStatus(OrganizationSmsNumber? number, bool hasPremiumAccess)
        {
            return new OrganizationSmsNumberStatusDto
            {
                HasPremiumAccess = hasPremiumAccess,
                HasActiveNumber = number?.IsActive == true,
                Id = number?.Id,
                PhoneNumber = number?.PhoneNumber,
                FriendlyName = number?.FriendlyName,
                State = number?.State,
                AreaCode = number?.AreaCode,
                Status = number?.Status
            };
        }

        private static void ValidateStateAndAreaCode(string state, string areaCode)
        {
            if (string.IsNullOrWhiteSpace(state) || state.Trim().Length != 2)
                throw new ArgumentException("State must be a 2-letter state code.");
            if (string.IsNullOrWhiteSpace(areaCode) || areaCode.Trim().Length != 3 || !areaCode.Trim().All(char.IsDigit))
                throw new ArgumentException("Area code must be exactly 3 digits.");
        }

        private static readonly (string State, string AreaCode)[] UsAreaCodes =
        [
            ("AL", "205"), ("AL", "251"), ("AL", "256"), ("AL", "334"), ("AL", "938"),
            ("AK", "907"), ("AZ", "480"), ("AZ", "520"), ("AZ", "602"), ("AZ", "623"), ("AZ", "928"),
            ("AR", "479"), ("AR", "501"), ("AR", "870"),
            ("CA", "209"), ("CA", "213"), ("CA", "310"), ("CA", "323"), ("CA", "408"), ("CA", "415"), ("CA", "510"), ("CA", "530"), ("CA", "559"), ("CA", "562"), ("CA", "619"), ("CA", "626"), ("CA", "650"), ("CA", "661"), ("CA", "707"), ("CA", "714"), ("CA", "760"), ("CA", "805"), ("CA", "818"), ("CA", "831"), ("CA", "858"), ("CA", "909"), ("CA", "916"), ("CA", "925"), ("CA", "949"),
            ("CO", "303"), ("CO", "719"), ("CO", "720"), ("CO", "970"),
            ("CT", "203"), ("CT", "475"), ("CT", "860"), ("CT", "959"),
            ("DC", "202"), ("DE", "302"),
            ("FL", "305"), ("FL", "321"), ("FL", "352"), ("FL", "386"), ("FL", "407"), ("FL", "561"), ("FL", "727"), ("FL", "754"), ("FL", "772"), ("FL", "786"), ("FL", "813"), ("FL", "850"), ("FL", "863"), ("FL", "904"), ("FL", "941"), ("FL", "954"),
            ("GA", "229"), ("GA", "404"), ("GA", "470"), ("GA", "478"), ("GA", "678"), ("GA", "706"), ("GA", "770"), ("GA", "912"),
            ("HI", "808"), ("ID", "208"), ("ID", "986"),
            ("IL", "217"), ("IL", "224"), ("IL", "309"), ("IL", "312"), ("IL", "331"), ("IL", "618"), ("IL", "630"), ("IL", "708"), ("IL", "773"), ("IL", "815"), ("IL", "847"),
            ("IN", "219"), ("IN", "260"), ("IN", "317"), ("IN", "463"), ("IN", "574"), ("IN", "765"), ("IN", "812"), ("IN", "930"),
            ("IA", "319"), ("IA", "515"), ("IA", "563"), ("IA", "641"), ("IA", "712"),
            ("KS", "316"), ("KS", "620"), ("KS", "785"), ("KS", "913"),
            ("KY", "270"), ("KY", "364"), ("KY", "502"), ("KY", "606"), ("KY", "859"),
            ("LA", "225"), ("LA", "318"), ("LA", "337"), ("LA", "504"), ("LA", "985"),
            ("ME", "207"), ("MD", "240"), ("MD", "301"), ("MD", "410"), ("MD", "443"),
            ("MA", "339"), ("MA", "351"), ("MA", "413"), ("MA", "508"), ("MA", "617"), ("MA", "774"), ("MA", "781"), ("MA", "857"), ("MA", "978"),
            ("MI", "231"), ("MI", "248"), ("MI", "269"), ("MI", "313"), ("MI", "517"), ("MI", "586"), ("MI", "616"), ("MI", "734"), ("MI", "810"), ("MI", "906"), ("MI", "947"), ("MI", "989"),
            ("MN", "218"), ("MN", "320"), ("MN", "507"), ("MN", "612"), ("MN", "651"), ("MN", "763"), ("MN", "952"),
            ("MS", "228"), ("MS", "601"), ("MS", "662"), ("MS", "769"),
            ("MO", "314"), ("MO", "417"), ("MO", "573"), ("MO", "636"), ("MO", "660"), ("MO", "816"),
            ("MT", "406"), ("NE", "308"), ("NE", "402"), ("NE", "531"), ("NV", "702"), ("NV", "775"),
            ("NH", "603"),
            ("NJ", "201"), ("NJ", "551"), ("NJ", "609"), ("NJ", "640"), ("NJ", "732"), ("NJ", "848"), ("NJ", "856"), ("NJ", "862"), ("NJ", "908"), ("NJ", "973"),
            ("NM", "505"), ("NM", "575"),
            ("NY", "212"), ("NY", "315"), ("NY", "332"), ("NY", "347"), ("NY", "516"), ("NY", "518"), ("NY", "585"), ("NY", "607"), ("NY", "631"), ("NY", "646"), ("NY", "680"), ("NY", "716"), ("NY", "718"), ("NY", "845"), ("NY", "914"), ("NY", "917"), ("NY", "929"), ("NY", "934"),
            ("NC", "252"), ("NC", "336"), ("NC", "704"), ("NC", "743"), ("NC", "828"), ("NC", "910"), ("NC", "919"), ("NC", "980"), ("NC", "984"),
            ("ND", "701"),
            ("OH", "216"), ("OH", "234"), ("OH", "330"), ("OH", "380"), ("OH", "419"), ("OH", "440"), ("OH", "513"), ("OH", "567"), ("OH", "614"), ("OH", "740"), ("OH", "937"),
            ("OK", "405"), ("OK", "539"), ("OK", "580"), ("OK", "918"),
            ("OR", "458"), ("OR", "503"), ("OR", "541"), ("OR", "971"),
            ("PA", "215"), ("PA", "267"), ("PA", "272"), ("PA", "412"), ("PA", "445"), ("PA", "484"), ("PA", "570"), ("PA", "610"), ("PA", "717"), ("PA", "724"), ("PA", "814"), ("PA", "878"),
            ("RI", "401"),
            ("SC", "803"), ("SC", "843"), ("SC", "854"), ("SC", "864"),
            ("SD", "605"),
            ("TN", "423"), ("TN", "615"), ("TN", "629"), ("TN", "731"), ("TN", "865"), ("TN", "901"), ("TN", "931"),
            ("TX", "210"), ("TX", "214"), ("TX", "254"), ("TX", "281"), ("TX", "325"), ("TX", "346"), ("TX", "361"), ("TX", "409"), ("TX", "430"), ("TX", "432"), ("TX", "469"), ("TX", "512"), ("TX", "682"), ("TX", "713"), ("TX", "737"), ("TX", "806"), ("TX", "817"), ("TX", "830"), ("TX", "832"), ("TX", "903"), ("TX", "915"), ("TX", "936"), ("TX", "940"), ("TX", "956"), ("TX", "972"), ("TX", "979"),
            ("UT", "385"), ("UT", "435"), ("UT", "801"), ("VT", "802"),
            ("VA", "276"), ("VA", "434"), ("VA", "540"), ("VA", "571"), ("VA", "703"), ("VA", "757"), ("VA", "804"),
            ("WA", "206"), ("WA", "253"), ("WA", "360"), ("WA", "425"), ("WA", "509"), ("WA", "564"),
            ("WV", "304"), ("WV", "681"),
            ("WI", "262"), ("WI", "414"), ("WI", "534"), ("WI", "608"), ("WI", "715"), ("WI", "920"),
            ("WY", "307")
        ];
    }
}
