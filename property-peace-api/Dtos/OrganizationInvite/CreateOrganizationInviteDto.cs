
namespace brownstone_hub_api.Dtos.OrganizationInvite
{
    public class CreateOrganizationInviteDto
    {
        public long OrganizationId { get; set; }
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = "Viewer";
    }
}

