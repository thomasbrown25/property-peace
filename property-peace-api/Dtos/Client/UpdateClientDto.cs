namespace brownstone_hub_api.Dtos.Client
{
    public class UpdateClientDto
    {
        public long Id { get; set; }
        public long TrainerId { get; set; } = 0;
        public string Email { get; set; } = string.Empty;
    }
}