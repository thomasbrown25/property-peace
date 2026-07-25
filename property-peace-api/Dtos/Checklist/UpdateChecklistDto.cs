namespace brownstone_hub_api.Dtos.Checklist
{
    public class UpdateChecklistDto
    {
        public long Id { get; set; }
        public string? Title { get; set; }
        public long? LeaseId { get; set; }
        public long? CounterpartChecklistId { get; set; }
        public DateTime? InspectionDate { get; set; }
        public DateTime? CompletedAt { get; set; }
        public bool? IsCompleted { get; set; }
        public long? ConductedBy { get; set; }
        public string? TenantSignature { get; set; }
        public string? LandlordSignature { get; set; }
        public DateTime? TenantSignedAt { get; set; }
        public DateTime? LandlordSignedAt { get; set; }
        public string? GeneralNotes { get; set; }
        public string? ConditionNotes { get; set; }
        public List<string>? RoomNames { get; set; }
        public List<string>? BeforeMoveInImagesBlobNames { get; set; }
        public List<string>? BeforeMoveInImagesUrls { get; set; }
        public List<string>? AfterMoveOutImagesBlobNames { get; set; }
        public List<string>? AfterMoveOutImagesUrls { get; set; }
        public List<UpdateChecklistItemDto>? Items { get; set; }
    }
}

