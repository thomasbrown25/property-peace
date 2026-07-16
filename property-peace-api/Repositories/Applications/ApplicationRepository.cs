using AutoMapper;
using brownstone_hub_api.Data;
using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Enums;
using Microsoft.EntityFrameworkCore;

namespace brownstone_hub_api.Repositories.Applications
{
    public class ApplicationRepository(DataContext context, IMapper mapper, ILogger<ApplicationRepository> logger) : IApplicationRepository
    {
        private readonly DataContext _context = context;
        private readonly IMapper _mapper = mapper;
        private readonly ILogger<ApplicationRepository> _logger = logger;

        public async Task<LoadRentalApplicationDto> AddApplication(AddRentalApplicationDto application, long landlordId, long? organizationId = null)
        {
            try
            {
                var entity = _mapper.Map<Models.RentalApplication>(application);
                
                // Set submitted date if status is Submitted
                if (application.Status == EApplicationStatus.Submitted)
                {
                    entity.SubmittedAt = DateTime.Now;
                }
                
                // Set LandlordId
                entity.LandlordId = landlordId;
                
                // Set organizationId if provided, otherwise try to get it from property
                if (organizationId.HasValue)
                {
                    entity.OrganizationId = organizationId.Value;
                }
                else
                {
                    var property = await _context.Properties.FindAsync(application.PropertyId);
                    if (property?.OrganizationId != null)
                    {
                        entity.OrganizationId = property.OrganizationId;
                    }
                }
                
                // Log to verify UnitId is being set correctly
                _logger.LogInformation("Adding application: PropertyId={PropertyId}, UnitId={UnitId}, Status={Status}, LandlordId={LandlordId}", 
                    entity.PropertyId, entity.UnitId, entity.Status, entity.LandlordId);
                
                await _context.RentalApplications.AddAsync(entity);
                await _context.SaveChangesAsync();
                
                // Log after save to verify UnitId was saved
                _logger.LogInformation("Application created: Id={Id}, PropertyId={PropertyId}, UnitId={UnitId}, Status={Status}", 
                    entity.Id, entity.PropertyId, entity.UnitId, entity.Status);

                // Reload with related entities
                await _context.Entry(entity).Reference(e => e.Property).LoadAsync();
                if (entity.UnitId.HasValue)
                {
                    await _context.Entry(entity).Reference(e => e.Unit).LoadAsync();
                }
                await _context.Entry(entity).Reference(e => e.Landlord).LoadAsync();

                return MapToDto(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding application for landlord {LandlordId}", landlordId);
                throw;
            }
        }

        public async Task<LoadRentalApplicationDto?> GetApplicationById(long id)
        {
            try
            {
                var application = await _context.RentalApplications
                    .Include(a => a.Property)
                    .Include(a => a.Unit)
                    .Include(a => a.Landlord)
                    .Include(a => a.ConvertedToTenant)
                    .Include(a => a.ConvertedToLease)
                    .FirstOrDefaultAsync(a => a.Id == id);

                return application == null ? null : MapToDto(application);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving application with ID {ApplicationId}", id);
                throw;
            }
        }

        public async Task<List<LoadRentalApplicationDto>> GetApplicationsByLandlordId(long landlordId)
        {
            try
            {
                var applications = await _context.RentalApplications
                    .Include(a => a.Property)
                    .Include(a => a.Unit)
                    .Include(a => a.Landlord)
                    .Where(a => a.LandlordId == landlordId)
                    .OrderByDescending(a => a.CreatedAt)
                    .ToListAsync();

                return applications.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving applications for landlord {LandlordId}", landlordId);
                throw;
            }
        }

        public async Task<List<LoadRentalApplicationDto>> GetApplicationsByPropertyId(long propertyId)
        {
            try
            {
                var applications = await _context.RentalApplications
                    .Include(a => a.Property)
                    .Include(a => a.Unit)
                    .Include(a => a.Landlord)
                    .Where(a => a.PropertyId == propertyId)
                    .OrderByDescending(a => a.CreatedAt)
                    .ToListAsync();

                return applications.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving applications for property {PropertyId}", propertyId);
                throw;
            }
        }

        public async Task<List<LoadRentalApplicationDto>> GetApplicationsByStatus(long landlordId, EApplicationStatus status)
        {
            try
            {
                var applications = await _context.RentalApplications
                    .Include(a => a.Property)
                    .Include(a => a.Unit)
                    .Include(a => a.Landlord)
                    .Where(a => a.LandlordId == landlordId && a.Status == status)
                    .OrderByDescending(a => a.CreatedAt)
                    .ToListAsync();

                return applications.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving applications for landlord {LandlordId} with status {Status}", landlordId, status);
                throw;
            }
        }

        public async Task<List<LoadRentalApplicationDto>> GetApplicationsByOrganizationId(long organizationId)
        {
            try
            {
                var applications = await _context.RentalApplications
                    .Include(a => a.Property)
                    .Include(a => a.Unit)
                    .Include(a => a.Landlord)
                    .Where(a => a.OrganizationId == organizationId)
                    .OrderByDescending(a => a.CreatedAt)
                    .ToListAsync();

                return applications.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving applications for organization {OrganizationId}", organizationId);
                throw;
            }
        }

        public async Task<List<LoadRentalApplicationDto>> GetApplicationsByStatusAndOrganizationId(long organizationId, EApplicationStatus status)
        {
            try
            {
                var applications = await _context.RentalApplications
                    .Include(a => a.Property)
                    .Include(a => a.Unit)
                    .Include(a => a.Landlord)
                    .Where(a => a.OrganizationId == organizationId && a.Status == status)
                    .OrderByDescending(a => a.CreatedAt)
                    .ToListAsync();

                return applications.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving applications for organization {OrganizationId} with status {Status}", organizationId, status);
                throw;
            }
        }

        public async Task<LoadRentalApplicationDto> UpdateApplication(UpdateRentalApplicationDto application)
        {
            try
            {
                var entity = await _context.RentalApplications
                    .FirstOrDefaultAsync(a => a.Id == application.Id);

                if (entity == null)
                {
                    throw new KeyNotFoundException($"Application with ID {application.Id} not found.");
                }

            // Update status-specific fields
            if (application.Status.HasValue)
            {
                var oldStatus = entity.Status;
                entity.Status = application.Status.Value;
                
                // Set submitted date if transitioning to Submitted
                if (application.Status.Value == EApplicationStatus.Submitted && oldStatus != EApplicationStatus.Submitted)
                {
                    entity.SubmittedAt = DateTime.Now;
                }
                
                // Set reviewed date if transitioning to Approved or Rejected
                if ((application.Status.Value == EApplicationStatus.Approved || 
                     application.Status.Value == EApplicationStatus.Rejected) && 
                    oldStatus != application.Status.Value)
                {
                    entity.ReviewedAt = DateTime.Now;
                }
            }

            // Update other fields
            if (!string.IsNullOrEmpty(application.FirstName)) entity.FirstName = application.FirstName;
            if (!string.IsNullOrEmpty(application.LastName)) entity.LastName = application.LastName;
            if (!string.IsNullOrEmpty(application.Email)) entity.Email = application.Email;
            if (application.PhoneNumber != null) entity.PhoneNumber = application.PhoneNumber;
            if (application.DateOfBirth.HasValue) entity.DateOfBirth = application.DateOfBirth;
            if (application.Ssn != null) entity.Ssn = application.Ssn;
            if (application.CurrentAddress != null) entity.CurrentAddress = application.CurrentAddress;
            if (application.CurrentCity != null) entity.CurrentCity = application.CurrentCity;
            if (application.CurrentState != null) entity.CurrentState = application.CurrentState;
            if (application.CurrentZipCode != null) entity.CurrentZipCode = application.CurrentZipCode;
            if (application.EmployerName != null) entity.EmployerName = application.EmployerName;
            if (application.JobTitle != null) entity.JobTitle = application.JobTitle;
            if (application.MonthlyIncome.HasValue) entity.MonthlyIncome = application.MonthlyIncome;
            if (application.EmploymentMonths.HasValue) entity.EmploymentMonths = application.EmploymentMonths;
            if (application.EmergencyContactName != null) entity.EmergencyContactName = application.EmergencyContactName;
            if (application.EmergencyContactPhone != null) entity.EmergencyContactPhone = application.EmergencyContactPhone;
            if (application.EmergencyContactRelationship != null) entity.EmergencyContactRelationship = application.EmergencyContactRelationship;
            if (application.PreviousLandlordName != null) entity.PreviousLandlordName = application.PreviousLandlordName;
            if (application.PreviousLandlordPhone != null) entity.PreviousLandlordPhone = application.PreviousLandlordPhone;
            if (application.NumberOfOccupants.HasValue) entity.NumberOfOccupants = application.NumberOfOccupants;
            if (application.HasPets.HasValue) entity.HasPets = application.HasPets.Value;
            if (application.PetDetails != null) entity.PetDetails = application.PetDetails;
            if (application.HasVehicles.HasValue) entity.HasVehicles = application.HasVehicles.Value;
            if (application.VehicleDetails != null) entity.VehicleDetails = application.VehicleDetails;
            if (application.DesiredMoveInDate.HasValue) entity.DesiredMoveInDate = application.DesiredMoveInDate;
            if (application.AdditionalNotes != null) entity.AdditionalNotes = application.AdditionalNotes;
            if (application.RejectionReason != null) entity.RejectionReason = application.RejectionReason;
            if (application.ReviewNotes != null) entity.ReviewNotes = application.ReviewNotes;
            if (application.ConvertedToTenantId.HasValue) entity.ConvertedToTenantId = application.ConvertedToTenantId;
            if (application.ConvertedToLeaseId.HasValue) entity.ConvertedToLeaseId = application.ConvertedToLeaseId;
            
            // Update background check fields
            if (application.BackgroundCheckRequested.HasValue) entity.BackgroundCheckRequested = application.BackgroundCheckRequested.Value;
            if (application.BackgroundCheckRequestedAt.HasValue) entity.BackgroundCheckRequestedAt = application.BackgroundCheckRequestedAt.Value;
            if (application.BackgroundCheckProvider != null) entity.BackgroundCheckProvider = application.BackgroundCheckProvider;
            if (application.BackgroundCheckRequestId != null) entity.BackgroundCheckRequestId = application.BackgroundCheckRequestId;
            if (application.BackgroundCheckStatus != null) entity.BackgroundCheckStatus = application.BackgroundCheckStatus;
            if (application.BackgroundCheckCompletedAt.HasValue) entity.BackgroundCheckCompletedAt = application.BackgroundCheckCompletedAt.Value;
            if (application.CreditScore.HasValue) entity.CreditScore = application.CreditScore.Value;
            if (application.PassedCreditCheck.HasValue) entity.PassedCreditCheck = application.PassedCreditCheck.Value;
            if (application.PassedCriminalCheck.HasValue) entity.PassedCriminalCheck = application.PassedCriminalCheck.Value;
            if (application.PassedEvictionCheck.HasValue) entity.PassedEvictionCheck = application.PassedEvictionCheck.Value;
            if (application.PassedIncomeVerification.HasValue) entity.PassedIncomeVerification = application.PassedIncomeVerification.Value;
            if (application.BackgroundCheckReportUrl != null) entity.BackgroundCheckReportUrl = application.BackgroundCheckReportUrl;
            if (application.BackgroundCheckSummary != null) entity.BackgroundCheckSummary = application.BackgroundCheckSummary;
            if (application.BackgroundCheckOverallPass.HasValue) entity.BackgroundCheckOverallPass = application.BackgroundCheckOverallPass.Value;
            if (application.BackgroundCheckRejectionReason != null) entity.BackgroundCheckRejectionReason = application.BackgroundCheckRejectionReason;

            entity.UpdatedAt = DateTime.Now;

            await _context.SaveChangesAsync();

            // Reload with related entities
            await _context.Entry(entity).Reference(e => e.Property).LoadAsync();
            if (entity.UnitId.HasValue)
            {
                await _context.Entry(entity).Reference(e => e.Unit).LoadAsync();
            }
            await _context.Entry(entity).Reference(e => e.Landlord).LoadAsync();

                return MapToDto(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating application {ApplicationId}", application.Id);
                throw;
            }
        }

        public async Task<bool> DeleteApplication(long id)
        {
            try
            {
                var entity = await _context.RentalApplications.FindAsync(id);
                if (entity == null)
                {
                    return false;
                }

                _context.RentalApplications.Remove(entity);
                await _context.SaveChangesAsync();
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting application {ApplicationId}", id);
                throw;
            }
        }

        public async Task<LoadRentalApplicationDto> UpdateApplicationPdfFields(long applicationId, string pdfBlobName, string pdfBlobUrl)
        {
            try
            {
                var entity = await _context.RentalApplications
                    .FirstOrDefaultAsync(a => a.Id == applicationId);

                if (entity == null)
                {
                    throw new KeyNotFoundException($"Application with ID {applicationId} not found.");
                }

                entity.PdfBlobName = pdfBlobName;
                entity.PdfBlobUrl = pdfBlobUrl;
                entity.UpdatedAt = DateTime.Now;

                await _context.SaveChangesAsync();

                // Reload with related entities
                await _context.Entry(entity).Reference(e => e.Property).LoadAsync();
                if (entity.UnitId.HasValue)
                {
                    await _context.Entry(entity).Reference(e => e.Unit).LoadAsync();
                }
                await _context.Entry(entity).Reference(e => e.Landlord).LoadAsync();

                return MapToDto(entity);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating PDF fields for application {ApplicationId}", applicationId);
                throw;
            }
        }

        public async Task<Models.RentalApplication?> GetApplicationEntityById(long id)
        {
            try
            {
                return await _context.RentalApplications
                    .Include(a => a.Property)
                    .Include(a => a.Unit)
                    .Include(a => a.Landlord)
                    .FirstOrDefaultAsync(a => a.Id == id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving application entity with ID {ApplicationId}", id);
                throw;
            }
        }

        public async Task<List<LoadRentalApplicationDto>> GetApplicationsByTenantEmail(string email)
        {
            try
            {
                var applications = await _context.RentalApplications
                    .Include(a => a.Property)
                    .Include(a => a.Unit)
                    .Include(a => a.Landlord)
                    .Where(a => a.Email.ToLower() == email.ToLower())
                    .OrderByDescending(a => a.CreatedAt)
                    .ToListAsync();

                return applications.Select(MapToDto).ToList();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving applications for email {Email}", email);
                throw;
            }
        }

        private static LoadRentalApplicationDto MapToDto(Models.RentalApplication application)
        {
            return new LoadRentalApplicationDto
            {
                Id = application.Id,
                Status = application.Status,
                StatusName = application.Status.ToString(),
                PropertyId = application.PropertyId,
                PropertyName = application.Property?.Name ?? string.Empty,
                UnitId = application.UnitId,
                UnitName = application.Unit?.Name ?? null,
                FirstName = application.FirstName,
                LastName = application.LastName,
                Email = application.Email,
                PhoneNumber = application.PhoneNumber,
                DateOfBirth = application.DateOfBirth,
                CurrentAddress = application.CurrentAddress,
                CurrentCity = application.CurrentCity,
                CurrentState = application.CurrentState,
                CurrentZipCode = application.CurrentZipCode,
                EmployerName = application.EmployerName,
                JobTitle = application.JobTitle,
                MonthlyIncome = application.MonthlyIncome,
                EmploymentMonths = application.EmploymentMonths,
                EmergencyContactName = application.EmergencyContactName,
                EmergencyContactPhone = application.EmergencyContactPhone,
                EmergencyContactRelationship = application.EmergencyContactRelationship,
                PreviousLandlordName = application.PreviousLandlordName,
                PreviousLandlordPhone = application.PreviousLandlordPhone,
                NumberOfOccupants = application.NumberOfOccupants,
                HasPets = application.HasPets,
                PetDetails = application.PetDetails,
                HasVehicles = application.HasVehicles,
                VehicleDetails = application.VehicleDetails,
                DesiredMoveInDate = application.DesiredMoveInDate,
                AdditionalNotes = application.AdditionalNotes,
                RejectionReason = application.RejectionReason,
                ReviewNotes = application.ReviewNotes,
                SubmittedAt = application.SubmittedAt,
                ReviewedAt = application.ReviewedAt,
                ReviewedBy = application.ReviewedBy,
                ConvertedToTenantId = application.ConvertedToTenantId,
                ConvertedToLeaseId = application.ConvertedToLeaseId,
                LandlordId = application.LandlordId,
                OrganizationId = application.OrganizationId,
                PdfBlobName = application.PdfBlobName,
                PdfBlobUrl = application.PdfBlobUrl,
                BackgroundCheckRequested = application.BackgroundCheckRequested,
                BackgroundCheckRequestedAt = application.BackgroundCheckRequestedAt,
                BackgroundCheckProvider = application.BackgroundCheckProvider,
                BackgroundCheckRequestId = application.BackgroundCheckRequestId,
                BackgroundCheckStatus = application.BackgroundCheckStatus,
                BackgroundCheckCompletedAt = application.BackgroundCheckCompletedAt,
                CreditScore = application.CreditScore,
                PassedCreditCheck = application.PassedCreditCheck,
                PassedCriminalCheck = application.PassedCriminalCheck,
                PassedEvictionCheck = application.PassedEvictionCheck,
                PassedIncomeVerification = application.PassedIncomeVerification,
                BackgroundCheckReportUrl = application.BackgroundCheckReportUrl,
                BackgroundCheckSummary = application.BackgroundCheckSummary,
                BackgroundCheckOverallPass = application.BackgroundCheckOverallPass,
                BackgroundCheckRejectionReason = application.BackgroundCheckRejectionReason,
                IsLandlordEntered = application.IsLandlordEntered,
                CreatedAt = application.CreatedAt,
                UpdatedAt = application.UpdatedAt
            };
        }

        public async Task<int> DeleteApplicationsByPropertyId(long propertyId)
        {
            try
            {
                var applications = await _context.RentalApplications
                    .Where(ra => ra.PropertyId == propertyId)
                    .ToListAsync();
                
                _context.RentalApplications.RemoveRange(applications);
                await _context.SaveChangesAsync();
                
                return applications.Count;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting applications for property {PropertyId}", propertyId);
                throw;
            }
        }
    }
}

