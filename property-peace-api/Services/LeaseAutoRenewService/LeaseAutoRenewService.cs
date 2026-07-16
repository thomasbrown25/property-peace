using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Azure.Storage.Blobs;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.LeaseGeneration;
using brownstone_hub_api.Dtos.TenantDocument;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Repositories.LeaseInstances;
using brownstone_hub_api.Repositories.Leases;
using brownstone_hub_api.Repositories.LeaseTemplates;
using brownstone_hub_api.Repositories.TenantDocuments;
using brownstone_hub_api.Services.LeaseDocumentService;
using brownstone_hub_api.Services.LeaseGenerationService;
using Microsoft.Extensions.Logging;

namespace brownstone_hub_api.Services.LeaseAutoRenewService
{
    public class LeaseAutoRenewService : ILeaseAutoRenewService
    {
        private readonly ILeaseRepository _leaseRepository;
        private readonly ILeaseGenerationService _leaseGenerationService;
        private readonly ILeaseDocumentService _leaseDocumentService;
        private readonly ILeaseInstanceRepository _leaseInstanceRepository;
        private readonly ILeaseTemplateRepository _templateRepository;
        private readonly ITenantDocumentRepository _tenantDocumentRepository;
        private readonly BlobServiceClient _blobServiceClient;
        private readonly ILogger<LeaseAutoRenewService> _logger;

        public LeaseAutoRenewService(
            ILeaseRepository leaseRepository,
            ILeaseGenerationService leaseGenerationService,
            ILeaseDocumentService leaseDocumentService,
            ILeaseInstanceRepository leaseInstanceRepository,
            ILeaseTemplateRepository templateRepository,
            ITenantDocumentRepository tenantDocumentRepository,
            BlobServiceClient blobServiceClient,
            ILogger<LeaseAutoRenewService> logger)
        {
            _leaseRepository = leaseRepository;
            _leaseGenerationService = leaseGenerationService;
            _leaseDocumentService = leaseDocumentService;
            _leaseInstanceRepository = leaseInstanceRepository;
            _templateRepository = templateRepository;
            _tenantDocumentRepository = tenantDocumentRepository;
            _blobServiceClient = blobServiceClient;
            _logger = logger;
        }

        public async Task ProcessAutoRenewalsAsync(DateTime? asOfDate = null)
        {
            var date = (asOfDate ?? DateTime.UtcNow).Date;
            var candidates = await _leaseRepository.GetLeasesEndingOnOrBeforeForAutoRenew(date);
            _logger.LogInformation("Auto-renew: found {Count} lease(s) ending on or before {Date}", candidates.Count, date);

            foreach (var item in candidates)
            {
                if (!item.OrganizationId.HasValue)
                    continue;
                try
                {
                    await ProcessOneLeaseAsync(item.Id, item.OrganizationId.Value, date);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Auto-renew failed for lease {LeaseId}", item.Id);
                }
            }
        }

        private async Task ProcessOneLeaseAsync(long sourceLeaseId, long organizationId, DateTime asOfDate)
        {
            var lease = await _leaseRepository.GetLeaseById(sourceLeaseId, organizationId);
            if (lease == null || !lease.EndDate.HasValue)
            {
                _logger.LogWarning("Auto-renew: lease {LeaseId} not found or has no end date", sourceLeaseId);
                return;
            }

            var configuredRenewalLength = lease.AutoRenewLeaseLength ?? lease.LeaseLength;
            var isMonthToMonthRenewal = configuredRenewalLength == -1;
            var termMonths = isMonthToMonthRenewal ? 1 : configuredRenewalLength ?? (lease.StartDate.HasValue && lease.EndDate.HasValue
                ? (lease.EndDate.Value.Year - lease.StartDate.Value.Year) * 12 + (lease.EndDate.Value.Month - lease.StartDate.Value.Month)
                : 12);
            if (termMonths <= 0) termMonths = 12;

            var newStartDate = lease.EndDate.Value.Date.AddDays(1);
            var newEndDate = newStartDate.AddMonths(termMonths);

            var oldRent = lease.RentAmount ?? 0m;
            var newRent = oldRent;
            if (lease.AutoRenewRentIncrement == true && lease.AutoRenewRentIncrementValue.HasValue)
            {
                var type = (lease.AutoRenewRentIncrementType ?? "").Trim().ToLowerInvariant();
                if (type == "percentage")
                    newRent = Math.Round(oldRent * (1 + lease.AutoRenewRentIncrementValue.Value / 100m), 2);
                else
                    newRent = Math.Round(oldRent + lease.AutoRenewRentIncrementValue.Value, 2);
            }

            await _leaseRepository.EndLease(sourceLeaseId);

            var updateDto = BuildUpdateLeaseDtoForRenewal(lease, newStartDate, newEndDate, newRent, isMonthToMonthRenewal ? -1 : termMonths);
            var newLease = await _leaseRepository.AddLease(updateDto, organizationId);

            await _leaseRepository.CopyLeaseRelatedEntitiesToNewLeaseAsync(sourceLeaseId, newLease.Id);

            _logger.LogInformation("Auto-renew: completed for source lease {SourceId}, new lease {NewId}", sourceLeaseId, newLease.Id);
        }

        private static UpdateLeaseDto BuildUpdateLeaseDtoForRenewal(LoadLeaseDto source, DateTime newStartDate, DateTime newEndDate, decimal newRent, int termMonths)
        {
            var dto = new UpdateLeaseDto
            {
                Id = 0,
                PropertyId = source.PropertyId,
                UnitId = source.UnitId,
                Name = source.Name,
                StartDate = newStartDate,
                EndDate = newEndDate,
                RentAmount = newRent,
                DepositAmount = source.DepositAmount,
                LeaseLength = termMonths,
                RentFrequency = source.RentFrequency,
                RentDueDay = source.RentDueDay ?? 1,
                IsActive = true,
                IsDrafted = true,
                OrganizationId = source.OrganizationId,
                OperatingAccountId = source.OperatingAccountId,
                ProratedRentDue = source.ProratedRentDue,
                IsProratedRent = source.IsProratedRent,
                PetDepositAmount = source.PetDepositAmount,
                RentCollectionByPlatform = source.RentCollectionByPlatform,
                RentCollectionOther = source.RentCollectionOther,
                RentCollectionOtherOptions = source.RentCollectionOtherOptions,
                RentCollectionOtherSpecify = source.RentCollectionOtherSpecify,
                AddTenantsLater = source.AddTenantsLater,
                TenantMailingAddressDiffers = source.TenantMailingAddressDiffers,
                TenantMailingStreetAddress = source.TenantMailingStreetAddress,
                TenantMailingUnit = source.TenantMailingUnit,
                TenantMailingCity = source.TenantMailingCity,
                TenantMailingState = source.TenantMailingState,
                TenantMailingZipCode = source.TenantMailingZipCode,
                PetsAllowed = source.PetsAllowed,
                SmokingAllowed = source.SmokingAllowed,
                HasSharedUtilities = source.HasSharedUtilities,
                SharedUtilitiesDisclosure = source.SharedUtilitiesDisclosure,
                MaintenanceNotificationMethods = source.MaintenanceNotificationMethods,
                IncludeEarlyTerminationClause = source.IncludeEarlyTerminationClause,
                EarlyTerminationClauseText = source.EarlyTerminationClauseText,
                AdditionalTerms = source.AdditionalTerms,
                BuiltBefore1978 = source.BuiltBefore1978,
                AwareOfLeadPaint = source.AwareOfLeadPaint,
                LeadPaintExplanation = source.LeadPaintExplanation,
                HasLeadPaintRecords = source.HasLeadPaintRecords,
                LeadPaintRecordsExplanation = source.LeadPaintRecordsExplanation,
                AutoRenewLease = source.AutoRenewLease,
                AutoRenewLeaseLength = source.AutoRenewLeaseLength ?? source.LeaseLength,
                AutoRenewRentIncrement = source.AutoRenewRentIncrement,
                AutoRenewRentIncrementType = source.AutoRenewRentIncrementType,
                AutoRenewRentIncrementValue = source.AutoRenewRentIncrementValue,
                Fees = source.Fees?.ToList(),
                LeaseDeposits = source.LeaseDeposits?.ToList(),
                LeaseLandlords = source.LeaseLandlords?.ToList(),
                LeaseCoSigners = source.LeaseCoSigners?.ToList(),
                LeaseAdditionalSigners = source.LeaseAdditionalSigners?.ToList(),
                LeaseOccupants = source.LeaseOccupants?.ToList(),
                Pets = source.Pets?.ToList(),
                Parking = source.Parking,
                UtilityServiceResponsibilities = source.UtilityServiceResponsibilities?.ToList(),
                MaintenanceResponsibilities = source.MaintenanceResponsibilities?.ToList(),
                LeaseKeys = source.LeaseKeys?.ToList()
            };
            return dto;
        }

        private async Task CreateTenantDocumentsFromLeaseInstanceAsync(Models.LeaseInstance instance, string sourceBlobUrl, byte[] pdfBytes)
        {
            var lease = instance.Lease;
            if (lease == null || lease.TenantLeases == null || !lease.TenantLeases.Any())
                return;

            var tenantDocumentsContainer = _blobServiceClient.GetBlobContainerClient("tenant-documents");
            await tenantDocumentsContainer.CreateIfNotExistsAsync();

            var fileName = $"lease-agreement-{lease.Id}-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
            var blobName = $"{Guid.NewGuid()}.pdf";
            var blobClient = tenantDocumentsContainer.GetBlobClient(blobName);

            using (var stream = new MemoryStream(pdfBytes))
            {
                await blobClient.UploadAsync(stream, overwrite: true);
                await blobClient.SetHttpHeadersAsync(new Azure.Storage.Blobs.Models.BlobHttpHeaders { ContentType = "application/pdf" });
            }

            var blobUrl = blobClient.Uri.ToString();
            var organizationId = lease.Unit?.Property?.OrganizationId;

            foreach (var tenantLease in lease.TenantLeases)
            {
                var tenant = tenantLease.Tenant;
                if (tenant == null) continue;
                try
                {
                    var documentDto = new AddTenantDocumentDto
                    {
                        TenantId = tenant.Id,
                        FileName = fileName,
                        Description = "Lease Agreement (Generated from Lease Builder)",
                        DocumentType = ETenantDocumentType.LeaseAgreement,
                        ExpirationDate = null,
                        IsRequired = false,
                        LeaseId = lease.Id,
                        BlobName = blobName,
                        BlobUrl = blobUrl
                    };
                    await _tenantDocumentRepository.AddTenantDocument(documentDto, organizationId);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Auto-renew: failed to create tenant document for tenant {TenantId} lease {LeaseId}", tenant.Id, lease.Id);
                }
            }
        }
    }
}
