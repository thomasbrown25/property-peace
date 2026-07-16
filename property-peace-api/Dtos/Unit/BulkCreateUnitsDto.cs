namespace brownstone_hub_api.Dtos.Unit
{
    public class BulkCreateUnitsDto
    {
        public long PropertyId { get; set; }
        public List<UpdateUnitDto> Units { get; set; } = [];
    }
}

