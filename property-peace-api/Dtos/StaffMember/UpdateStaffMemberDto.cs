namespace brownstone_hub_api.Dtos.StaffMember
{
    public class UpdateStaffMemberDto
    {
        public long Id { get; set; }
        public string Role { get; set; } = string.Empty;
        public decimal? HourlyRate { get; set; }
        public bool IsActive { get; set; }
    }
}
