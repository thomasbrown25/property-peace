namespace brownstone_hub_api.Dtos.MaintenanceRequest
{
    public class AssignMaintenanceRequestDto
    {
        public EAssignedToType AssignedToType { get; set; }

        /// <summary>
        /// Required when AssignedToType = Vendor
        /// </summary>
        public long? VendorId { get; set; }

        /// <summary>
        /// Used when AssignedToType = OneTimeContact
        /// </summary>
        public string? ContactName { get; set; }
        public string? ContactPhone { get; set; }
        public string? ContactEmail { get; set; }
        public string? ContactNotes { get; set; }

        /// <summary>
        /// When true and AssignedToType = OneTimeContact, persist contact as a new Vendor record
        /// </summary>
        public bool SaveAsVendor { get; set; } = false;
    }
}
