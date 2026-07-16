
namespace brownstone_hub_api.Dtos.Organization
{
    public class UpdateOrganizationDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}

