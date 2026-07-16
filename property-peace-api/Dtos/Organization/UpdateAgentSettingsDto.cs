namespace brownstone_hub_api.Dtos.Organization
{
    public class UpdateAgentSettingsDto
    {
        public bool IsMaintenanceAgentEnabled { get; set; }
        public bool IsCollectionsAgentEnabled { get; set; }
    }
}
