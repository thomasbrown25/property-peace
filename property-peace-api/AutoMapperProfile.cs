using AutoMapper;
using AutoMapper.Internal;
using brownstone_hub_api.Dtos.Amenity;
using brownstone_hub_api.Dtos.Client;
using brownstone_hub_api.Dtos.Image;
using brownstone_hub_api.Dtos.IncludedUtility;
using brownstone_hub_api.Dtos.Lease;
using brownstone_hub_api.Dtos.LeaseAgreement;
using brownstone_hub_api.Dtos.MaintenanceCategory;
using brownstone_hub_api.Dtos.MaintenanceEvent;
using brownstone_hub_api.Dtos.MaintenanceImage;
using brownstone_hub_api.Dtos.MaintenanceRequest;
using brownstone_hub_api.Dtos.Payment;
using brownstone_hub_api.Dtos.Expense;
using brownstone_hub_api.Dtos.RecurringExpense;
using brownstone_hub_api.Dtos.FutureExpense;
using brownstone_hub_api.Dtos.Property;
using brownstone_hub_api.Dtos.Role;
using brownstone_hub_api.Dtos.Tenant;
using brownstone_hub_api.Dtos.LandlordInvite;
using brownstone_hub_api.Dtos.Unit;
using brownstone_hub_api.Dtos.User;
using brownstone_hub_api.Dtos.UserSetting;
using brownstone_hub_api.Dtos.NotificationSetting;
using brownstone_hub_api.Dtos.Notification;
using brownstone_hub_api.Enums;
using brownstone_hub_api.Utils;
using brownstone_hub_api.Dtos.ExpenseReceipt;
using brownstone_hub_api.Dtos.TenantDocument;
using brownstone_hub_api.Dtos.DocumentTemplate;
using brownstone_hub_api.Dtos.Application;
using brownstone_hub_api.Dtos.ApplicationInvite;
using brownstone_hub_api.Dtos.Checklist;
using brownstone_hub_api.Dtos.Conversation;
using brownstone_hub_api.Dtos.Message;
using brownstone_hub_api.Dtos.Subscription;
using brownstone_hub_api.Dtos.Vendor;
using brownstone_hub_api.Dtos.UpcomingFeature;
using brownstone_hub_api.Dtos.Organization;
using brownstone_hub_api.Dtos.OrganizationMember;
using brownstone_hub_api.Dtos.OrganizationInvite;
using brownstone_hub_api.Dtos.LeaseTemplate;
using brownstone_hub_api.Dtos.PolicyPack;
using brownstone_hub_api.Dtos.LeaseGeneration;
using brownstone_hub_api.Dtos.DemoRequest;
using brownstone_hub_api.Dtos.BankAccount;
using brownstone_hub_api.Dtos.File;
using brownstone_hub_api.Dtos.FileCategory;
using brownstone_hub_api.Dtos.ActionSuppression;
using brownstone_hub_api.Dtos.TimeEntry;
using brownstone_hub_api.Dtos.TimeBreak;
using brownstone_hub_api.Dtos.StaffMember;
using brownstone_hub_api.Dtos.TimeTrackingSettings;
using brownstone_hub_api.Dtos.Client;
using brownstone_hub_api.Dtos.Listing;
using brownstone_hub_api.Models;

namespace brownstone_hub_api;

public class AutoMapperProfile : Profile
{
    public AutoMapperProfile()
    {
        CreateMap<User, LoadUserDto>()
            .ForMember(dest => dest.Roles,
                opt => opt.MapFrom(src => src.UserRoles.Select(ur => ur.Role.RoleName).ToList()))
            .ForMember(dest => dest.HasPassword, opt => opt.MapFrom(src => src.PasswordHash != null && src.PasswordHash.Length > 0));
        CreateMap<AddUserDto, User>();
        CreateMap<User, AddUserDto>();
        CreateMap<Admin, AddUserDto>();
        CreateMap<Admin, LoadUserDto>();
        CreateMap<AddUserDto, Admin>();
        CreateMap<UpdateClientDto, LoadClientDto>();
        CreateMap<AddUserDto, LoadUserDto>();
        CreateMap<LoadUserDto, AddUserDto>()
            .ForMember(dest => dest.Password, opt => opt.Ignore()) // Ignore Password field when mapping back
            .ForMember(dest => dest.PasswordHash, opt => opt.Ignore())
            .ForMember(dest => dest.PasswordSalt, opt => opt.Ignore());
        CreateMap<LoadRoleDto, Role>()
            .ForMember(dest => dest.RoleName, opt => opt.MapFrom(src => src.RoleName))
            .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id));
        CreateMap<Role, LoadRoleDto>()
            .ForMember(dest => dest.RoleName, opt => opt.MapFrom(src => src.RoleName))
            .ForMember(dest => dest.Id, opt => opt.MapFrom(src => src.Id));
        CreateMap<AddUserRoleDto, UserRole>()
            .ForMember(dest => dest.UserId, opt => opt.MapFrom(src => src.UserId))
            .ForMember(dest => dest.RoleId, opt => opt.MapFrom(src => src.RoleId));
        CreateMap<SettingsDto, UserSettings>();
        CreateMap<UserSettings, SettingsDto>();

        // Notification Settings
        CreateMap<NotificationSetting, NotificationSettingDto>()
            .ForMember(dest => dest.RentReminders, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.RentRemindersEmail,
                Phone = src.RentRemindersPhone,
                InApp = src.RentRemindersInApp
            }))
            .ForMember(dest => dest.OverdueAlerts, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.OverdueAlertsEmail,
                Phone = src.OverdueAlertsPhone,
                InApp = src.OverdueAlertsInApp
            }))
            .ForMember(dest => dest.PaymentConfirmations, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.PaymentConfirmationsEmail,
                Phone = src.PaymentConfirmationsPhone,
                InApp = src.PaymentConfirmationsInApp
            }))
            .ForMember(dest => dest.MaintenanceUpdates, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.MaintenanceUpdatesEmail,
                Phone = src.MaintenanceUpdatesPhone,
                InApp = src.MaintenanceUpdatesInApp
            }))
            .ForMember(dest => dest.LeaseExpiration, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.LeaseExpirationEmail,
                Phone = src.LeaseExpirationPhone,
                InApp = src.LeaseExpirationInApp
            }))
            .ForMember(dest => dest.NewTenantNotifications, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.NewTenantNotificationsEmail,
                Phone = src.NewTenantNotificationsPhone,
                InApp = src.NewTenantNotificationsInApp
            }))
            .ForMember(dest => dest.ApplicationCompletion, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.ApplicationCompletionEmail,
                Phone = src.ApplicationCompletionPhone,
                InApp = src.ApplicationCompletionInApp
            }))
            .ForMember(dest => dest.TenantMessages, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.TenantMessagesEmail,
                Phone = src.TenantMessagesPhone,
                InApp = src.TenantMessagesInApp
            }))
            .ForMember(dest => dest.DailySummaryEmail, opt => opt.MapFrom(src => src.DailySummaryEmail))
            .ForMember(dest => dest.AdminSubscriptionNotifications, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.AdminSubscriptionNotificationsEmail,
                Phone = src.AdminSubscriptionNotificationsPhone,
                InApp = src.AdminSubscriptionNotificationsInApp
            }))
            .ForMember(dest => dest.AdminNewUserNotifications, opt => opt.MapFrom(src => new NotificationPreferenceDto
            {
                Email = src.AdminNewUserNotificationsEmail,
                Phone = src.AdminNewUserNotificationsPhone,
                InApp = src.AdminNewUserNotificationsInApp
            }));
        CreateMap<AddUnitDto, Unit>();
        CreateMap<Dtos.Amenity.AmenityDto, Amenity>();
        CreateMap<IncludedUtilityDto, IncludedUtility>();
        CreateMap<Unit, AddUnitDto>();
        CreateMap<LoadUnitDto, AddUnitDto>();
        CreateMap<AddUnitDto, LoadUnitDto>();
        CreateMap<Amenity, Dtos.Amenity.AmenityDto>();
        CreateMap<IncludedUtility, IncludedUtilityDto>();

        CreateMap<Property, LoadPropertyDto>()
            .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => !src.IsDeleted))
            .ForMember(dest => dest.PrimaryManagerName, opt => opt.MapFrom(src => src.PrimaryManager != null ? $"{src.PrimaryManager.FirstName} {src.PrimaryManager.LastName}".Trim() : null))
            .ForMember(dest => dest.ClientName, opt => opt.MapFrom(src => src.Client != null ? $"{src.Client.FirstName} {src.Client.LastName}".Trim() : null));
        CreateMap<UpdatePropertyDto, Property>();
        CreateMap<Property, UpdatePropertyDto>();
        CreateMap<LoadPropertyDto, UpdatePropertyDto>();
        CreateMap<UpdatePropertyDto, LoadPropertyDto>();

        CreateMap<LoadMaintenanceRequestDto, MaintenanceRequest>();
        CreateMap<MaintenanceRequest, LoadMaintenanceRequestDto>()
        .ForMember(dest => dest.PropertyType,
                       opt => opt.MapFrom(src => src.Property != null ? src.Property.PropertyType.ToString() : null))
        .ForMember(dest => dest.PropertyName,
                       opt => opt.MapFrom(src => src.Property != null
                           ? (!string.IsNullOrWhiteSpace(src.Property.Name) ? src.Property.Name : src.Property.StreetAddress ?? string.Empty)
                           : string.Empty))
        .ForMember(dest => dest.UnitName,
                       opt => opt.MapFrom(src => src.Unit != null ? src.Unit.Name : (!string.IsNullOrEmpty(src.UnitName) ? src.UnitName : string.Empty)))
        .ForMember(dest => dest.VendorId, opt => opt.MapFrom(src => src.VendorId))
        .ForMember(dest => dest.VendorName, opt => opt.MapFrom(src => src.VendorEntity != null ? src.VendorEntity.Name : null))
        .ForMember(dest => dest.VendorEmail, opt => opt.MapFrom(src => src.VendorEntity != null ? src.VendorEntity.Email : null))
        .ForMember(dest => dest.VendorPhone, opt => opt.MapFrom(src => src.VendorEntity != null ? src.VendorEntity.Phone : null))
        .ForMember(dest => dest.PropertyImageUrl,
                       opt => opt.MapFrom(src => src.Property != null && src.Property.Images != null && src.Property.Images.Any()
                           ? src.Property.Images.First().BlobUrl : null));
        CreateMap<LoadMaintenanceRequestDto, UpdateMaintenanceRequestDto>();
        CreateMap<UpdateMaintenanceRequestDto, LoadMaintenanceRequestDto>();
        CreateMap<AddMaintenanceRequestDto, MaintenanceRequest>();
        CreateMap<MaintenanceRequest, AddMaintenanceRequestDto>();
        CreateMap<UpdateMaintenanceRequestDto, MaintenanceRequest>();
        CreateMap<MaintenanceRequest, UpdateMaintenanceRequestDto>();

        CreateMap<AddMaintenanceImageDto, MaintenanceImage>();
        CreateMap<MaintenanceImage, AddMaintenanceImageDto>();
        CreateMap<LoadMaintenanceImageDto, MaintenanceImage>();
        CreateMap<MaintenanceImage, LoadMaintenanceImageDto>();
        CreateMap<MaintenanceImage, string>();

        CreateMap<AddExpenseReceiptDto, ExpenseReceipt>()
            .ForMember(dest => dest.RefId, opt => opt.MapFrom(src => src.ExpenseId));
        CreateMap<ExpenseReceipt, AddExpenseReceiptDto>()
            .ForMember(dest => dest.ExpenseId, opt => opt.MapFrom(src => src.RefId));
        CreateMap<LoadExpenseReceiptDto, ExpenseReceipt>();
        CreateMap<ExpenseReceipt, LoadExpenseReceiptDto>()
            .ForMember(dest => dest.ExpenseId, opt => opt.MapFrom(src => src.RefId));

        CreateMap<AddImageDto, MaintenanceImage>().ReverseMap();
        CreateMap<MaintenanceImage, LoadImageDto>().ReverseMap();
        CreateMap<AddImageDto, PropertyImage>().ReverseMap();
        CreateMap<PropertyImage, LoadImageDto>().ReverseMap();
        CreateMap<AddImageDto, ExpenseReceipt>().ReverseMap();
        CreateMap<ExpenseReceipt, LoadImageDto>().ReverseMap();

        CreateMap<LoadMaintenanceCategoryDto, MaintenanceCategory>();
        CreateMap<MaintenanceCategory, LoadMaintenanceCategoryDto>();

        CreateMap<MaintenanceEvent, MaintenanceEventDto>()
            .ForMember(d => d.ChangedByUserName,
                o => o.MapFrom(src => src.ChangedByUserId != null ? src.ChangedByUserId : null));

        CreateMap<LoadUnitDto, Unit>();
        CreateMap<Unit, LoadUnitDto>()
            .ForMember(dest => dest.Lease, opt => opt.MapFrom(src =>
                src.Lease != null && !src.Lease.IsDeleted ? src.Lease : null))
            .ForMember(dest => dest.IsOccupied, opt => opt.MapFrom(src =>
                src.Lease != null &&
                !src.Lease.IsDeleted &&
                src.Lease.IsActive &&
                src.Lease.StartDate.HasValue &&
                src.Lease.StartDate.Value <= DateTime.UtcNow.Date &&
                src.Lease.EndDate.HasValue &&
                src.Lease.EndDate.Value >= DateTime.UtcNow.Date))
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src =>
                src.Lease == null || src.Lease.IsDeleted
                    ? "vacant"
                    : src.Lease.LeaseAgreement != null && src.Lease.LeaseAgreement.IsDrafted == true && !src.Lease.IsActive
                        ? "draft"
                        : src.Lease.IsActive && src.Lease.StartDate.HasValue && src.Lease.StartDate.Value > DateTime.UtcNow.Date
                            ? "notStarted"
                            : src.Lease.IsActive && src.Lease.EndDate.HasValue && src.Lease.EndDate.Value >= DateTime.UtcNow.Date
                                ? (src.Lease.OverdueAmount.HasValue && src.Lease.OverdueAmount > 0 ? "overdue" : "occupied")
                                : "vacant"));
        CreateMap<Unit, UpdateUnitDto>();
        CreateMap<UpdateUnitDto, Unit>()
            .ForMember(dest => dest.PropertyId, opt => opt.Ignore());


        CreateMap<Models.LeaseAgreement, LoadLeaseAgreementDto>();

        CreateMap<AddLeaseDto, Lease>();
        CreateMap<Lease, AddLeaseDto>();
        CreateMap<LoadLeaseDto, Lease>();
        CreateMap<Lease, UpdateLeaseDto>();
        CreateMap<UpdateLeaseDto, Lease>()
            .ForMember(dest => dest.Unit, opt => opt.Ignore()) // Ignore Unit navigation property - we'll set it explicitly in repository
            .ForMember(dest => dest.LeaseAgreement, opt => opt.Ignore()) // LeaseAgreement is managed separately
            .ForMember(dest => dest.TenantLeases, opt => opt.Ignore()) // Ignore TenantLeases collection
            .ForMember(dest => dest.Deposits, opt => opt.Ignore()) // Ignore Deposits collection
            .ForMember(dest => dest.LeaseFees, opt => opt.Ignore()) // Ignore LeaseFees collection - we'll handle it explicitly in repository
            .ForMember(dest => dest.LeaseLandlords, opt => opt.Ignore())
            .ForMember(dest => dest.LeaseDeposits, opt => opt.Ignore())
            .ForMember(dest => dest.LeaseCoSigners, opt => opt.Ignore())
            .ForMember(dest => dest.LeaseAdditionalSigners, opt => opt.Ignore())
            .ForMember(dest => dest.LeaseOccupants, opt => opt.Ignore())
            .ForMember(dest => dest.Pets, opt => opt.Ignore()) // Pets are replaced explicitly in LeaseRepository.UpdateLease
            .ForMember(dest => dest.Parking, opt => opt.Ignore()) // Parking is upserted explicitly in LeaseRepository.UpdateLease
            .ForMember(dest => dest.UtilityServiceResponsibilities, opt => opt.Ignore())
            .ForMember(dest => dest.MaintenanceResponsibilities, opt => opt.Ignore())
            .ForMember(dest => dest.LeaseKeys, opt => opt.Ignore());
        CreateMap<Lease, LoadLeaseDto>()
            .ForMember(dest => dest.LeaseAgreement, opt => opt.MapFrom(src => src.LeaseAgreement))
            .ForMember(dest => dest.PropertyId, opt => opt.MapFrom(src => src.Unit.Property.Id))
            .ForMember(dest => dest.PropertyName, opt => opt.MapFrom(src => src.Unit.Property.Name))
            .ForMember(dest => dest.PropertyType, opt => opt.MapFrom(src => src.Unit.Property.PropertyType))
            .ForMember(dest => dest.OperatingAccountId, opt => opt.MapFrom(src => src.OperatingAccountId))
            .ForMember(dest => dest.UnitId, opt => opt.MapFrom(src => src.Unit.Id))
            .ForMember(dest => dest.UnitName, opt => opt.MapFrom(src => src.Unit.Name))
            .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => src.IsActive && !src.IsDeleted))
            .ForMember(dest => dest.Tenants, opt => opt.MapFrom(src => src.TenantLeases
                .Where(tl => tl.Tenant != null && tl.Tenant.UnitId == src.UnitId)
                .Select(tl => tl.Tenant!)
                .ToList()))
            .ForMember(dest => dest.LandlordId, opt => opt.MapFrom(src => src.Unit != null && src.Unit.Property != null ? src.Unit.Property.LandlordId : 0))
            .ForMember(dest => dest.LandlordName, opt => opt.MapFrom(src =>
                src.Unit.Property.Landlord != null
                    ? $"{src.Unit.Property.Landlord.FirstName} {src.Unit.Property.Landlord.LastName}".Trim()
                    : string.Empty))
            .ForMember(dest => dest.LandlordEmail, opt => opt.MapFrom(src =>
                src.Unit.Property.Landlord != null && !string.IsNullOrEmpty(src.Unit.Property.Landlord.Email)
                    ? src.Unit.Property.Landlord.Email
                    : (!string.IsNullOrEmpty(src.Unit.Property.ContactEmail) ? src.Unit.Property.ContactEmail : string.Empty)))
            .ForMember(dest => dest.PropertyImageUrl, opt => opt.MapFrom(src =>
                src.Unit != null && src.Unit.Property != null && src.Unit.Property.Images != null && src.Unit.Property.Images.Any()
                    ? src.Unit.Property.Images.First().BlobUrl
                    : null))
            .ForMember(dest => dest.Fees, opt => opt.MapFrom(src => src.LeaseFees != null ? src.LeaseFees.Select(f => new LeaseFeeDto
            {
                Id = f.Id,
                LeaseId = f.LeaseId,
                Name = f.Name,
                Amount = f.Amount,
                DueDate = f.DueDate,
                // Late Fee Configuration Fields
                IsLateFee = f.IsLateFee,
                LateFeeType = f.LateFeeType,
                FeeType = f.FeeType,
                PercentValue = f.PercentValue,
                AppliedAfterDays = f.AppliedAfterDays,
                StartingAfterDays = f.StartingAfterDays,
                LimitType = f.LimitType,
                LimitDays = f.LimitDays,
                LimitAmount = f.LimitAmount,
                LimitAmountType = f.LimitAmountType
            }).ToList() : new List<LeaseFeeDto>()))
            .ForMember(dest => dest.LandlordPhone, opt => opt.MapFrom(src =>
                src.Unit.Property.Landlord != null && !string.IsNullOrEmpty(src.Unit.Property.Landlord.PhoneNumber)
                    ? src.Unit.Property.Landlord.PhoneNumber
                    : (!string.IsNullOrEmpty(src.Unit.Property.ContactPhone) ? src.Unit.Property.ContactPhone : null)))
            .ForMember(dest => dest.NextDueDate, opt => opt.MapFrom(src =>
                src.StartDate.HasValue && src.EndDate.HasValue && src.RentDueDay.HasValue
                    ? RentCalculator.CalculateNextDueDate(src.StartDate.Value, src.EndDate.Value, src.RentDueDay.Value, null)
                    : (DateTime?)null))
            .ForMember(dest => dest.LeaseLandlords, opt => opt.MapFrom(src => src.LeaseLandlords ?? new List<LeaseLandlord>()))
            .ForMember(dest => dest.LeaseDeposits, opt => opt.MapFrom(src => src.LeaseDeposits ?? new List<LeaseDeposit>()))
            .ForMember(dest => dest.LeaseCoSigners, opt => opt.MapFrom(src => src.LeaseCoSigners ?? new List<LeaseCoSigner>()))
            .ForMember(dest => dest.LeaseAdditionalSigners, opt => opt.MapFrom(src => src.LeaseAdditionalSigners ?? new List<LeaseAdditionalSigner>()))
            .ForMember(dest => dest.LeaseOccupants, opt => opt.MapFrom(src => src.LeaseOccupants ?? new List<LeaseOccupant>()))
            .ForMember(dest => dest.Pets, opt => opt.MapFrom(src => src.Pets ?? new List<Pet>()))
            .ForMember(dest => dest.Parking, opt => opt.MapFrom(src => src.Parking))
            .ForMember(dest => dest.UtilityServiceResponsibilities, opt => opt.MapFrom(src => src.UtilityServiceResponsibilities ?? new List<UtilityServiceResponsibility>()))
            .ForMember(dest => dest.MaintenanceResponsibilities, opt => opt.MapFrom(src => src.MaintenanceResponsibilities ?? new List<MaintenanceResponsibility>()))
            .ForMember(dest => dest.LeaseKeys, opt => opt.MapFrom(src => src.LeaseKeys ?? new List<LeaseKey>()));

        CreateMap<LeaseLandlord, LeaseLandlordDto>();
        CreateMap<LeaseDeposit, LeaseDepositDto>();
        CreateMap<Pet, PetDto>();
        CreateMap<Parking, ParkingDto>();
        CreateMap<UtilityServiceResponsibility, UtilityServiceResponsibilityDto>();
        CreateMap<MaintenanceResponsibility, MaintenanceResponsibilityDto>();
        CreateMap<LeaseKey, LeaseKeyDto>();
        CreateMap<LeaseCoSigner, LeaseCoSignerDto>();
        CreateMap<LeaseAdditionalSigner, LeaseAdditionalSignerDto>();
        CreateMap<LeaseOccupant, LeaseOccupantDto>();

        CreateMap<LoadTenantDto, Tenant>();
        CreateMap<Tenant, LoadTenantDto>()
            .ForMember(dest => dest.PropertyId, opt => opt.MapFrom(src => src.Unit != null && src.Unit.Property != null ? src.Unit.Property.Id : (long?)null))
            .ForMember(dest => dest.PropertyName, opt => opt.MapFrom(src => src.Unit != null && src.Unit.Property != null ? src.Unit.Property.Name : null))
            .ForMember(dest => dest.PropertyType, opt => opt.MapFrom(src => src.Unit != null && src.Unit.Property != null ? src.Unit.Property.PropertyType.ToString() : null))
            .ForMember(dest => dest.UnitName, opt => opt.MapFrom(src => src.Unit != null ? src.Unit.Name : null))
            .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => !src.IsDeleted))
            .ForMember(dest => dest.LeaseId, opt => opt.MapFrom(src => src.TenantLeases != null && src.TenantLeases.Any()
                ? src.TenantLeases.First().Lease.Id : (long?)null))
            .ForMember(dest => dest.LeaseStartDate, opt => opt.MapFrom(src => src.TenantLeases != null && src.TenantLeases.Any()
                ? src.TenantLeases.First().Lease.StartDate : (DateTime?)null))
            .ForMember(dest => dest.LeaseEndDate, opt => opt.MapFrom(src => src.TenantLeases != null && src.TenantLeases.Any()
                ? src.TenantLeases.First().Lease.EndDate : (DateTime?)null))
            .ForMember(dest => dest.User, opt => opt.MapFrom(src => src.User != null ? src.User : null));

        CreateMap<Tenant, AddTenantDto>();
        CreateMap<AddTenantDto, Tenant>();

        // Tenant Invites
        CreateMap<TenantInvite, LoadTenantInviteDto>();
        CreateMap<AddTenantInviteDto, TenantInvite>();

        CreateMap<LandlordInvite, LoadLandlordInviteDto>();

        // Clients
        CreateMap<Client, LoadClientDto>();
        CreateMap<AddOrUpdateClientDto, Client>();
        CreateMap<Client, AddOrUpdateClientDto>();
        CreateMap<Client, ClientSummaryDto>()
            .ForMember(dest => dest.HasPortalAccess, opt => opt.MapFrom(src => src.UserId != null));

        CreateMap<LandlordInvite, LoadLandlordInviteDto>();
        CreateMap<AddLandlordInviteDto, LandlordInvite>();

        // Application Invites
        CreateMap<ApplicationInvite, LoadApplicationInviteDto>();
        CreateMap<AddApplicationInviteDto, ApplicationInvite>();

        // Payments
        CreateMap<Payment, LoadPaymentDto>()
            .ForMember(dest => dest.DepositId, opt => opt.MapFrom(src => src.DepositId))
            .ForMember(dest => dest.DepositRefundedDate, opt => opt.MapFrom(src => src.Deposit != null ? src.Deposit.RefundedDate : null))
            .ForMember(dest => dest.FeeName, opt => opt.MapFrom(src => src.Fee != null ? src.Fee.Name : null))
            .ForMember(dest => dest.StripePaymentMethodType, opt => opt.MapFrom(src => src.StripePaymentMethod != null ? src.StripePaymentMethod.Type : null))
            .ForMember(dest => dest.StripePaymentMethodBrand, opt => opt.MapFrom(src => src.StripePaymentMethod != null ? src.StripePaymentMethod.Brand : null))
            .ForMember(dest => dest.StripePaymentMethodLast4, opt => opt.MapFrom(src => src.StripePaymentMethod != null ? src.StripePaymentMethod.Last4 : null))
            .ForMember(dest => dest.StripePaymentMethodBankName, opt => opt.MapFrom(src => src.StripePaymentMethod != null ? src.StripePaymentMethod.BankName : null))
            .ForMember(dest => dest.StripePaymentMethodWalletType, opt => opt.MapFrom(src => src.StripePaymentMethod != null ? src.StripePaymentMethod.WalletType : null))
            .ForMember(dest => dest.UnitName, opt => opt.MapFrom(src => src.Lease.Unit.Name))
            .ForMember(dest => dest.UnitId, opt => opt.MapFrom(src => src.Lease.Unit.Id))
            .ForMember(dest => dest.PropertyName, opt => opt.MapFrom(src => src.Lease.Unit.Property.Name))
            .ForMember(dest => dest.IsSingleUnitProperty, opt => opt.MapFrom(src => src.Lease.Unit.Property.PropertyType == EPropertyType.SingleFamily));

        // Notifications
        CreateMap<Notification, NotificationDto>();
        CreateMap<NotificationDto, Notification>();
        CreateMap<CreateNotificationDto, Notification>();

        // Expenses
        CreateMap<Expense, LoadExpenseDto>()
            .ForMember(dest => dest.PropertyName, opt => opt.MapFrom(src => src.Property != null ? src.Property.Name : null))
            .ForMember(dest => dest.UnitName, opt => opt.MapFrom(src => src.Unit != null ? src.Unit.Name : null))
            .ForMember(dest => dest.VendorId, opt => opt.MapFrom(src => src.VendorId))
            .ForMember(dest => dest.VendorName, opt => opt.MapFrom(src => src.VendorEntity != null ? src.VendorEntity.Name : (src.Vendor ?? null)))
            .ForMember(dest => dest.VendorEmail, opt => opt.MapFrom(src => src.VendorEntity != null ? src.VendorEntity.Email : null))
            .ForMember(dest => dest.VendorPhone, opt => opt.MapFrom(src => src.VendorEntity != null ? src.VendorEntity.Phone : null))
            .ForMember(dest => dest.VendorTaxId, opt => opt.MapFrom(src => src.VendorEntity != null ? src.VendorEntity.TaxId : null))
            .ForMember(dest => dest.VendorAddress, opt => opt.MapFrom(src => src.VendorEntity != null ? string.Join(", ", new[] { src.VendorEntity.Address, src.VendorEntity.City, src.VendorEntity.State, src.VendorEntity.ZipCode }.Where(x => !string.IsNullOrWhiteSpace(x))) : null))
            .ForMember(dest => dest.VendorRequires1099, opt => opt.MapFrom(src => src.VendorEntity != null && src.VendorEntity.Requires1099));
        CreateMap<AddExpenseDto, Expense>();
        CreateMap<UpdateExpenseDto, Expense>();

        // Recurring Expenses
        CreateMap<AddRecurringExpenseDto, RecurringExpense>();
        CreateMap<UpdateRecurringExpenseDto, RecurringExpense>();
        CreateMap<RecurringExpense, LoadRecurringExpenseDto>()
            .ForMember(dest => dest.PropertyName, opt => opt.MapFrom(src => src.Property != null ? src.Property.Name : null))
            .ForMember(dest => dest.UnitName, opt => opt.MapFrom(src => src.Unit != null ? src.Unit.Name : null));

        // Future Expenses
        CreateMap<AddFutureExpenseDto, FutureExpense>();
        CreateMap<FutureExpense, LoadFutureExpenseDto>()
            .ForMember(dest => dest.PropertyName, opt => opt.MapFrom(src => src.Property != null ? src.Property.Name : null))
            .ForMember(dest => dest.UnitName, opt => opt.MapFrom(src => src.Unit != null ? src.Unit.Name : null));

        // Vendors
        CreateMap<Vendor, LoadVendorDto>()
            .ForMember(dest => dest.ExpenseCount, opt => opt.Ignore())
            .ForMember(dest => dest.MaintenanceRequestCount, opt => opt.Ignore())
            .ForMember(dest => dest.TotalExpenseAmount, opt => opt.Ignore());
        CreateMap<AddVendorDto, Vendor>();
        CreateMap<UpdateVendorDto, Vendor>();
        CreateMap<Vendor, AddVendorDto>();
        CreateMap<Vendor, UpdateVendorDto>();

        // Tenant Documents
        CreateMap<AddTenantDocumentDto, TenantDocument>()
            .ForMember(dest => dest.RefId, opt => opt.MapFrom(src => src.TenantId ?? 0));
        CreateMap<TenantDocument, LoadTenantDocumentDto>()
            .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => !src.IsDeleted));
        CreateMap<UpdateTenantDocumentDto, TenantDocument>();

        // Files
        CreateMap<AddFileDto, Models.File>();
        CreateMap<Models.File, LoadFileDto>();
        CreateMap<UpdateFileDto, Models.File>();

        // FileCategories
        CreateMap<AddFileCategoryDto, Models.FileCategory>();
        CreateMap<Models.FileCategory, LoadFileCategoryDto>();
        CreateMap<UpdateFileCategoryDto, Models.FileCategory>();

        // Document Templates
        CreateMap<AddDocumentTemplateDto, DocumentTemplate>();
        CreateMap<DocumentTemplate, LoadDocumentTemplateDto>()
            .ForMember(dest => dest.DocumentTypeName, opt => opt.MapFrom(src => src.DocumentType.ToString()))
            .ForMember(dest => dest.IsActive, opt => opt.MapFrom(src => !src.IsDeleted));

        // Rental Applications
        CreateMap<AddRentalApplicationDto, RentalApplication>();
        CreateMap<RentalApplication, LoadRentalApplicationDto>();
        CreateMap<UpdateRentalApplicationDto, RentalApplication>();

        // Checklists
        CreateMap<AddChecklistDto, Checklist>();
        CreateMap<Checklist, LoadChecklistDto>();
        CreateMap<UpdateChecklistDto, Checklist>();
        CreateMap<AddChecklistItemDto, ChecklistItem>();
        CreateMap<ChecklistItem, LoadChecklistItemDto>();
        CreateMap<UpdateChecklistItemDto, ChecklistItem>();

        // Organization Checklist Items
        CreateMap<AddOrganizationChecklistItemDto, OrganizationChecklistItem>();
        CreateMap<OrganizationChecklistItem, LoadOrganizationChecklistItemDto>();
        CreateMap<UpdateOrganizationChecklistItemDto, OrganizationChecklistItem>();

        // Conversations
        CreateMap<AddConversationDto, Conversation>();
        CreateMap<Conversation, LoadConversationDto>();

        // Messages
        CreateMap<AddMessageDto, Message>();
        CreateMap<Message, LoadMessageDto>();

        // Subscriptions
        CreateMap<SubscriptionPlan, SubscriptionPlanDto>();
        CreateMap<SubscriptionPlanDto, SubscriptionPlan>();
        CreateMap<Subscription, SubscriptionDto>();
        CreateMap<SubscriptionDto, Subscription>();

        // Subscription User mapping
        CreateMap<User, SubscriptionUserDto>();

        // Upcoming Features
        CreateMap<UpcomingFeature, UpcomingFeatureDto>();
        CreateMap<UpcomingFeatureDto, UpcomingFeature>();

        // Organizations
        CreateMap<Organization, LoadOrganizationDto>();
        CreateMap<CreateOrganizationDto, Organization>();
        CreateMap<UpdateOrganizationDto, Organization>();

        // Organization Members
        CreateMap<OrganizationMember, LoadOrganizationMemberDto>();
        CreateMap<AddOrganizationMemberDto, OrganizationMember>();
        CreateMap<UpdateOrganizationMemberDto, OrganizationMember>();

        // Organization Invites
        CreateMap<OrganizationInvite, LoadOrganizationInviteDto>();
        CreateMap<CreateOrganizationInviteDto, OrganizationInvite>();

        // Lease Templates
        CreateMap<LeaseTemplate, LoadLeaseTemplateDto>();
        CreateMap<CreateLeaseTemplateDto, LeaseTemplate>();
        CreateMap<UpdateLeaseTemplateDto, LeaseTemplate>();
        CreateMap<LeaseTemplatePolicy, LoadLeaseTemplatePolicyDto>();
        CreateMap<CreateLeaseTemplatePolicyDto, LeaseTemplatePolicy>();
        CreateMap<UpdateLeaseTemplatePolicyDto, LeaseTemplatePolicy>();

        // Policy Packs
        CreateMap<PolicyPack, LoadPolicyPackDto>();
        CreateMap<PolicyPackItem, LoadPolicyPackItemDto>();
        CreateMap<CreatePolicyPackDto, PolicyPack>();
        CreateMap<UpdatePolicyPackDto, PolicyPack>();

        // Lease Instances
        CreateMap<LeaseInstance, LoadLeaseInstanceDto>()
            .AfterMap((src, dest) =>
            {
                if (!string.IsNullOrEmpty(src.Warnings))
                {
                    dest.Warnings = System.Text.Json.JsonSerializer.Deserialize<List<string>>(src.Warnings);
                }
            });
        CreateMap<LeaseVariable, LoadLeaseVariableDto>();
        CreateMap<LeaseDocument, LoadLeaseDocumentDto>();
        CreateMap<LeasePolicySection, LoadLeasePolicySectionDto>()
            .ForMember(dest => dest.OriginalPolicies, opt => opt.Ignore())
            .AfterMap((src, dest) =>
            {
                if (!string.IsNullOrEmpty(src.OriginalPolicies))
                {
                    dest.OriginalPolicies = System.Text.Json.JsonSerializer.Deserialize<List<string>>(src.OriginalPolicies);
                }
            });

        // Demo Requests
        CreateMap<DemoRequest, LoadDemoRequestDto>();
        CreateMap<AddDemoRequestDto, DemoRequest>();

        // Bank Accounts
        CreateMap<BankAccount, LoadBankAccountDto>();
        CreateMap<CreateBankAccountDto, BankAccount>();

        // Action Suppressions
        CreateMap<ActionSuppression, LoadActionSuppressionDto>();
        CreateMap<AddActionSuppressionDto, ActionSuppression>();

        // Time Tracking - Staff Member
        CreateMap<AddStaffMemberDto, StaffMember>();
        CreateMap<StaffMember, LoadStaffMemberDto>()
            .ForMember(dest => dest.UserFirstName, opt => opt.MapFrom(src => src.User != null ? src.User.FirstName : (src.FirstName ?? string.Empty)))
            .ForMember(dest => dest.UserLastName, opt => opt.MapFrom(src => src.User != null ? src.User.LastName : (src.LastName ?? string.Empty)))
            .ForMember(dest => dest.UserEmail, opt => opt.MapFrom(src => src.User != null ? src.User.Email : (src.Email ?? string.Empty)))
            .ForMember(dest => dest.UserName, opt => opt.MapFrom(src =>
                src.User != null
                    ? $"{src.User.FirstName} {src.User.LastName}".Trim()
                    : $"{src.FirstName} {src.LastName}".Trim()))
            .ForMember(dest => dest.FirstName, opt => opt.MapFrom(src => src.FirstName))
            .ForMember(dest => dest.LastName, opt => opt.MapFrom(src => src.LastName))
            .ForMember(dest => dest.Email, opt => opt.MapFrom(src => src.Email))
            .ForMember(dest => dest.HasAccount, opt => opt.MapFrom(src => src.UserId.HasValue))
            .ForMember(dest => dest.OrganizationName, opt => opt.MapFrom(src => src.Organization != null ? src.Organization.Name : string.Empty));
        CreateMap<UpdateStaffMemberDto, StaffMember>();

        // StaffMemberInvite mappings
        CreateMap<AddStaffMemberInviteDto, StaffMemberInvite>();
        CreateMap<StaffMemberInvite, LoadStaffMemberInviteDto>();

        // Time Entry
        CreateMap<AddTimeEntryDto, TimeEntry>();
        CreateMap<TimeEntry, LoadTimeEntryDto>()
            .ForMember(dest => dest.StaffMemberName, opt => opt.MapFrom(src =>
                src.StaffMember != null && src.StaffMember.User != null
                    ? $"{src.StaffMember.User.FirstName} {src.StaffMember.User.LastName}".Trim()
                    : string.Empty))
            .ForMember(dest => dest.StaffMemberEmail, opt => opt.MapFrom(src =>
                src.StaffMember != null && src.StaffMember.User != null
                    ? src.StaffMember.User.Email
                    : string.Empty))
            .ForMember(dest => dest.PropertyName, opt => opt.MapFrom(src => src.Property != null ? src.Property.Name : string.Empty))
            .ForMember(dest => dest.MaintenanceRequestTitle, opt => opt.MapFrom(src => src.MaintenanceRequest != null ? src.MaintenanceRequest.Title : null))
            .ForMember(dest => dest.UnitName, opt => opt.MapFrom(src => src.Unit != null ? src.Unit.Name : null))
            .ForMember(dest => dest.ApprovedByName, opt => opt.MapFrom(src =>
                src.ApprovedBy != null
                    ? $"{src.ApprovedBy.FirstName} {src.ApprovedBy.LastName}".Trim()
                    : null))
            .ForMember(dest => dest.Breaks, opt => opt.MapFrom(src => src.Breaks));
        CreateMap<UpdateTimeEntryDto, TimeEntry>();

        // Time Break
        CreateMap<AddTimeBreakDto, TimeBreak>();
        CreateMap<TimeBreak, LoadTimeBreakDto>();
        CreateMap<UpdateTimeBreakDto, TimeBreak>();

        // Time Tracking Settings
        CreateMap<TimeTrackingSettings, LoadTimeTrackingSettingsDto>();
        CreateMap<UpdateTimeTrackingSettingsDto, TimeTrackingSettings>();

        // Listings
        CreateMap<CreateListingDto, Listing>();
        CreateMap<UpdateListingDto, Listing>();
        CreateMap<Listing, LoadListingDto>();
        CreateMap<AddImageDto, ListingImage>().ReverseMap();
        CreateMap<ListingImage, LoadImageDto>()
            .ForMember(dest => dest.RefId, opt => opt.MapFrom(src => src.RefId))
            .ForMember(dest => dest.IsCoverPhoto, opt => opt.MapFrom(src => src.IsCoverPhoto));

        // Amenities
        CreateMap<BasicAmenity, LoadBasicAmenityDto>();
        CreateMap<DefaultAmenity, LoadDefaultAmenityDto>();
        CreateMap<CustomAmenity, LoadCustomAmenityDto>();
        CreateMap<CreateCustomAmenityDto, CustomAmenity>();

        // Features
        CreateMap<DefaultFeature, Dtos.Feature.LoadDefaultFeatureDto>();
        CreateMap<CustomFeature, Dtos.Feature.LoadCustomFeatureDto>();
        CreateMap<Dtos.Feature.CreateCustomFeatureDto, CustomFeature>();

        // Bound recursive mapping depth to prevent attacker-controlled object graphs from
        // exhausting the process stack (CVE-2026-32933 / GHSA-rvv3-g6hj-g44x).
        this.Internal().ForAllMaps((_, expression) => expression.MaxDepth(64));
    }
}

