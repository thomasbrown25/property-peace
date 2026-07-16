namespace brownstone_hub_api.Models
{
    /// <summary>Predefined property/building features (Gym, Pool, Elevator, etc.). Table does not change.</summary>
    public class DefaultFeature
    {
        public long Id { get; set; }
        public string Name { get; set; } = "";
    }
}
