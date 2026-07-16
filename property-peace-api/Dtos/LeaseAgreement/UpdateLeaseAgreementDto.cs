namespace brownstone_hub_api.Dtos.LeaseAgreement
{
    public class UpdateLeaseAgreementDto
    {
        // Builder step completion — any combination can be updated in one call
        public bool? IsLeaseSpecificsComplete { get; set; }
        public bool? IsRentDepositFeesComplete { get; set; }
        public bool? IsPeopleOnLeaseComplete { get; set; }
        public bool? IsPetsSmokingOtherComplete { get; set; }
        public bool? IsUtilitiesMaintenanceKeysComplete { get; set; }
        public bool? IsProvisionsAttachmentsComplete { get; set; }
    }
}
