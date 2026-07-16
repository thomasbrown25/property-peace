
using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Admin;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Models;
using brownstone_hub_api.Utils;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Leases
{
    public class LeaseRepository(DataContext context, ILogger<LeaseRepository> logger, IMapper mapper) : ILeaseRepository
    {
        private readonly DataContext _context = context;
        private readonly ILogger<LeaseRepository> _logger = logger;
        private readonly IMapper _mapper = mapper;

        /// <summary>
        /// Extracts just the street address (street number + route) from a full address string.
        /// Removes city, state, and zip code.
        /// </summary>
        private string ExtractStreetAddressOnly(string? fullAddress)
        {
            if (string.IsNullOrWhiteSpace(fullAddress))
                return string.Empty;

            // Split by comma to separate address components
            var parts = fullAddress.Split(',');
            
            // The first part is typically the street address (street number + route)
            // Remove any trailing/leading whitespace
            var streetAddress = parts[0].Trim();
            
            return streetAddress;
        }

        public async Task<LoadLeaseDto> AddLease(UpdateLeaseDto lease, long? organizationId = null)
        {
            // Validate UnitId is provided and valid
            if (lease.UnitId <= 0)
            {
                throw new ArgumentException("UnitId is required and must be greater than 0");
            }

            // Verify the unit exists - explicitly exclude Lease to avoid loading deleted leases
            var unit = await _context.Units
                .Include(u => u.Property)
                .FirstOrDefaultAsync(u => u.Id == lease.UnitId);

            if (unit == null)
            {
                throw new KeyNotFoundException($"Unit with ID {lease.UnitId} not found");
            }

            // Check if unit already has an active lease. When adding new (Id == 0), only consider active leases so we can create a renewal after ending the previous lease.
            // Exclude the current lease if we're updating (lease.Id > 0)
            var existingLeaseForUnit = await _context.Leases
                .FirstOrDefaultAsync(l => l.UnitId == lease.UnitId && l.IsActive && (lease.Id == 0 || l.Id != lease.Id));

            if (existingLeaseForUnit != null)
            {
                throw new InvalidOperationException($"Unit {lease.UnitId} already has an active lease (ID: {existingLeaseForUnit.Id})");
            }

            // Explicitly clear the Unit's Lease navigation property if it's loaded
            // This prevents EF Core from thinking we're severing an existing relationship
            // when adding a new lease after a previous one was deleted
            if (_context.Entry(unit).Reference(u => u.Lease).IsLoaded)
            {
                var existingLease = unit.Lease;
                if (existingLease != null)
                {
                    // Clear the Unit's Lease navigation property to avoid relationship conflicts
                    // EF Core will establish the new relationship using the UnitId foreign key
                    _context.Entry(unit).Reference(u => u.Lease).CurrentValue = null;
                    
                    // If the existing lease is tracked, detach it to prevent conflicts
                    if (_context.Entry(existingLease).State != EntityState.Detached)
                    {
                        _context.Entry(existingLease).State = EntityState.Detached;
                    }
                }
            }

            var newLease = _mapper.Map<Lease>(lease);

            // Set only the UnitId foreign key - DO NOT set the Unit navigation property
            // Setting the navigation property causes EF Core to think we're reassigning
            // the Unit's Lease, which severs the existing relationship
            newLease.UnitId = lease.UnitId;
            
            // Handle nullable dates - use defaults if not provided
            if (!lease.StartDate.HasValue)
            {
                newLease.StartDate = DateTime.Now;
            }
            if (!lease.EndDate.HasValue)
            {
                newLease.EndDate = (newLease.StartDate ?? DateTime.Now).AddYears(1);
            }
            
            // Ensure IsActive is ALWAYS true for new leases (Id = 0)
            // IsActive should only be set to false when ending a lease via EndLease
            // This includes leases that haven't started yet (StartDate > today) - they should still be active
            if (lease.Id == 0)
            {
                newLease.IsActive = true; // Force IsActive = true for new leases
                // Set default values for nullable fields that database might require
                newLease.CustomDateSelected = lease.CustomDateSelected ?? false;
            }
            else
            {
                // For updates, use the value from the DTO
                newLease.IsActive = lease.IsActive;
                // For updates, preserve existing values if not provided
                newLease.CustomDateSelected = lease.CustomDateSelected;
            }

            // Set organizationId - prioritize DTO, then parameter, then get from property
            if (lease.OrganizationId.HasValue)
            {
                newLease.OrganizationId = lease.OrganizationId.Value;
            }
            else if (organizationId.HasValue)
            {
                newLease.OrganizationId = organizationId.Value;
            }
            else if (unit.Property?.OrganizationId != null)
            {
                newLease.OrganizationId = unit.Property.OrganizationId;
            }

            // Auto-generate lease name if not provided
            if (string.IsNullOrWhiteSpace(newLease.Name) && unit.Property != null)
            {
                // Extract just the street address (no city/state/zip)
                var streetAddress = ExtractStreetAddressOnly(unit.Property.StreetAddress ?? unit.Property.Name ?? "");
                var startDate = newLease.StartDate ?? DateTime.Now;
                var monthYear = startDate.ToString("MMMM yyyy");
                newLease.Name = $"{streetAddress} - {monthYear}";
            }

            await _context.Leases.AddAsync(newLease);
            await _context.SaveChangesAsync();

            // Link only tenants already assigned to this unit (UnitId set). Imported/new tenants (UnitId null) stay org-only until the user assigns them.
            var tenantsToLink = await _context.Tenants
                .Where(t => t.UnitId == lease.UnitId && 
                           !t.IsDeleted &&
                           !t.TenantLeases.Any(tl => tl.LeaseId == newLease.Id))
                .ToListAsync();

            if (tenantsToLink.Any())
            {
                var tenantLeases = tenantsToLink.Select(tenant => new TenantLease
                {
                    TenantId = tenant.Id,
                    LeaseId = newLease.Id,
                    CreatedAt = DateTime.Now
                }).ToList();

            await _context.TenantLeases.AddRangeAsync(tenantLeases);
            await _context.SaveChangesAsync();
            _logger.LogInformation("Created {Count} TenantLease record(s) for lease ID {LeaseId} for property {PropertyId}, unit {UnitId}", 
                tenantLeases.Count, newLease.Id, unit.PropertyId, lease.UnitId);
            }

            // Create LeaseFee records if provided
            if (lease.Fees != null && lease.Fees.Any())
            {
                var leaseFees = lease.Fees.Select(fee => new LeaseFee
                {
                    LeaseId = newLease.Id,
                    OrganizationId = newLease.OrganizationId,
                    Name = fee.Name,
                    Amount = fee.Amount,
                    DueDate = fee.DueDate,
                    // Late Fee Configuration Fields
                    IsLateFee = fee.IsLateFee,
                    LateFeeType = fee.LateFeeType,
                    FeeType = fee.FeeType,
                    PercentValue = fee.PercentValue,
                    AppliedAfterDays = fee.AppliedAfterDays,
                    StartingAfterDays = fee.StartingAfterDays,
                    LimitType = fee.LimitType,
                    LimitDays = fee.LimitDays,
                    LimitAmount = fee.LimitAmount,
                    LimitAmountType = fee.LimitAmountType,
                    CreatedAt = DateTime.UtcNow
                }).ToList();

                await _context.LeaseFees.AddRangeAsync(leaseFees);
                await _context.SaveChangesAsync();
                _logger.LogInformation("Created {Count} LeaseFee record(s) for lease ID {LeaseId}", 
                    leaseFees.Count, newLease.Id);
            }

            // Utilities, Maintenance, & Keys: create default utility and maintenance rows for new lease
            await AddDefaultUtilityAndMaintenanceForLeaseAsync(newLease.Id, newLease.OrganizationId);

            return _mapper.Map<LoadLeaseDto>(newLease);
        }

        private static readonly (string Name, bool IsRequired)[] DefaultUtilities =
        [
            ("Electricity", true),
            ("Gas", true),
            ("Sewer / Septic", true),
            ("Trash", true),
            ("Water", true),
            ("Cable / Satellite", false),
            ("HOA / Condo Fee", false),
            ("Internet", false),
            ("Landscaping", false),
            ("Phone", false),
            ("Snow Removal", false)
        ];

        private static readonly (string Name, string Responsibility, string? Description)[] DefaultMaintenance =
        [
            ("Appliance repair", "Landlord", null),
            ("Furnace filters", "Tenant", null),
            ("Garage door service", "Landlord", null),
            ("Pest control (common)", "Tenant", "e.g., cockroaches, ants, spiders, rodents"),
            ("Pest control (affecting structure)", "Landlord", "e.g., termites, carpenter ants, rodents if exclusion services are needed"),
            ("Leaky faucet", "Landlord", null),
            ("Lightbulbs", "Tenant", null),
            ("Resetting breakers/fuses", "Tenant", null),
            ("Running toilet", "Landlord", null),
            ("Smoke/CO2 alarm batteries", "Tenant", null),
            ("Smoke/CO2 alarm unit replacement", "Landlord", null),
            ("Sprinkler repairs", "Tenant", null),
            ("Sprinklers - seasonal turn on/off", "Tenant", null)
        ];

        private async Task AddDefaultUtilityAndMaintenanceForLeaseAsync(long leaseId, long? organizationId)
        {
            var utilities = DefaultUtilities.Select(u => new UtilityServiceResponsibility
            {
                LeaseId = leaseId,
                OrganizationId = organizationId,
                Name = u.Name,
                Responsibility = "Tenant",
                IsRequired = u.IsRequired
            }).ToList();
            await _context.UtilityServiceResponsibilities.AddRangeAsync(utilities);

            var maintenance = DefaultMaintenance.Select(m => new MaintenanceResponsibility
            {
                LeaseId = leaseId,
                OrganizationId = organizationId,
                Name = m.Name,
                Description = m.Description,
                Responsibility = m.Responsibility
            }).ToList();
            await _context.MaintenanceResponsibilities.AddRangeAsync(maintenance);

            await _context.SaveChangesAsync();
            _logger.LogInformation("Created default utility and maintenance rows for lease ID {LeaseId}", leaseId);
        }

        public async Task<LoadLeaseDto> UpdateLease(UpdateLeaseDto lease)
        {
            // Validate UnitId is provided and valid
            if (lease.UnitId <= 0)
            {
                throw new ArgumentException("UnitId is required and must be greater than 0");
            }

            var existingLease = await _context.Leases
                .FirstOrDefaultAsync(l => l.Id == lease.Id) ?? throw new KeyNotFoundException("Lease not found");

            // Preserve OrganizationId so a null in the DTO doesn't overwrite it
            var existingOrganizationId = existingLease.OrganizationId;
            // Preserve rent/deposit/fees fields so partial updates from other steps don't clear them
            var existingRentDepositFees = new
            {
                existingLease.RentDueDay,
                existingLease.RentFrequency,
                existingLease.ProratedRentDue,
                existingLease.IsProratedRent,
                existingLease.PetDepositAmount,
                existingLease.RentCollectionByPlatform,
                existingLease.RentCollectionOther,
                existingLease.RentCollectionOtherOptions,
                existingLease.RentCollectionOtherSpecify
            };
            // Preserve Provisions & Attachments fields so partial updates from other steps don't clear them
            var existingProvisions = new
            {
                existingLease.IncludeEarlyTerminationClause,
                existingLease.EarlyTerminationClauseText,
                existingLease.AdditionalTerms,
                existingLease.BuiltBefore1978,
                existingLease.AwareOfLeadPaint,
                existingLease.LeadPaintExplanation,
                existingLease.HasLeadPaintRecords,
                existingLease.LeadPaintRecordsExplanation
            };
            var existingAutoRenew = new
            {
                existingLease.AutoRenewLease,
                existingLease.AutoRenewLeaseLength,
                existingLease.AutoRenewRentIncrement,
                existingLease.AutoRenewRentIncrementType,
                existingLease.AutoRenewRentIncrementValue
            };

            // Verify the unit exists
            var unit = await _context.Units
                .Include(u => u.Property)
                .FirstOrDefaultAsync(u => u.Id == lease.UnitId);

            if (unit == null)
            {
                throw new KeyNotFoundException($"Unit with ID {lease.UnitId} not found");
            }

            // Map properties from DTO to existing lease (Unit property is ignored in AutoMapper config)
            _mapper.Map(lease, existingLease);

            // Don't overwrite OrganizationId with null when the client doesn't send it (e.g. partial updates, spread from GET that didn't include it)
            if (!lease.OrganizationId.HasValue)
                existingLease.OrganizationId = existingOrganizationId ?? unit.Property?.OrganizationId;

            // Set the UnitId and Unit navigation property to establish the relationship
            // This ensures EF Core knows the relationship is valid
            existingLease.UnitId = lease.UnitId;
            existingLease.Unit = unit; // Set the navigation property to the tracked unit entity

            // Restore rent/deposit/fees fields when DTO did not provide a value (partial update from another step)
            if (!lease.RentDueDay.HasValue) existingLease.RentDueDay = existingRentDepositFees.RentDueDay;
            if (string.IsNullOrEmpty(lease.RentFrequency)) existingLease.RentFrequency = existingRentDepositFees.RentFrequency;
            if (!lease.ProratedRentDue.HasValue) existingLease.ProratedRentDue = existingRentDepositFees.ProratedRentDue;
            if (!lease.IsProratedRent.HasValue) existingLease.IsProratedRent = existingRentDepositFees.IsProratedRent;
            if (!lease.PetDepositAmount.HasValue) existingLease.PetDepositAmount = existingRentDepositFees.PetDepositAmount;
            if (!lease.RentCollectionByPlatform.HasValue) existingLease.RentCollectionByPlatform = existingRentDepositFees.RentCollectionByPlatform;
            if (!lease.RentCollectionOther.HasValue) existingLease.RentCollectionOther = existingRentDepositFees.RentCollectionOther;
            if (lease.RentCollectionOtherOptions == null) existingLease.RentCollectionOtherOptions = existingRentDepositFees.RentCollectionOtherOptions;
            if (lease.RentCollectionOtherSpecify == null) existingLease.RentCollectionOtherSpecify = existingRentDepositFees.RentCollectionOtherSpecify;

            // Restore auto-renew when DTO did not provide values (partial update from another step)
            if (!lease.AutoRenewLease.HasValue) existingLease.AutoRenewLease = existingAutoRenew.AutoRenewLease;
            if (!lease.AutoRenewLeaseLength.HasValue) existingLease.AutoRenewLeaseLength = existingAutoRenew.AutoRenewLeaseLength;
            if (!lease.AutoRenewRentIncrement.HasValue) existingLease.AutoRenewRentIncrement = existingAutoRenew.AutoRenewRentIncrement;
            if (lease.AutoRenewRentIncrementType == null) existingLease.AutoRenewRentIncrementType = existingAutoRenew.AutoRenewRentIncrementType;
            if (!lease.AutoRenewRentIncrementValue.HasValue) existingLease.AutoRenewRentIncrementValue = existingAutoRenew.AutoRenewRentIncrementValue;

            // Restore Provisions & Attachments when DTO did not provide values (partial update from another step)
            if (!lease.IncludeEarlyTerminationClause.HasValue) existingLease.IncludeEarlyTerminationClause = existingProvisions.IncludeEarlyTerminationClause;
            if (lease.EarlyTerminationClauseText == null) existingLease.EarlyTerminationClauseText = existingProvisions.EarlyTerminationClauseText;
            if (lease.AdditionalTerms == null) existingLease.AdditionalTerms = existingProvisions.AdditionalTerms;
            if (!lease.BuiltBefore1978.HasValue) existingLease.BuiltBefore1978 = existingProvisions.BuiltBefore1978;
            if (!lease.AwareOfLeadPaint.HasValue) existingLease.AwareOfLeadPaint = existingProvisions.AwareOfLeadPaint;
            if (lease.LeadPaintExplanation == null) existingLease.LeadPaintExplanation = existingProvisions.LeadPaintExplanation;
            if (!lease.HasLeadPaintRecords.HasValue) existingLease.HasLeadPaintRecords = existingProvisions.HasLeadPaintRecords;
            if (lease.LeadPaintRecordsExplanation == null) existingLease.LeadPaintRecordsExplanation = existingProvisions.LeadPaintRecordsExplanation;

            // Handle nullable dates - only update if provided, otherwise keep existing values
            if (lease.StartDate.HasValue)
            {
                existingLease.StartDate = lease.StartDate.Value;
            }
            if (lease.EndDate.HasValue)
            {
                existingLease.EndDate = lease.EndDate.Value;
            }
            // If StartDate is provided but EndDate is not, and we need to set a default EndDate
            else if (lease.StartDate.HasValue && !lease.EndDate.HasValue)
            {
                existingLease.EndDate = lease.StartDate.Value.AddYears(1);
            }

            existingLease.UpdatedAt = DateTime.UtcNow;

            var existingAgreement = await _context.LeaseAgreements
                .FirstOrDefaultAsync(la => la.LeaseId == existingLease.Id);
            if (existingAgreement != null &&
                (existingAgreement.LandlordSignedAt.HasValue ||
                 existingAgreement.SignatureCompletedAt.HasValue ||
                 existingAgreement.SignatureStatus == ESignatureStatus.Completed ||
                 !string.IsNullOrEmpty(existingAgreement.DocuSignEnvelopeId)))
            {
                existingAgreement.SignatureStatus = ESignatureStatus.NotSent;
                existingAgreement.DocuSignEnvelopeId = null;
                existingAgreement.SignatureSentAt = null;
                existingAgreement.SignatureCompletedAt = null;
                existingAgreement.SignatureExpiresAt = null;
                existingAgreement.LandlordSignature = null;
                existingAgreement.LandlordSignedAt = null;
                existingAgreement.LandlordSignedBy = null;
                existingAgreement.SignedDocumentBlobName = null;
                existingAgreement.SignedDocumentBlobUrl = null;

                var tenantLeaseSignatures = await _context.TenantLeases
                    .Where(tl => tl.LeaseId == existingLease.Id && tl.TenantSignedAt != null)
                    .ToListAsync();
                foreach (var tenantLease in tenantLeaseSignatures)
                {
                    tenantLease.TenantSignedAt = null;
                }
            }

            await _context.SaveChangesAsync();

            // Update LeaseFee records - delete existing and create new ones
            if (lease.Fees != null)
            {
                // Delete existing fees for this lease
                var existingFees = await _context.LeaseFees
                    .Where(f => f.LeaseId == existingLease.Id)
                    .ToListAsync();
                
                if (existingFees.Any())
                {
                    _context.LeaseFees.RemoveRange(existingFees);
                    await _context.SaveChangesAsync();
                }

                // Add new fees if provided
                if (lease.Fees.Any())
                {
                    var leaseFees = lease.Fees.Select(fee => new LeaseFee
                    {
                        LeaseId = existingLease.Id,
                        OrganizationId = existingLease.OrganizationId,
                        Name = fee.Name,
                        Amount = fee.Amount,
                        DueDate = fee.DueDate,
                        // Late Fee Configuration Fields
                        IsLateFee = fee.IsLateFee,
                        LateFeeType = fee.LateFeeType,
                        FeeType = fee.FeeType,
                        PercentValue = fee.PercentValue,
                        AppliedAfterDays = fee.AppliedAfterDays,
                        StartingAfterDays = fee.StartingAfterDays,
                        LimitType = fee.LimitType,
                        LimitDays = fee.LimitDays,
                        LimitAmount = fee.LimitAmount,
                        LimitAmountType = fee.LimitAmountType,
                        CreatedAt = DateTime.UtcNow
                    }).ToList();

                    await _context.LeaseFees.AddRangeAsync(leaseFees);
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Updated {Count} LeaseFee record(s) for lease ID {LeaseId}", 
                        leaseFees.Count, existingLease.Id);
                }
            }

            // Pets, Smoking, & Other: PetsAllowed and SmokingAllowed
            if (lease.PetsAllowed.HasValue) existingLease.PetsAllowed = lease.PetsAllowed.Value;
            if (lease.SmokingAllowed != null) existingLease.SmokingAllowed = lease.SmokingAllowed;

            // Pets: replace existing
            if (lease.Pets != null)
            {
                var existingPets = await _context.Pets.Where(p => p.LeaseId == existingLease.Id).ToListAsync();
                if (existingPets.Any())
                {
                    _context.Pets.RemoveRange(existingPets);
                    await _context.SaveChangesAsync();
                }
                if (lease.Pets.Any())
                {
                    var pets = lease.Pets.Select(p => new Pet
                    {
                        LeaseId = existingLease.Id,
                        OrganizationId = existingLease.OrganizationId,
                        Type = p.Type,
                        Breed = p.Breed,
                        Weight = p.Weight,
                        Age = p.Age,
                        CreatedAt = DateTime.UtcNow
                    }).ToList();
                    await _context.Pets.AddRangeAsync(pets);
                    await _context.SaveChangesAsync();
                }
            }

            // Parking: upsert (one per lease)
            if (lease.Parking != null)
            {
                var existingParking = await _context.Parking.FirstOrDefaultAsync(p => p.LeaseId == existingLease.Id);
                if (existingParking != null)
                {
                    existingParking.IncludeParkingRules = lease.Parking.IncludeParkingRules;
                    existingParking.ParkingTypes = lease.Parking.ParkingTypes;
                    existingParking.CustomRules = lease.Parking.CustomRules;
                    existingParking.UpdatedAt = DateTime.UtcNow;
                    _context.Parking.Update(existingParking);
                }
                else
                {
                    var parking = new Parking
                    {
                        LeaseId = existingLease.Id,
                        OrganizationId = existingLease.OrganizationId,
                        IncludeParkingRules = lease.Parking.IncludeParkingRules,
                        ParkingTypes = lease.Parking.ParkingTypes,
                        CustomRules = lease.Parking.CustomRules,
                        CreatedAt = DateTime.UtcNow
                    };
                    await _context.Parking.AddAsync(parking);
                }
                await _context.SaveChangesAsync();
            }

            // Utilities, Maintenance, & Keys: scalars
            if (lease.HasSharedUtilities.HasValue) existingLease.HasSharedUtilities = lease.HasSharedUtilities.Value;
            if (lease.SharedUtilitiesDisclosure != null) existingLease.SharedUtilitiesDisclosure = lease.SharedUtilitiesDisclosure;
            if (lease.MaintenanceNotificationMethods != null) existingLease.MaintenanceNotificationMethods = lease.MaintenanceNotificationMethods;

            // UtilityServiceResponsibility: replace (client sends full list including required five)
            if (lease.UtilityServiceResponsibilities != null)
            {
                var existingUtils = await _context.UtilityServiceResponsibilities.Where(p => p.LeaseId == existingLease.Id).ToListAsync();
                if (existingUtils.Any())
                {
                    _context.UtilityServiceResponsibilities.RemoveRange(existingUtils);
                    await _context.SaveChangesAsync();
                }
                foreach (var dto in lease.UtilityServiceResponsibilities)
                {
                    _context.UtilityServiceResponsibilities.Add(new UtilityServiceResponsibility
                    {
                        LeaseId = existingLease.Id,
                        OrganizationId = existingLease.OrganizationId,
                        Name = dto.Name ?? string.Empty,
                        Responsibility = dto.Responsibility ?? "Tenant",
                        IsRequired = dto.IsRequired
                    });
                }
                if (lease.UtilityServiceResponsibilities.Any())
                    await _context.SaveChangesAsync();
            }

            // MaintenanceResponsibility: replace
            if (lease.MaintenanceResponsibilities != null)
            {
                var existingMaint = await _context.MaintenanceResponsibilities.Where(p => p.LeaseId == existingLease.Id).ToListAsync();
                if (existingMaint.Any())
                {
                    _context.MaintenanceResponsibilities.RemoveRange(existingMaint);
                    await _context.SaveChangesAsync();
                }
                foreach (var dto in lease.MaintenanceResponsibilities)
                {
                    _context.MaintenanceResponsibilities.Add(new MaintenanceResponsibility
                    {
                        LeaseId = existingLease.Id,
                        OrganizationId = existingLease.OrganizationId,
                        Name = dto.Name ?? string.Empty,
                        Description = dto.Description,
                        Responsibility = dto.Responsibility ?? "Landlord"
                    });
                }
                if (lease.MaintenanceResponsibilities.Any())
                    await _context.SaveChangesAsync();
            }

            // LeaseKeys: replace
            if (lease.LeaseKeys != null)
            {
                var existingKeys = await _context.LeaseKeys.Where(p => p.LeaseId == existingLease.Id).ToListAsync();
                if (existingKeys.Any())
                {
                    _context.LeaseKeys.RemoveRange(existingKeys);
                    await _context.SaveChangesAsync();
                }
                foreach (var dto in lease.LeaseKeys)
                {
                    _context.LeaseKeys.Add(new LeaseKey
                    {
                        LeaseId = existingLease.Id,
                        OrganizationId = existingLease.OrganizationId,
                        KeyType = dto.KeyType ?? "Property",
                        Copies = dto.Copies
                    });
                }
                if (lease.LeaseKeys.Any())
                    await _context.SaveChangesAsync();
            }

            // People on Lease: scalar fields
            if (lease.AddTenantsLater.HasValue) existingLease.AddTenantsLater = lease.AddTenantsLater.Value;
            if (lease.TenantMailingAddressDiffers.HasValue) existingLease.TenantMailingAddressDiffers = lease.TenantMailingAddressDiffers.Value;
            if (lease.TenantMailingStreetAddress != null) existingLease.TenantMailingStreetAddress = lease.TenantMailingStreetAddress;
            if (lease.TenantMailingUnit != null) existingLease.TenantMailingUnit = lease.TenantMailingUnit;
            if (lease.TenantMailingCity != null) existingLease.TenantMailingCity = lease.TenantMailingCity;
            if (lease.TenantMailingState != null) existingLease.TenantMailingState = lease.TenantMailingState;
            if (lease.TenantMailingZipCode != null) existingLease.TenantMailingZipCode = lease.TenantMailingZipCode;

            // People on Lease: replace LeaseLandlords, LeaseCoSigners, LeaseAdditionalSigners
            if (lease.LeaseLandlords != null)
            {
                var existingLandlords = await _context.LeaseLandlords.Where(x => x.LeaseId == existingLease.Id).ToListAsync();
                _context.LeaseLandlords.RemoveRange(existingLandlords);
                var sortOrder = 0;
                foreach (var dto in lease.LeaseLandlords)
                {
                    _context.LeaseLandlords.Add(new LeaseLandlord
                    {
                        LeaseId = existingLease.Id,
                        EntityType = dto.EntityType ?? "Individual",
                        FirstName = dto.FirstName,
                        LastName = dto.LastName,
                        CompanyName = dto.CompanyName,
                        Email = dto.Email,
                        Phone = dto.Phone,
                        StreetAddress = dto.StreetAddress,
                        Unit = dto.Unit,
                        City = dto.City,
                        State = dto.State,
                        ZipCode = dto.ZipCode,
                        SortOrder = dto.SortOrder
                    });
                    sortOrder++;
                }
            }
            if (lease.LeaseCoSigners != null)
            {
                var existingCoSigners = await _context.LeaseCoSigners.Where(x => x.LeaseId == existingLease.Id).ToListAsync();
                _context.LeaseCoSigners.RemoveRange(existingCoSigners);
                foreach (var dto in lease.LeaseCoSigners)
                {
                    _context.LeaseCoSigners.Add(new LeaseCoSigner
                    {
                        LeaseId = existingLease.Id,
                        FirstName = dto.FirstName,
                        LastName = dto.LastName,
                        Email = dto.Email,
                        SortOrder = dto.SortOrder
                    });
                }
            }
            if (lease.LeaseAdditionalSigners != null)
            {
                var existingAddl = await _context.LeaseAdditionalSigners.Where(x => x.LeaseId == existingLease.Id).ToListAsync();
                _context.LeaseAdditionalSigners.RemoveRange(existingAddl);
                foreach (var dto in lease.LeaseAdditionalSigners)
                {
                    _context.LeaseAdditionalSigners.Add(new LeaseAdditionalSigner
                    {
                        LeaseId = existingLease.Id,
                        FirstName = dto.FirstName,
                        LastName = dto.LastName,
                        Email = dto.Email,
                        SortOrder = dto.SortOrder
                    });
                }
            }
            if (lease.LeaseOccupants != null)
            {
                var existingOccupants = await _context.LeaseOccupants.Where(x => x.LeaseId == existingLease.Id).ToListAsync();
                _context.LeaseOccupants.RemoveRange(existingOccupants);
                foreach (var dto in lease.LeaseOccupants)
                {
                    _context.LeaseOccupants.Add(new LeaseOccupant
                    {
                        LeaseId = existingLease.Id,
                        FirstName = dto.FirstName ?? string.Empty,
                        LastName = dto.LastName ?? string.Empty,
                        Email = dto.Email,
                        SortOrder = dto.SortOrder
                    });
                }
            }

            if (lease.LeaseDeposits != null)
            {
                var existingDeposits = await _context.LeaseDeposits.Where(x => x.LeaseId == existingLease.Id).ToListAsync();
                _context.LeaseDeposits.RemoveRange(existingDeposits);
                var sortOrder = 0;
                foreach (var dto in lease.LeaseDeposits)
                {
                    _context.LeaseDeposits.Add(new LeaseDeposit
                    {
                        LeaseId = existingLease.Id,
                        OrganizationId = existingLease.OrganizationId,
                        Name = dto.Name,
                        Amount = dto.Amount,
                        DueDate = dto.DueDate,
                        SortOrder = dto.SortOrder,
                        CreatedAt = DateTime.UtcNow
                    });
                    sortOrder++;
                }
            }

            await _context.SaveChangesAsync();

            // Reload lease with new includes for response
            existingLease = await _context.Leases
                .Include(l => l.Unit).ThenInclude(u => u.Property)
                .Include(l => l.TenantLeases).ThenInclude(tl => tl.Tenant)
                .Include(l => l.LeaseFees)
                .Include(l => l.LeaseLandlords)
                .Include(l => l.LeaseDeposits)
                .Include(l => l.Pets)
                .Include(l => l.Parking)
                .Include(l => l.UtilityServiceResponsibilities)
                .Include(l => l.MaintenanceResponsibilities)
                .Include(l => l.LeaseKeys)
                .Include(l => l.LeaseCoSigners)
                .Include(l => l.LeaseAdditionalSigners)
                .Include(l => l.LeaseOccupants)
                .Include(l => l.LeaseAgreement)
                .FirstAsync(l => l.Id == existingLease.Id);

            return _mapper.Map<LoadLeaseDto>(existingLease);
        }

        public async Task<LoadLeaseDto> CompleteDraft(long leaseId, long organizationId)
        {
            var lease = await _context.Leases
                .FirstOrDefaultAsync(l => l.Id == leaseId && l.OrganizationId == organizationId)
                ?? throw new KeyNotFoundException("Lease not found");
            var agreement = await _context.LeaseAgreements.FirstOrDefaultAsync(la => la.LeaseId == leaseId);
            if (agreement != null)
                agreement.IsDrafted = false;
            await _context.SaveChangesAsync();
            var reloaded = await _context.Leases
                .Include(l => l.Unit).ThenInclude(u => u.Property)
                .Include(l => l.TenantLeases).ThenInclude(tl => tl.Tenant)
                .Include(l => l.LeaseFees)
                .Include(l => l.LeaseLandlords)
                .Include(l => l.LeaseDeposits)
                .Include(l => l.Pets)
                .Include(l => l.Parking)
                .Include(l => l.UtilityServiceResponsibilities)
                .Include(l => l.MaintenanceResponsibilities)
                .Include(l => l.LeaseKeys)
                .Include(l => l.LeaseCoSigners)
                .Include(l => l.LeaseAdditionalSigners)
                .Include(l => l.LeaseOccupants)
                .Include(l => l.LeaseAgreement)
                .FirstAsync(l => l.Id == leaseId);
            return _mapper.Map<LoadLeaseDto>(reloaded);
        }

        public async Task<LoadLeaseDto> UpdateLeaseSignature(UpdateLeaseSignatureDto signatureInfo)
        {
            var agreement = await _context.LeaseAgreements
                .FirstOrDefaultAsync(la => la.LeaseId == signatureInfo.LeaseId)
                ?? throw new KeyNotFoundException("LeaseAgreement not found");

            agreement.SignatureStatus = signatureInfo.SignatureStatus;
            agreement.DocuSignEnvelopeId = signatureInfo.DocuSignEnvelopeId;
            agreement.SignatureSentAt = signatureInfo.SignatureSentAt;
            agreement.SignatureCompletedAt = signatureInfo.SignatureCompletedAt;
            agreement.SignatureExpiresAt = signatureInfo.SignatureExpiresAt;

            if (signatureInfo.LandlordSignedAt.HasValue)
                agreement.LandlordSignedAt = signatureInfo.LandlordSignedAt;
            if (!string.IsNullOrEmpty(signatureInfo.LandlordSignedBy))
                agreement.LandlordSignedBy = signatureInfo.LandlordSignedBy;

            _context.LeaseAgreements.Update(agreement);
            await _context.SaveChangesAsync();

            var lease = await _context.Leases
                .Include(l => l.Unit).ThenInclude(u => u.Property).ThenInclude(p => p.Landlord)
                .Include(l => l.LeaseAgreement)
                .Include(l => l.TenantLeases).ThenInclude(tl => tl.Tenant)
                .Include(l => l.LeaseFees)
                .FirstOrDefaultAsync(l => l.Id == signatureInfo.LeaseId)
                ?? throw new KeyNotFoundException("Lease not found");
            return _mapper.Map<LoadLeaseDto>(lease);
        }

        public async Task<LoadLeaseDto> GetLease(long unitId, long? organizationId = null)
        {
            try
            {
                var query = _context.Leases
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.Pets)
                    .Include(l => l.Parking)
                    .Include(l => l.UtilityServiceResponsibilities)
                    .Include(l => l.MaintenanceResponsibilities)
                    .Include(l => l.LeaseKeys)
                    .Include(l => l.LeaseAgreement)
                    .Where(l => l.UnitId == unitId);

                // Filter by organizationId if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(l => l.OrganizationId == organizationId.Value);
                }

                var lease = await query.FirstOrDefaultAsync();

                return _mapper.Map<LoadLeaseDto>(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease with ID {unitId}", unitId);
                throw new Exception($"Error retrieving lease with ID {unitId}", ex);
            }
        }

        public async Task<LoadLeaseDto> DeleteLease(long id)
        {
            try
            {
                var lease = await _context.Leases
                    .Include(l => l.Unit)
                    .FirstOrDefaultAsync(l => l.Id == id);
                
                if (lease == null)
                    throw new KeyNotFoundException($"Lease with ID {id} not found");

                // STEP 1: Archive (soft delete) all lease agreement documents associated with this lease
                // This preserves the documents for historical/legal purposes while removing the lease
                var leaseAgreementDocuments = await _context.TenantDocuments
                    .Where(td => td.LeaseId == id && 
                                td.DocumentType == ETenantDocumentType.LeaseAgreement &&
                                !td.IsDeleted)
                    .ToListAsync();

                if (leaseAgreementDocuments.Any())
                {
                    var now = DateTime.UtcNow;
                    foreach (var document in leaseAgreementDocuments)
                    {
                        document.IsDeleted = true;
                        document.DeletedAt = now;
                        _logger.LogInformation("Archiving lease agreement document {DocumentId} (BlobName: {BlobName}) for deleted lease {LeaseId}",
                            document.Id, document.BlobName, id);
                    }
                    _context.TenantDocuments.UpdateRange(leaseAgreementDocuments);
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Archived {Count} lease agreement document(s) for lease {LeaseId}", 
                        leaseAgreementDocuments.Count, id);
                }

                // STEP 2: Find and delete associated lease instance(s)
                // Note: The relationship is configured with DeleteBehavior.Restrict, so we must delete
                // LeaseInstances before deleting the Lease. Child entities (Variables, Documents, PolicySection)
                // have Cascade delete configured, so they will be automatically deleted.
                var leaseInstances = await _context.LeaseInstances
                    .Where(li => li.LeaseId == id)
                    .ToListAsync();

                if (leaseInstances.Any())
                {
                    // Delete lease instances - child entities will cascade delete automatically
                    _context.LeaseInstances.RemoveRange(leaseInstances);
                    // Save changes to delete instances before deleting the lease
                    await _context.SaveChangesAsync();
                }

                // STEP 3: Hard delete the lease - actually remove from the table
                // Note: This will also clear the Unit's Lease navigation property
                // IMPORTANT: Lease history entries (LeaseHistories table) are NOT deleted.
                // History entries are preserved permanently unless explicitly deleted from the history view.
                // This ensures historical records remain available for legal/compliance purposes.
                if (lease.Unit != null)
                {
                    lease.Unit.IsOccupied = false;
                }
                _context.Leases.Remove(lease);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Successfully deleted lease {LeaseId} and archived {DocumentCount} lease agreement document(s). Lease history preserved.", 
                    id, leaseAgreementDocuments.Count);

                // Return a DTO before deletion for the response
                return _mapper.Map<LoadLeaseDto>(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting lease with ID {id}", id);
                throw new Exception($"Error deleting lease with ID {id}", ex);
            }
        }

        public async Task<LoadLeaseDto> GetLeaseById(long leaseId, long organizationId)
        {
            try
            {
                var lease = await _context.Leases
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.LeaseLandlords)
                    .Include(l => l.LeaseDeposits)
                    .Include(l => l.Pets)
                    .Include(l => l.Parking)
                    .Include(l => l.UtilityServiceResponsibilities)
                    .Include(l => l.MaintenanceResponsibilities)
                    .Include(l => l.LeaseKeys)
                    .Include(l => l.LeaseCoSigners)
                    .Include(l => l.LeaseAdditionalSigners)
                    .Include(l => l.LeaseOccupants)
                    .Include(l => l.LeaseAgreement)
                    .Where(l => l.Id == leaseId && l.OrganizationId == organizationId)
                    .FirstOrDefaultAsync();

                return _mapper.Map<LoadLeaseDto>(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease with ID {leaseId}", leaseId);
                throw new Exception($"Error retrieving lease with ID {leaseId}", ex);
            }
        }

        public async Task<LoadLeaseDto> SetMoveInReportTemplateCompletedAt(long leaseId, long organizationId)
        {
            var lease = await _context.Leases
                .Include(l => l.Unit)
                    .ThenInclude(u => u.Property)
                .Include(l => l.TenantLeases)
                    .ThenInclude(tl => tl.Tenant)
                .Include(l => l.LeaseFees)
                .Include(l => l.LeaseLandlords)
                .Include(l => l.LeaseDeposits)
                .Include(l => l.Pets)
                .Include(l => l.Parking)
                .Include(l => l.UtilityServiceResponsibilities)
                .Include(l => l.MaintenanceResponsibilities)
                .Include(l => l.LeaseKeys)
                .Include(l => l.LeaseCoSigners)
                .Include(l => l.LeaseAdditionalSigners)
                .Include(l => l.LeaseOccupants)
                .Include(l => l.LeaseAgreement)
                .Where(l => l.Id == leaseId && l.OrganizationId == organizationId)
                .FirstOrDefaultAsync();
            if (lease == null)
                throw new Exception($"Lease not found: {leaseId}");
            lease.MoveInReportTemplateCompletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return _mapper.Map<LoadLeaseDto>(lease);
        }

        public async Task<LeaseConnectInfoDto?> GetLeaseByDocuSignEnvelopeIdAsync(string envelopeId)
        {
            if (string.IsNullOrWhiteSpace(envelopeId))
                return null;
            var row = await _context.LeaseAgreements
                .AsNoTracking()
                .Include(la => la.Lease)
                    .ThenInclude(l => l.Unit)
                        .ThenInclude(u => u.Property)
                .Where(la => la.DocuSignEnvelopeId == envelopeId && la.Lease.OrganizationId != null)
                .Select(la => new { la.LeaseId, la.Lease.OrganizationId, LandlordId = la.Lease.Unit.Property.LandlordId })
                .FirstOrDefaultAsync();
            if (row == null || !row.OrganizationId.HasValue)
                return null;
            return new LeaseConnectInfoDto
            {
                LeaseId = row.LeaseId,
                OrganizationId = row.OrganizationId.Value,
                LandlordId = row.LandlordId
            };
        }

        public async Task<List<LoadLeaseDto>> GetLeasesEndingOnOrBeforeForAutoRenew(DateTime date)
        {
            var cutOff = date.Date;
            var leases = await _context.Leases
                .AsNoTracking()
                .Where(l => l.IsActive && l.EndDate.HasValue && l.EndDate.Value.Date <= cutOff && l.AutoRenewLease && l.OrganizationId != null)
                .Select(l => new LoadLeaseDto
                {
                    Id = l.Id,
                    OrganizationId = l.OrganizationId
                })
                .ToListAsync();
            return leases;
        }

        public async Task CopyLeaseRelatedEntitiesToNewLeaseAsync(long sourceLeaseId, long newLeaseId)
        {
            var source = await _context.Leases
                .Include(l => l.LeaseDeposits)
                .Include(l => l.LeaseLandlords)
                .Include(l => l.LeaseCoSigners)
                .Include(l => l.LeaseAdditionalSigners)
                .Include(l => l.LeaseOccupants)
                .Include(l => l.Pets)
                .Include(l => l.Parking)
                .Include(l => l.LeaseKeys)
                .Include(l => l.UtilityServiceResponsibilities)
                .Include(l => l.MaintenanceResponsibilities)
                .AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == sourceLeaseId);
            if (source == null) return;

            var orgId = source.OrganizationId;

            // Remove default utility and maintenance created by AddLease so we can replace with source lease data
            var existingUtilities = await _context.UtilityServiceResponsibilities.Where(u => u.LeaseId == newLeaseId).ToListAsync();
            var existingMaintenance = await _context.MaintenanceResponsibilities.Where(m => m.LeaseId == newLeaseId).ToListAsync();
            _context.UtilityServiceResponsibilities.RemoveRange(existingUtilities);
            _context.MaintenanceResponsibilities.RemoveRange(existingMaintenance);
            await _context.SaveChangesAsync();

            // LeaseFees are created by AddLease when dto.Fees is passed; do not duplicate here
            if (source.LeaseDeposits != null && source.LeaseDeposits.Any())
            {
                var newDeposits = source.LeaseDeposits.Select(d => new LeaseDeposit
                {
                    LeaseId = newLeaseId,
                    OrganizationId = orgId,
                    Name = d.Name,
                    Amount = d.Amount,
                    DueDate = d.DueDate,
                    SortOrder = d.SortOrder,
                    CreatedAt = DateTime.UtcNow
                }).ToList();
                await _context.LeaseDeposits.AddRangeAsync(newDeposits);
            }
            if (source.LeaseLandlords != null && source.LeaseLandlords.Any())
            {
                var newLandlords = source.LeaseLandlords.Select(l => new LeaseLandlord
                {
                    LeaseId = newLeaseId,
                    EntityType = l.EntityType ?? "Individual",
                    FirstName = l.FirstName,
                    LastName = l.LastName,
                    CompanyName = l.CompanyName,
                    Email = l.Email,
                    Phone = l.Phone,
                    StreetAddress = l.StreetAddress,
                    Unit = l.Unit,
                    City = l.City,
                    State = l.State,
                    ZipCode = l.ZipCode,
                    SortOrder = l.SortOrder
                }).ToList();
                await _context.LeaseLandlords.AddRangeAsync(newLandlords);
            }
            if (source.LeaseCoSigners != null && source.LeaseCoSigners.Any())
            {
                var newCoSigners = source.LeaseCoSigners.Select(c => new LeaseCoSigner
                {
                    LeaseId = newLeaseId,
                    FirstName = c.FirstName ?? string.Empty,
                    LastName = c.LastName ?? string.Empty,
                    Email = c.Email ?? string.Empty,
                    SortOrder = c.SortOrder
                }).ToList();
                await _context.LeaseCoSigners.AddRangeAsync(newCoSigners);
            }
            if (source.LeaseAdditionalSigners != null && source.LeaseAdditionalSigners.Any())
            {
                var newAdditional = source.LeaseAdditionalSigners.Select(a => new LeaseAdditionalSigner
                {
                    LeaseId = newLeaseId,
                    FirstName = a.FirstName ?? string.Empty,
                    LastName = a.LastName ?? string.Empty,
                    Email = a.Email ?? string.Empty,
                    SortOrder = a.SortOrder
                }).ToList();
                await _context.LeaseAdditionalSigners.AddRangeAsync(newAdditional);
            }
            if (source.LeaseOccupants != null && source.LeaseOccupants.Any())
            {
                var newOccupants = source.LeaseOccupants.Select(o => new LeaseOccupant
                {
                    LeaseId = newLeaseId,
                    FirstName = o.FirstName ?? string.Empty,
                    LastName = o.LastName ?? string.Empty,
                    Email = o.Email,
                    SortOrder = o.SortOrder
                }).ToList();
                await _context.LeaseOccupants.AddRangeAsync(newOccupants);
            }
            if (source.Pets != null && source.Pets.Any())
            {
                var newPets = source.Pets.Select(p => new Pet
                {
                    LeaseId = newLeaseId,
                    OrganizationId = orgId,
                    Type = p.Type ?? string.Empty,
                    Breed = p.Breed,
                    Weight = p.Weight,
                    Age = p.Age,
                    CreatedAt = DateTime.UtcNow
                }).ToList();
                await _context.Pets.AddRangeAsync(newPets);
            }
            if (source.Parking != null)
            {
                await _context.Parking.AddAsync(new Parking
                {
                    LeaseId = newLeaseId,
                    OrganizationId = orgId,
                    IncludeParkingRules = source.Parking.IncludeParkingRules,
                    ParkingTypes = source.Parking.ParkingTypes,
                    CustomRules = source.Parking.CustomRules,
                    CreatedAt = DateTime.UtcNow
                });
            }
            if (source.LeaseKeys != null && source.LeaseKeys.Any())
            {
                var newKeys = source.LeaseKeys.Select(k => new LeaseKey
                {
                    LeaseId = newLeaseId,
                    OrganizationId = orgId,
                    KeyType = k.KeyType ?? "Property",
                    Copies = k.Copies
                }).ToList();
                await _context.LeaseKeys.AddRangeAsync(newKeys);
            }
            if (source.UtilityServiceResponsibilities != null && source.UtilityServiceResponsibilities.Any())
            {
                var newUtils = source.UtilityServiceResponsibilities.Select(u => new UtilityServiceResponsibility
                {
                    LeaseId = newLeaseId,
                    OrganizationId = orgId,
                    Name = u.Name ?? string.Empty,
                    Responsibility = u.Responsibility ?? "Tenant",
                    IsRequired = u.IsRequired
                }).ToList();
                await _context.UtilityServiceResponsibilities.AddRangeAsync(newUtils);
            }
            if (source.MaintenanceResponsibilities != null && source.MaintenanceResponsibilities.Any())
            {
                var newMaint = source.MaintenanceResponsibilities.Select(m => new MaintenanceResponsibility
                {
                    LeaseId = newLeaseId,
                    OrganizationId = orgId,
                    Name = m.Name ?? string.Empty,
                    Responsibility = m.Responsibility ?? "Landlord",
                    Description = m.Description
                }).ToList();
                await _context.MaintenanceResponsibilities.AddRangeAsync(newMaint);
            }
            await _context.SaveChangesAsync();
            _logger.LogInformation("Copied related entities from lease {SourceId} to new lease {NewId}", sourceLeaseId, newLeaseId);
        }

        public async Task<List<LoadLeaseDto>> GetLeasesByLandlordId(long landlordId, bool isActive = true)
        {
            try
            {
                var leases = new List<Lease>();

                if (isActive)
                {
                    leases = await _context.Leases
                            .AsNoTracking()
                            .Include(l => l.Unit)
                                .ThenInclude(u => u.Property)
                                    .ThenInclude(p => p.Images)
                            .Include(l => l.TenantLeases)
                                .ThenInclude(tl => tl.Tenant)
                            .Include(l => l.LeaseFees)
                            .Include(l => l.LeaseAgreement)
                            .Where(l => l.Unit.Property.LandlordId == landlordId &&
                                        !l.Unit.Property.IsDeleted &&
                                        l.IsActive)
                            .ToListAsync();

                    return _mapper.Map<List<LoadLeaseDto>>(leases);
                }

                leases = await _context.Leases
                    .AsNoTracking()
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                            .ThenInclude(p => p.Images)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.LeaseAgreement)
                    .Where(l => l.Unit.Property.LandlordId == landlordId &&
                                !l.Unit.Property.IsDeleted)
                    .ToListAsync();

                return _mapper.Map<List<LoadLeaseDto>>(leases);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leases for landlord with ID {landlordId}", landlordId);
                throw new Exception($"Error retrieving leases for landlord with ID {landlordId}", ex);
            }
        }

        public async Task<List<LoadLeaseDto>> GetLeasesByOrganizationId(long organizationId, bool isActive = true)
        {
            try
            {
                var query = _context.Leases
                    .AsNoTracking()
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                            .ThenInclude(p => p.Images)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.LeaseAgreement)
                    .Where(l => l.OrganizationId == organizationId);

                if (isActive)
                {
                    // Active leases: IsActive = true (includes leases that haven't started yet)
                    query = query.Where(l => l.IsActive);
                }

                var leases = await query.ToListAsync();
                return _mapper.Map<List<LoadLeaseDto>>(leases);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leases for organization {organizationId}", organizationId);
                throw new Exception($"Error retrieving leases for organization {organizationId}", ex);
            }
        }

        public async Task<List<LoadLeaseDto>> GetLeasesForRentCalculationAsync(long organizationId)
        {
            try
            {
                return await _context.Leases
                    .AsNoTracking()
                    .Where(l => l.OrganizationId == organizationId && l.IsActive &&
                                !_context.LeaseAgreements.Any(la => la.LeaseId == l.Id && la.IsDrafted == true))
                    .Select(l => new LoadLeaseDto
                    {
                        Id = l.Id,
                        IsActive = l.IsActive,
                        RentAmount = l.RentAmount,
                        StartDate = l.StartDate,
                        EndDate = l.EndDate,
                        RentFrequency = l.RentFrequency
                    })
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leases for rent calculation, organization {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving leases for rent calculation, organization {organizationId}", ex);
            }
        }

        public async Task<List<LoadLeaseDto>> GetLeasesByPropertyId(long propertyId, bool isActive = true, long? organizationId = null)
        {
            try
            {
                var query = _context.Leases
                    .AsNoTracking()
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                            .ThenInclude(p => p.Images)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.LeaseAgreement)
                    .Where(l => l.Unit.PropertyId == propertyId &&
                                !l.Unit.Property.IsDeleted);

                // Filter by organizationId if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(l => l.OrganizationId == organizationId.Value);
                }

                if (isActive)
                {
                    // Active leases: IsActive = true (includes leases that haven't started yet)
                    query = query.Where(l => l.IsActive);
                }

                var leases = await query
                    .OrderByDescending(l => l.StartDate)
                    .ToListAsync();

                return _mapper.Map<List<LoadLeaseDto>>(leases);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leases for property with ID {PropertyId}", propertyId);
                throw new Exception($"Error retrieving leases for property with ID {propertyId}", ex);
            }
        }


        public async Task<LoadLeaseDto> GetActiveLease(long propertyId, long? organizationId = null)
        {
            try
            {
                var query = _context.Leases
                    .AsNoTracking()
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.LeaseAgreement)
                    .Where(l => l.Unit.PropertyId == propertyId &&
                                l.IsActive &&
                                !l.Unit.Property.IsDeleted);

                // Filter by organizationId if provided
                if (organizationId.HasValue)
                {
                    query = query.Where(l => l.OrganizationId == organizationId.Value);
                }

                var lease = await query.FirstOrDefaultAsync();

                return _mapper.Map<LoadLeaseDto>(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving active lease for property with ID {propertyId}", propertyId);
                throw new Exception($"Error retrieving active lease for property with ID {propertyId}", ex);
            }
        }

        public async Task<List<LoadLeaseDto>> GetLeasesByTenantUserId(long tenantUserId)
        {
            try
            {
                var leases = await _context.Leases
                    .AsNoTracking()
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                            .ThenInclude(p => p.Landlord)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.LeaseAgreement)
                    .Where(l => l.TenantLeases.Any(tl => tl.Tenant.UserId == tenantUserId) &&
                                !l.Unit.Property.IsDeleted)
                    .ToListAsync();

                var leaseDtos = _mapper.Map<List<LoadLeaseDto>>(leases);
                var organizationIds = leaseDtos
                    .Select(l => l.OrganizationId)
                    .Where(id => id.HasValue)
                    .Select(id => id!.Value)
                    .Distinct()
                    .ToList();

                if (organizationIds.Any())
                {
                    var primarySmsNumbers = await _context.OrganizationSmsNumbers
                        .AsNoTracking()
                        .Where(n => organizationIds.Contains(n.OrganizationId) && n.IsActive && n.IsPrimary)
                        .ToDictionaryAsync(n => n.OrganizationId, n => n.PhoneNumber);

                    foreach (var leaseDto in leaseDtos)
                    {
                        if (leaseDto.OrganizationId.HasValue && primarySmsNumbers.TryGetValue(leaseDto.OrganizationId.Value, out var smsNumber))
                        {
                            leaseDto.LandlordSmsNumber = smsNumber;
                        }
                    }
                }

                return leaseDtos;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leases for tenant user with ID {tenantUserId}", tenantUserId);
                throw new Exception($"Error retrieving leases for tenant user with ID {tenantUserId}", ex);
            }
        }

        public async Task<int> DeleteLeasesByPropertyId(long propertyId)
        {
            try
            {
                var leases = await _context.Leases
                    .Include(l => l.Unit)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.Deposits)
                    .Include(l => l.TenantLeases)
                    .Where(l => l.Unit.PropertyId == propertyId)
                    .ToListAsync();

                var leaseIds = leases.Select(l => l.Id).ToList();

                // Delete related payments for these leases (must be deleted before leases due to foreign key constraint)
                if (leaseIds.Any())
                {
                    var payments = await _context.Payments
                        .Where(p => leaseIds.Contains(p.LeaseId))
                        .ToListAsync();
                    if (payments.Any())
                    {
                        _context.Payments.RemoveRange(payments);
                        _logger.LogInformation("Deleting {Count} payments for leases in property {PropertyId}", payments.Count, propertyId);
                        await _context.SaveChangesAsync(); // Save payments deletion first
                    }
                }

                // Hard delete all leases for the property (cascade will handle TenantLeases, LeaseFees, and Deposits are included)
                _context.Leases.RemoveRange(leases);

                await _context.SaveChangesAsync();
                _logger.LogInformation("Deleted {Count} leases for property {PropertyId}", leases.Count, propertyId);
                return leases.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting leases for property {PropertyId}", propertyId);
                throw new Exception("Error deleting leases", ex);
            }
        }

        public async Task<int> DeactivateLeasesByPropertyId(long propertyId)
        {
            try
            {
                var leases = await _context.Leases
                    .Include(l => l.Unit)
                    .Include(l => l.LeaseAgreement)
                    .Where(l => l.Unit.PropertyId == propertyId && l.IsActive && !l.IsDeleted)
                    .ToListAsync();

                int deactivatedCount = 0;
                var now = DateTime.UtcNow;

                foreach (var lease in leases)
                {
                    // Create history entry for each lease
                    var historyEntry = new LeaseHistory
                    {
                        OriginalLeaseId = lease.Id,
                        UnitId = lease.UnitId,
                        StartDate = lease.StartDate ?? DateTime.UtcNow,
                        EndDate = lease.EndDate ?? DateTime.UtcNow.AddYears(1),
                        RentAmount = lease.RentAmount ?? 0m,
                        DepositAmount = lease.DepositAmount ?? 0m,
                        LeaseLength = lease.LeaseLength ?? 0,
                        RentFrequency = lease.RentFrequency ?? "Monthly",
                        RentDueDay = lease.RentDueDay ?? 1,
                        OverdueAmount = lease.OverdueAmount ?? 0m,
                        CustomDateSelected = lease.CustomDateSelected ?? false,
                        ArchivedAt = now,
                        SignatureStatus = lease.LeaseAgreement?.SignatureStatus ?? ESignatureStatus.NotSent,
                        DocuSignEnvelopeId = lease.LeaseAgreement?.DocuSignEnvelopeId,
                        SignatureSentAt = lease.LeaseAgreement?.SignatureSentAt,
                        SignatureCompletedAt = lease.LeaseAgreement?.SignatureCompletedAt,
                        SignatureExpiresAt = lease.LeaseAgreement?.SignatureExpiresAt,
                        LandlordSignature = lease.LeaseAgreement?.LandlordSignature,
                        LandlordSignedAt = lease.LeaseAgreement?.LandlordSignedAt,
                        LandlordSignedBy = lease.LeaseAgreement?.LandlordSignedBy,
                        SignedDocumentBlobName = lease.LeaseAgreement?.SignedDocumentBlobName,
                        SignedDocumentBlobUrl = lease.LeaseAgreement?.SignedDocumentBlobUrl,
                        LeaseTemplateId = lease.LeaseTemplateId,
                        OrganizationId = lease.OrganizationId
                    };

                    await _context.LeaseHistories.AddAsync(historyEntry);

                    // Mark lease as inactive (but not deleted) to preserve payments and expenses
                    lease.IsActive = false;
                    deactivatedCount++;
                }

                if (deactivatedCount > 0)
                {
                    await _context.SaveChangesAsync();
                    _logger.LogInformation("Deactivated {Count} lease(s) for property {PropertyId}", deactivatedCount, propertyId);
                }

                return deactivatedCount;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deactivating leases for property {PropertyId}", propertyId);
                throw new Exception("Error deactivating leases", ex);
            }
        }

        public async Task<LoadLeaseDto> EndLease(long leaseId)
        {
            try
            {
                var lease = await _context.Leases
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseAgreement)
                    .FirstOrDefaultAsync(l => l.Id == leaseId);

                if (lease == null)
                    throw new KeyNotFoundException($"Lease with ID {leaseId} not found");

                // Create history entry
                var historyEntry = new LeaseHistory
                {
                    OriginalLeaseId = lease.Id,
                    UnitId = lease.UnitId,
                    StartDate = lease.StartDate ?? DateTime.UtcNow,
                    EndDate = lease.EndDate ?? DateTime.UtcNow.AddYears(1),
                    RentAmount = lease.RentAmount ?? 0m,
                    DepositAmount = lease.DepositAmount ?? 0m,
                    LeaseLength = lease.LeaseLength ?? 0,
                    RentFrequency = lease.RentFrequency ?? "Monthly",
                    RentDueDay = lease.RentDueDay ?? 1,
                    OverdueAmount = lease.OverdueAmount ?? 0m,
                    CustomDateSelected = lease.CustomDateSelected ?? false,
                    ArchivedAt = DateTime.UtcNow,
                    SignatureStatus = lease.LeaseAgreement?.SignatureStatus ?? ESignatureStatus.NotSent,
                    DocuSignEnvelopeId = lease.LeaseAgreement?.DocuSignEnvelopeId,
                    SignatureSentAt = lease.LeaseAgreement?.SignatureSentAt,
                    SignatureCompletedAt = lease.LeaseAgreement?.SignatureCompletedAt,
                    SignatureExpiresAt = lease.LeaseAgreement?.SignatureExpiresAt,
                    LandlordSignature = lease.LeaseAgreement?.LandlordSignature,
                    LandlordSignedAt = lease.LeaseAgreement?.LandlordSignedAt,
                    LandlordSignedBy = lease.LeaseAgreement?.LandlordSignedBy,
                    SignedDocumentBlobName = lease.LeaseAgreement?.SignedDocumentBlobName,
                    SignedDocumentBlobUrl = lease.LeaseAgreement?.SignedDocumentBlobUrl,
                    LeaseTemplateId = lease.LeaseTemplateId,
                    OrganizationId = lease.OrganizationId
                };

                await _context.LeaseHistories.AddAsync(historyEntry);

                // Mark lease as inactive (but not deleted)
                lease.IsActive = false;

                // Unit is now vacant since the active lease ended
                if (lease.Unit != null)
                {
                    lease.Unit.IsOccupied = false;
                }

                // Note: Tenants are NOT deleted - they remain in the Tenants table
                // Their LeaseId reference will still point to this lease

                await _context.SaveChangesAsync();

                return _mapper.Map<LoadLeaseDto>(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error ending lease with ID {LeaseId}", leaseId);
                throw new Exception($"Error ending lease with ID {leaseId}", ex);
            }
        }

        public async Task<LoadLeaseDto> ReopenLease(long leaseId)
        {
            try
            {
                var lease = await _context.Leases
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.LeaseAgreement)
                    .FirstOrDefaultAsync(l => l.Id == leaseId);

                if (lease == null)
                    throw new KeyNotFoundException($"Lease with ID {leaseId} not found");

                // Mark lease as active again
                lease.IsActive = true;

                await _context.SaveChangesAsync();

                return _mapper.Map<LoadLeaseDto>(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reopening lease with ID {LeaseId}", leaseId);
                throw new Exception($"Error reopening lease with ID {leaseId}", ex);
            }
        }

        public async Task<List<LoadLeaseDto>> GetLeaseHistoryByOrganizationId(long organizationId)
        {
            try
            {
                // Get lease history entries with their related Unit and Property data
                var leaseHistories = await _context.LeaseHistories
                    .AsNoTracking()
                    .Include(lh => lh.Organization)
                    .Where(lh => lh.OrganizationId == organizationId)
                    .OrderByDescending(lh => lh.ArchivedAt)
                    .ToListAsync();

                var result = new List<LoadLeaseDto>();

                foreach (var history in leaseHistories)
                {
                    // Get Unit and Property data
                    var unit = await _context.Units
                        .AsNoTracking()
                        .Include(u => u.Property)
                            .ThenInclude(p => p.Images)
                        .Include(u => u.Property)
                            .ThenInclude(p => p.Landlord)
                        .FirstOrDefaultAsync(u => u.Id == history.UnitId);

                    if (unit == null || unit.Property == null || unit.Property.IsDeleted)
                        continue;

                    // Get tenants from the original lease via TenantLeases
                    var tenantLeases = await _context.TenantLeases
                        .AsNoTracking()
                        .Include(tl => tl.Tenant)
                            .ThenInclude(t => t.User)
                        .Where(tl => tl.LeaseId == history.OriginalLeaseId && !tl.Tenant.IsDeleted)
                        .ToListAsync();
                    var tenants = tenantLeases.Select(tl => tl.Tenant).ToList();

                    // Map LeaseHistory to LoadLeaseDto manually
                    var leaseDto = new LoadLeaseDto
                    {
                        Id = history.Id, // Use history ID
                        StartDate = history.StartDate,
                        EndDate = history.EndDate,
                        RentAmount = history.RentAmount,
                        DepositAmount = history.DepositAmount,
                        LeaseLength = history.LeaseLength,
                        RentFrequency = history.RentFrequency,
                        RentDueDay = history.RentDueDay,
                        OverdueAmount = history.OverdueAmount,
                        CustomDateSelected = history.CustomDateSelected,
                        IsActive = false, // History entries are always inactive
                        LeaseTemplateId = history.LeaseTemplateId,
                        LeaseAgreement = new Dtos.LeaseAgreement.LoadLeaseAgreementDto
                        {
                            SignatureStatus = history.SignatureStatus,
                            DocuSignEnvelopeId = history.DocuSignEnvelopeId,
                            SignatureSentAt = history.SignatureSentAt,
                            SignatureCompletedAt = history.SignatureCompletedAt,
                            SignatureExpiresAt = history.SignatureExpiresAt,
                            LandlordSignature = history.LandlordSignature,
                            LandlordSignedAt = history.LandlordSignedAt,
                            LandlordSignedBy = history.LandlordSignedBy,
                            SignedDocumentBlobName = history.SignedDocumentBlobName,
                            SignedDocumentBlobUrl = history.SignedDocumentBlobUrl,
                        },
                        // Property and Unit info
                        PropertyId = unit.Property.Id,
                        PropertyName = unit.Property.Name,
                        PropertyType = unit.Property.PropertyType.ToString(),
                        UnitId = unit.Id,
                        UnitName = unit.Name,
                        // Landlord info
                        LandlordName = unit.Property.Landlord != null
                            ? $"{unit.Property.Landlord.FirstName} {unit.Property.Landlord.LastName}".Trim()
                            : string.Empty,
                        LandlordEmail = unit.Property.Landlord != null && !string.IsNullOrEmpty(unit.Property.Landlord.Email)
                            ? unit.Property.Landlord.Email
                            : (!string.IsNullOrEmpty(unit.Property.ContactEmail) ? unit.Property.ContactEmail : string.Empty),
                        LandlordPhone = unit.Property.Landlord != null && !string.IsNullOrEmpty(unit.Property.Landlord.PhoneNumber)
                            ? unit.Property.Landlord.PhoneNumber
                            : (!string.IsNullOrEmpty(unit.Property.ContactPhone) ? unit.Property.ContactPhone : null),
                        PropertyImageUrl = unit.Property.Images != null && unit.Property.Images.Any()
                            ? unit.Property.Images.First().BlobUrl
                            : null,
                        // Tenants
                        Tenants = _mapper.Map<List<LoadTenantDto>>(tenants),
                        // Calculate next due date (though it's not really applicable for history)
                        NextDueDate = Utils.RentCalculator.CalculateNextDueDate(history.StartDate, history.EndDate, history.RentDueDay)
                    };

                    result.Add(leaseDto);
                }

                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease history for organization {OrganizationId}", organizationId);
                throw new Exception($"Error retrieving lease history for organization {organizationId}", ex);
            }
        }

        public async Task<bool> RemoveTenantFromLease(long leaseId, long tenantId)
        {
            try
            {
                // Find the TenantLease relationship
                var tenantLease = await _context.TenantLeases
                    .FirstOrDefaultAsync(tl => tl.LeaseId == leaseId && tl.TenantId == tenantId);

                if (tenantLease == null)
                {
                    _logger.LogWarning("TenantLease relationship not found for LeaseId {LeaseId} and TenantId {TenantId}", leaseId, tenantId);
                    return false;
                }

                // Remove the relationship (this does NOT delete the tenant or lease)
                _context.TenantLeases.Remove(tenantLease);
                await _context.SaveChangesAsync();

                _logger.LogInformation("Removed tenant {TenantId} from lease {LeaseId}", tenantId, leaseId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error removing tenant {TenantId} from lease {LeaseId}", tenantId, leaseId);
                throw new Exception($"Error removing tenant from lease", ex);
            }
        }

        public async Task<bool> AddTenantToLease(long leaseId, long tenantId)
        {
            try
            {
                var alreadyExists = await _context.TenantLeases
                    .AnyAsync(tl => tl.LeaseId == leaseId && tl.TenantId == tenantId);
                if (alreadyExists)
                    return true;

                _context.TenantLeases.Add(new TenantLease
                {
                    LeaseId = leaseId,
                    TenantId = tenantId,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();
                _logger.LogInformation("Added tenant {TenantId} to lease {LeaseId}", tenantId, leaseId);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding tenant {TenantId} to lease {LeaseId}", tenantId, leaseId);
                throw new Exception("Error adding tenant to lease", ex);
            }
        }

        public async Task<LoadLeaseDto?> GetLeaseByIdForAdminAsync(long leaseId)
        {
            try
            {
                var lease = await _context.Leases
                    .AsNoTracking()
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                            .ThenInclude(p => p.Images)
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                            .ThenInclude(p => p.Landlord)
                    .Include(l => l.TenantLeases)
                        .ThenInclude(tl => tl.Tenant)
                    .Include(l => l.LeaseFees)
                    .Include(l => l.LeaseLandlords)
                    .Include(l => l.LeaseDeposits)
                    .Include(l => l.Pets)
                    .Include(l => l.Parking)
                    .Include(l => l.UtilityServiceResponsibilities)
                    .Include(l => l.MaintenanceResponsibilities)
                    .Include(l => l.LeaseKeys)
                    .Include(l => l.LeaseCoSigners)
                    .Include(l => l.LeaseAdditionalSigners)
                    .Include(l => l.LeaseOccupants)
                    .Include(l => l.LeaseAgreement)
                    .Where(l => l.Id == leaseId && !l.IsDeleted)
                    .FirstOrDefaultAsync();

                return lease == null ? null : _mapper.Map<LoadLeaseDto>(lease);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving lease with ID {LeaseId} for admin", leaseId);
                throw new Exception($"Error retrieving lease with ID {leaseId}", ex);
            }
        }

        public async Task<List<AdminLeaseOptionDto>> GetLeasesForAdminListAsync()
        {
            try
            {
                var leases = await _context.Leases
                    .AsNoTracking()
                    .Include(l => l.Unit)
                        .ThenInclude(u => u.Property)
                    .Where(l => l.IsActive && !l.IsDeleted &&
                                !_context.LeaseAgreements.Any(la => la.LeaseId == l.Id && la.IsDrafted == true))
                    .OrderBy(l => l.Unit != null && l.Unit.Property != null ? (l.Unit.Property.Name ?? "") : "")
                    .ThenBy(l => l.Unit != null ? (l.Unit.Name ?? "") : "")
                    .ToListAsync();

                return leases.Select(l =>
                {
                    var propName = l.Unit?.Property?.Name?.Trim() ?? "";
                    var unitName = l.Unit?.Name?.Trim() ?? "";
                    var label = string.IsNullOrEmpty(propName) && string.IsNullOrEmpty(unitName)
                        ? $"Lease #{l.Id}"
                        : string.IsNullOrEmpty(unitName)
                            ? $"{propName} (Lease #{l.Id})"
                            : $"{propName} – {unitName} (Lease #{l.Id})";
                    return new AdminLeaseOptionDto { Id = l.Id, Label = label };
                }).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leases for admin list");
                throw new Exception("Error retrieving leases for admin list", ex);
            }
        }
    }
}