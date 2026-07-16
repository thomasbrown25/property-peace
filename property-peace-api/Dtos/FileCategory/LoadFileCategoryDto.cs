namespace brownstone_hub_api.Dtos.FileCategory
{
    public class LoadFileCategoryDto
    {
        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public long OrganizationId { get; set; }
        public int FileCount { get; set; } // Number of files in this category
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
}

