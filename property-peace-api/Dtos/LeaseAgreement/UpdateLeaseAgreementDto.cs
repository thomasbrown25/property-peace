using brownstone_hub_api.Dtos.Lease;
using System.Text.Json.Serialization;

namespace brownstone_hub_api.Dtos.LeaseAgreement
{
    // Deliberately not derived from UpdateLeaseDto: no location, term, money, or people writes.
    [JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
    public class UpdateLeaseAgreementDto
    {
        public bool? IsLeaseSpecificsComplete { get; set; }
        public bool? IsRentDepositFeesComplete { get; set; }
        public bool? IsPeopleOnLeaseComplete { get; set; }
        public bool? IsPetsSmokingOtherComplete { get; set; }
        public bool? IsUtilitiesMaintenanceKeysComplete { get; set; }
        public bool? IsProvisionsAttachmentsComplete { get; set; }

        public bool? PetsAllowed { get; set; }
        public string? SmokingAllowed { get; set; }
        public List<PetDto>? Pets { get; set; }
        public ParkingDto? Parking { get; set; }
        public bool? HasSharedUtilities { get; set; }
        public string? SharedUtilitiesDisclosure { get; set; }
        public string? MaintenanceNotificationMethods { get; set; }
        public List<UtilityServiceResponsibilityDto>? UtilityServiceResponsibilities { get; set; }
        public List<MaintenanceResponsibilityDto>? MaintenanceResponsibilities { get; set; }
        public List<LeaseKeyDto>? LeaseKeys { get; set; }
        public bool? IncludeEarlyTerminationClause { get; set; }
        public string? EarlyTerminationClauseText { get; set; }
        public string? AdditionalTerms { get; set; }
        public bool? BuiltBefore1978 { get; set; }
        public bool? AwareOfLeadPaint { get; set; }
        public string? LeadPaintExplanation { get; set; }
        public bool? HasLeadPaintRecords { get; set; }
        public string? LeadPaintRecordsExplanation { get; set; }
    }
}
