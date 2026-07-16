using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace brownstone_hub_api.Models
{
    public class TaxCategory
    {
        [Key]
        public long Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        /// <summary>
        /// IRS Schedule E line number (1-19)
        /// </summary>
        public int? ScheduleELineNumber { get; set; }

        /// <summary>
        /// Whether this category is fully deductible in the year incurred
        /// </summary>
        public bool IsFullyDeductible { get; set; } = true;

        /// <summary>
        /// Sort order for display
        /// </summary>
        public int SortOrder { get; set; } = 0;

        /// <summary>
        /// Corresponding enum value for backward compatibility
        /// </summary>
        public int? EnumValue { get; set; }

        // Standard audit fields
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        // Navigation
        public ICollection<Expense> Expenses { get; set; } = [];
    }
}
