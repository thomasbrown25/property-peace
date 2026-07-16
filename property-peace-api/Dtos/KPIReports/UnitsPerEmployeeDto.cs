namespace brownstone_hub_api.Dtos.KPIReports
{
    public class UnitsPerEmployeeDto
    {
        public decimal UnitsPerEmployee { get; set; }
        public int TotalUnits { get; set; }
        public int TotalEmployees { get; set; }
        public List<EmployeePerformanceDto>? EmployeePerformance { get; set; }
    }

    public class EmployeePerformanceDto
    {
        public long EmployeeId { get; set; }
        public string EmployeeName { get; set; } = string.Empty;
        public int UnitsManaged { get; set; }
    }
}
