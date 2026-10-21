using System.ComponentModel.DataAnnotations;

namespace brownstone_hub_api.Models;

[AttributeUsage(AttributeTargets.Property)]
public sealed class IanaTimeZoneAttribute : ValidationAttribute
{
    public static bool IsValidZone(string? id) =>
        !string.IsNullOrWhiteSpace(id) &&
        (id == "UTC" || id.Contains('/') && !id.Contains('\\')) &&
        TimeZoneInfo.TryFindSystemTimeZoneById(id, out _);

    // Older properties have no zone; drafts require one before configuring nightly inventory.
    public override bool IsValid(object? value) => value is null || value is string id && IsValidZone(id);
}
