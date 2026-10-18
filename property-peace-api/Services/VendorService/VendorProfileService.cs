using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using brownstone_hub_api.Dtos.Vendor;
using brownstone_hub_api.Models;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Services.VendorService;

public partial class VendorService
{
    // Never construct UpdateVendorDto from the redacted read model: PUT replaces TaxId and flags.
    // PATCH only accepts editable profile strings, preserving every omitted/protected field.
    public async Task<ServiceResponse<LoadVendorDto>> PatchVendor(long vendorId, long organizationId, JsonElement changes)
    {
        if (changes.ValueKind != JsonValueKind.Object || !changes.EnumerateObject().Any())
            return ServiceResponse<LoadVendorDto>.CreateError("Invalid vendor changes", "A nonempty object is required", statusCode: 400);
        var vendor = await _db.Vendors.SingleOrDefaultAsync(v => v.Id == vendorId && v.OrganizationId == organizationId && !v.IsDeleted);
        if (vendor is null) return VendorNotFound<LoadVendorDto>();

        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var property in changes.EnumerateObject())
        {
            if (!seen.Add(property.Name) || property.Value.ValueKind is not (JsonValueKind.String or JsonValueKind.Null))
                return ServiceResponse<LoadVendorDto>.CreateError("Invalid vendor changes", "Duplicate fields or non-string values are not allowed", statusCode: 400);
            var value = property.Value.ValueKind == JsonValueKind.Null ? null : property.Value.GetString();
            var field = property.Name.ToLowerInvariant();
            var maxLength = field switch
            {
                "name" or "businessname" or "email" => 200,
                "description" => 1000,
                "phone" or "alternatephone" or "state" => 50,
                "address" or "specialties" => 500,
                "city" or "category" or "licensenumber" => 100,
                "zipcode" => 20,
                "notes" => 2000,
                _ => -1
            };
            if (maxLength < 0 || value?.Length > maxLength || field == "name" && string.IsNullOrWhiteSpace(value) ||
                field == "email" && value is not null && !new EmailAddressAttribute().IsValid(value))
                return ServiceResponse<LoadVendorDto>.CreateError("Invalid vendor changes", $"Invalid field: {property.Name}", statusCode: 400);
        }
        // Validate the entire payload before changing tracked data.
        foreach (var property in changes.EnumerateObject())
        {
            var value = property.Value.ValueKind == JsonValueKind.Null ? null : property.Value.GetString();
            switch (property.Name.ToLowerInvariant())
            {
                case "name": vendor.Name = value!; break;
                case "businessname": vendor.BusinessName = value; break;
                case "description": vendor.Description = value; break;
                case "email": vendor.Email = value; break;
                case "phone": vendor.Phone = value; break;
                case "alternatephone": vendor.AlternatePhone = value; break;
                case "address": vendor.Address = value; break;
                case "city": vendor.City = value; break;
                case "state": vendor.State = value; break;
                case "zipcode": vendor.ZipCode = value; break;
                case "licensenumber": vendor.LicenseNumber = value; break;
                case "category": vendor.Category = value; break;
                case "specialties": vendor.Specialties = value; break;
                case "notes": vendor.Notes = value; break;
            }
        }
        vendor.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        var result = await _vendorRepository.GetVendorById(vendorId);
        if (result is not null) await ApplyReadiness([result], organizationId);
        return ServiceResponse<LoadVendorDto>.CreateSuccess(result!, "Vendor updated successfully");
    }

    public async Task<ServiceResponse<List<VendorMaintenanceDto>>> GetVendorMaintenance(long vendorId, long organizationId)
    {
        if (!await _db.Vendors.AsNoTracking().AnyAsync(v => v.Id == vendorId && v.OrganizationId == organizationId && !v.IsDeleted))
            return VendorNotFound<List<VendorMaintenanceDto>>();

        // Activity rows preserve the vendor ID at assignment time, unlike the mutable request FK.
        var vendorMetadata = JsonSerializer.Serialize(new { vendorId });
        var events = await _db.MaintenanceActivityEvents.AsNoTracking()
            .Where(e => e.EventType == VendorAssignmentHistory.EventType && e.MetadataJson == vendorMetadata &&
                e.MaintenanceRequest.OrganizationId == organizationId)
            .Select(e => new { e.MaintenanceRequestId, e.OccurredAtUtc })
            .ToListAsync();
        var assignments = events.GroupBy(e => e.MaintenanceRequestId)
            .ToDictionary(g => g.Key, g => g.Max(e => e.OccurredAtUtc.UtcDateTime));

        var requestIds = assignments.Keys.ToList();
        var requests = await _db.MaintenanceRequests.AsNoTracking()
            .Where(r => r.OrganizationId == organizationId && (r.VendorId == vendorId || requestIds.Contains(r.Id)))
            .Select(r => new { r.Id, r.OrderNumber, r.Title, PropertyName = r.Property.Name,
                r.UnitName, r.Status, r.Priority, r.CreatedAt, r.AssignedAt, r.CompletedAt, r.VendorId, r.AssignedToType })
            .ToListAsync();
        var result = requests.Select(r =>
        {
            var current = r.VendorId == vendorId && r.AssignedToType == EAssignedToType.Vendor;
            return new VendorMaintenanceDto(r.Id, r.OrderNumber, r.Title, r.PropertyName,
                r.UnitName, r.Status.ToString(), r.Priority.ToString(), r.CreatedAt,
                current ? r.AssignedAt : assignments.GetValueOrDefault(r.Id), r.CompletedAt,
                current, !current && r.AssignedToType != EAssignedToType.Unassigned);
        }).OrderByDescending(r => r.AssignedAt ?? r.CreatedAt).ToList();
        return ServiceResponse<List<VendorMaintenanceDto>>.CreateSuccess(result, "Vendor maintenance retrieved successfully");
    }
}
