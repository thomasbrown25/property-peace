
namespace brownstone_hub_api.Models
{
    public class Role
    {
        public long Id { get; set; }
        public string RoleName { get; set; } = string.Empty;

        public ICollection<UserRole> UserRoles { get; set; } = [];
    }
}