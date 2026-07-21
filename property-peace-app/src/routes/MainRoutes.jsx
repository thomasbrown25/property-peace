import { lazy } from 'react';
import { Navigate, useParams } from 'react-router-dom';

// project imports
import Loadable from 'components/Loadable';
import DashboardLayout from 'layout/Dashboard';
import AdminRoute from 'components/auth/AdminRoute';
import SubscriptionPausedGuard from 'components/auth/SubscriptionPausedGuard';


// landlord pages (lazy-loaded)
const Dashboard = Loadable(lazy(() => import('pages/landlord/dashboard')));
const Calendar = Loadable(lazy(() => import('pages/landlord/calendar')));
const Properties = Loadable(lazy(() => import('pages/landlord/properties')));
const Tenants = Loadable(lazy(() => import('pages/landlord/tenants')));
const Property = Loadable(lazy(() => import('pages/landlord/property')));
const PropertyAdd = Loadable(lazy(() => import('pages/landlord/property-add')));
const PropertyAddWorkflow = Loadable(lazy(() => import('pages/landlord/property-add-workflow')));
const PropertyImportPage = Loadable(lazy(() => import('pages/landlord/property-import')));
const Leases = Loadable(lazy(() => import('pages/landlord/leases')));
const Listings = Loadable(lazy(() => import('pages/landlord/listings')));
const ListingCreate = Loadable(lazy(() => import('pages/landlord/listing-create')));
const ListingSetup = Loadable(lazy(() => import('pages/landlord/listing-setup')));
const ListingSetupPhotos = Loadable(lazy(() => import('pages/landlord/listing-setup-photos')));
const ListingSetupTerms = Loadable(lazy(() => import('pages/landlord/listing-setup-terms')));
const ListingSetupApplication = Loadable(lazy(() => import('pages/landlord/listing-setup-application')));
const ListingSetupAmenities = Loadable(lazy(() => import('pages/landlord/listing-setup-amenities')));
const ListingDetail = Loadable(lazy(() => import('pages/landlord/listing-detail')));
const ListingSettings = Loadable(lazy(() => import('pages/landlord/listing-settings')));
const Screenings = Loadable(lazy(() => import('pages/landlord/screenings')));
const PublicListing = Loadable(lazy(() => import('pages/public/listing/[listingNumber]')));
const LeasePage = Loadable(lazy(() => import('pages/landlord/lease')));
const LeaseEditPage = Loadable(lazy(() => import('pages/landlord/lease-edit')));
const LeaseSettingsPage = Loadable(lazy(() => import('pages/landlord/lease-settings')));
const LeasePaymentHistory = Loadable(lazy(() => import('pages/landlord/lease-payment-history')));
const LeaseActivity = Loadable(lazy(() => import('pages/landlord/lease-activity')));
const LeaseCharges = Loadable(lazy(() => import('pages/landlord/lease-charges')));
const LeaseUploadDocument = Loadable(lazy(() => import('pages/landlord/lease-upload-document')));
const LeaseAddendum = Loadable(lazy(() => import('pages/landlord/lease-addendum')));
const LeaseBuilderPage = Loadable(lazy(() => import('pages/landlord/lease-builder')));
const LeaseBuilderBulkPage = Loadable(lazy(() => import('pages/landlord/lease-builder-bulk')));
const LeaseAddTenantPage = Loadable(lazy(() => import('pages/landlord/lease-add-tenant')));
const LeaseSelectionPage = Loadable(lazy(() => import('pages/landlord/lease-selection')));
const LeaseAgreementBuilderPage = Loadable(lazy(() => import('pages/landlord/lease-agreement-builder')));
const BuildLeaseAgreementPage = Loadable(lazy(() => import('pages/landlord/build-lease-agreement')));
const LeaseSpecificsPage = Loadable(lazy(() => import('pages/landlord/build-lease-agreement/lease-specifics')));
const RentDepositFeesPage = Loadable(lazy(() => import('pages/landlord/build-lease-agreement/rent-deposit-fees')));
const PeopleOnLeasePage = Loadable(lazy(() => import('pages/landlord/build-lease-agreement/people-on-lease')));
const PetsSmokingOtherPage = Loadable(lazy(() => import('pages/landlord/build-lease-agreement/pets-smoking-other')));
const UtilitiesMaintenanceKeysPage = Loadable(lazy(() => import('pages/landlord/build-lease-agreement/utilities-maintenance-keys')));
const ProvisionsAttachmentsPage = Loadable(lazy(() => import('pages/landlord/build-lease-agreement/provisions-attachments')));
const CreateLeaseAgreementPage = Loadable(lazy(() => import('pages/landlord/create-lease-agreement')));
const LeaseAgreements = Loadable(lazy(() => import('pages/landlord/lease-agreements')));
const VendorImportPage = Loadable(lazy(() => import('pages/landlord/vendor-import')));
const ESignDocumentPage = Loadable(lazy(() => import('pages/landlord/e-sign-document')));
const PropertySettingsPage = Loadable(lazy(() => import('pages/landlord/property-settings')));
const PropertyAddUnits = Loadable(lazy(() => import('pages/landlord/property-add-units')));
const UnitImportPage = Loadable(lazy(() => import('pages/landlord/unit-import')));
const TenantImportPage = Loadable(lazy(() => import('pages/landlord/tenant-import')));
const AnnouncementsPage = Loadable(lazy(() => import('pages/landlord/announcements')));
const AnnouncementSelectionPage = Loadable(lazy(() => import('pages/landlord/announcement-selection')));
const AnnouncementCreateAllPage = Loadable(lazy(() => import('pages/landlord/announcement-create-all')));
const AnnouncementCreateSelectPage = Loadable(lazy(() => import('pages/landlord/announcement-create-select')));
const AnnouncementEditPage = Loadable(lazy(() => import('pages/landlord/announcement-edit')));
const AnnouncementDetailsPage = Loadable(lazy(() => import('pages/landlord/announcement-details')));
const Maintenances = Loadable(lazy(() => import('pages/landlord/maintenances')));
const Priorities = Loadable(lazy(() => import('pages/landlord/priorities')));
const PropertyActivity = Loadable(lazy(() => import('pages/landlord/property-activity')));
const MaintenancePage = Loadable(lazy(() => import('pages/landlord/maintenance')));
const MaintenanceAddWorkflow = Loadable(lazy(() => import('pages/landlord/maintenance-add-workflow')));
const ChecklistPage = Loadable(lazy(() => import('pages/landlord/checklist')));
const ChecklistsPage = Loadable(lazy(() => import('pages/landlord/checklists')));
const UnitChecklistsPage = Loadable(lazy(() => import('pages/landlord/unit-checklists')));
const InspectionDetailPage = Loadable(lazy(() => import('pages/landlord/inspection-detail')));
const CustomizeMoveInReportPage = Loadable(lazy(() => import('pages/landlord/customize-move-in-report')));
const UnitPage = Loadable(lazy(() => import('pages/landlord/unit')));
const Tenant = Loadable(lazy(() => import('pages/landlord/tenant')));
const ContactUs = Loadable(lazy(() => import('pages/landlord/contact-us')));
const Files = Loadable(lazy(() => import('pages/landlord/files')));
const Documents = Loadable(lazy(() => import('pages/landlord/documents')));
const ToolsTabs = Loadable(lazy(() => import('pages/landlord/tools-tabs')));
const Expenses = Loadable(lazy(() => import('pages/landlord/expenses')));
const Payments = Loadable(lazy(() => import('pages/landlord/payments')));
const Ledger = Loadable(lazy(() => import('pages/landlord/ledger')));
const ExpensesProperty = Loadable(lazy(() => import('pages/landlord/expenses-property')));
const ExpenseAddWorkflow = Loadable(lazy(() => import('pages/landlord/expense-add-workflow')));
const Messages = Loadable(lazy(() => import('pages/landlord/messages')));
const PropertiesPage = Loadable(lazy(() => import('pages/landlord/properties-page')));
const UrgentMessages = Loadable(lazy(() => import('pages/landlord/urgent-messages')));
const ReportsDashboard = Loadable(lazy(() => import('pages/landlord/reports/index')));
const OccupancyReport = Loadable(lazy(() => import('pages/landlord/reports/occupancy')));
const RevenuePerUnitReport = Loadable(lazy(() => import('pages/landlord/reports/revenue-per-unit')));
const UnitsPerClientReport = Loadable(lazy(() => import('pages/landlord/reports/units-per-client')));
const ClientChurnReport = Loadable(lazy(() => import('pages/landlord/reports/client-churn')));
const UnitsPerEmployeeReport = Loadable(lazy(() => import('pages/landlord/reports/units-per-employee')));
const ClosingRateReport = Loadable(lazy(() => import('pages/landlord/reports/closing-rate')));
const MedianDOMReport = Loadable(lazy(() => import('pages/landlord/reports/median-dom')));
const MedianTTTReport = Loadable(lazy(() => import('pages/landlord/reports/median-ttt')));
const NPSClientReport = Loadable(lazy(() => import('pages/landlord/reports/nps-client')));
const NPSTenantReport = Loadable(lazy(() => import('pages/landlord/reports/nps-tenant')));
const FinancialReports = Loadable(lazy(() => import('pages/landlord/reports/financial')));
const TaxReports = Loadable(lazy(() => import('pages/landlord/reports/tax')));
const Settings = Loadable(lazy(() => import('pages/landlord/settings')));
const Notifications = Loadable(lazy(() => import('pages/landlord/notifications')));
const Activity = Loadable(lazy(() => import('pages/landlord/activity')));
const Appearance = Loadable(lazy(() => import('pages/landlord/appearance')));
const Subscription = Loadable(lazy(() => import('pages/landlord/subscription/index')));
const SubscriptionSuccess = Loadable(lazy(() => import('pages/landlord/subscription-success')));
const BillingHistory = Loadable(lazy(() => import('pages/landlord/subscription/billing-history')));
const Vendors = Loadable(lazy(() => import('pages/landlord/vendors')));
const Owners = Loadable(lazy(() => import('pages/landlord/owners')));
const ClientAddWizard = Loadable(lazy(() => import('pages/landlord/clients/add')));
const Team = Loadable(lazy(() => import('pages/landlord/team')));
const Applications = Loadable(lazy(() => import('pages/landlord/applications')));
const InviteRenter = Loadable(lazy(() => import('pages/landlord/invite-renter')));
const UpcomingFeatures = Loadable(lazy(() => import('pages/landlord/upcoming-features')));
const Help = Loadable(lazy(() => import('pages/landlord/help')));
const Feedback = Loadable(lazy(() => import('pages/landlord/feedback')));
const SubmitSupportTicket = Loadable(lazy(() => import('pages/landlord/support/ticket')));
const LeaseShield = Loadable(lazy(() => import('pages/landlord/lease-shield')));
const RecordPaymentPage = Loadable(lazy(() => import('pages/landlord/record-payment')));
const PaymentAddWorkflow = Loadable(lazy(() => import('pages/landlord/payment-add-workflow')));
const TimeTracking = Loadable(lazy(() => import('pages/landlord/time-tracking-coming-soon')));
const TimeEntryDetail = Loadable(lazy(() => import('pages/landlord/time-entry-detail')));
const StaffMembers = Loadable(lazy(() => import('pages/landlord/staff-members')));
const StaffMember = Loadable(lazy(() => import('pages/landlord/staff-member')));
const TimeTrackingSettings = Loadable(lazy(() => import('pages/landlord/time-tracking-settings')));
const PortfolioSummary = Loadable(lazy(() => import('pages/landlord/portfolio-summary')));
const AICenter = Loadable(lazy(() => import('pages/landlord/ai-center')));
const CollectionsHistory = Loadable(lazy(() => import('pages/landlord/collections-history')));
const CollectionsAgent = Loadable(lazy(() => import('pages/landlord/collections-agent')));
const MaintenanceAgent = Loadable(lazy(() => import('pages/landlord/maintenance-agent')));
const RentCollection = Loadable(lazy(() => import('pages/landlord/rent-collection')));
const RentCollectionSingle = Loadable(lazy(() => import('pages/landlord/rent-collection-single')));
const MoneyActivity = Loadable(lazy(() => import('pages/landlord/money-activity')));

// tenant pages (lazy-loaded)
const TenantDashboard = Loadable(lazy(() => import('pages/tenant/dashboard')));
const TenantLease = Loadable(lazy(() => import('pages/tenant/lease')));
const TenantLeaseAdded = Loadable(lazy(() => import('pages/tenant/lease-added')));
const TenantApplications = Loadable(lazy(() => import('pages/tenant/applications')));
const TenantApplicationForm = Loadable(lazy(() => import('pages/tenant/application-form')));
const TenantMaintenance = Loadable(lazy(() => import('pages/tenant/maintenance')));
const TenantMaintenanceAddWorkflow = Loadable(lazy(() => import('pages/tenant/maintenance-add-workflow')));
const TenantPayments = Loadable(lazy(() => import('pages/tenant/payments')));
const TenantMessages = Loadable(lazy(() => import('pages/tenant/messages')));
const TenantSettings = Loadable(lazy(() => import('pages/tenant/settings')));
const TenantNotifications = Loadable(lazy(() => import('pages/tenant/notifications')));
const TenantInviteAcceptPortal = Loadable(lazy(() => import('pages/tenant/invite-accept-portal')));
const TenantAnnouncements = Loadable(lazy(() => import('pages/tenant/announcements')));
const TenantDocuments = Loadable(lazy(() => import('pages/tenant/documents')));
const TenantLeaseShield = Loadable(lazy(() => import('pages/landlord/lease-shield')));
const TenantSubscription = Loadable(lazy(() => import('pages/tenant/subscription')));
const TenantSubscriptionSuccess = Loadable(lazy(() => import('pages/tenant/subscription-success')));

// admin pages (lazy-loaded)
const AdminDashboard = Loadable(lazy(() => import('pages/admin/dashboard')));
const AdminSubscriptions = Loadable(lazy(() => import('pages/admin/subscriptions')));
const AdminUsers = Loadable(lazy(() => import('pages/admin/users')));
const AdminUserDetail = Loadable(lazy(() => import('pages/admin/user-detail')));
const AdminStorage = Loadable(lazy(() => import('pages/admin/storage')));
const AdminSettings = Loadable(lazy(() => import('pages/admin/settings')));
const AdminMessages = Loadable(lazy(() => import('pages/admin/messages')));
const AdminUpcomingFeatures = Loadable(lazy(() => import('pages/admin/upcoming-features')));
const AdminJobs = Loadable(lazy(() => import('pages/admin/jobs')));
const AdminLeaseShield = Loadable(lazy(() => import('pages/admin/lease-shield')));
const InviteLandlord = Loadable(lazy(() => import('pages/admin/invite-landlord')));
const AdminBroadcastEmail = Loadable(lazy(() => import('pages/admin/broadcast-email')));

// other pages
const SamplePage = Loadable(lazy(() => import('pages/extra-pages/sample-page')));
const MaintenanceError = Loadable(lazy(() => import('pages/maintenance/404')));
const MaintenanceError500 = Loadable(lazy(() => import('pages/maintenance/500')));
const MaintenanceUnderConstruction = Loadable(lazy(() => import('pages/maintenance/under-construction')));
const MaintenanceComingSoon = Loadable(lazy(() => import('pages/maintenance/coming-soon')));

// ==============================|| MAIN ROUTING ||============================== //

const MainRoutes = {
  path: '/',
  children: [
    {
      path: 'listing/:listingNumber',
      element: <PublicListing />
    },
    {
      path: '*',
      element: <DashboardLayout />,
      children: [
        {
          path: 'landlord/dashboard',
          element: (
            <SubscriptionPausedGuard>
              <Dashboard />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/calendar',
          element: (
            <SubscriptionPausedGuard>
              <Calendar />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/portfolio-summary',
          element: (
            <SubscriptionPausedGuard>
              <PortfolioSummary />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/properties',
          element: (
            <SubscriptionPausedGuard>
              <Properties />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/tenants',
          element: (
            <SubscriptionPausedGuard>
              <Tenants />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/tenants/import',
          element: (
            <SubscriptionPausedGuard>
              <TenantImportPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/properties/add',
          element: <PropertyAdd />
        },
        {
          // Backward compatibility - redirect old portfolio route
          path: 'landlord/portfolio',
          element: <Navigate to="/landlord/properties" replace />
        },
        {
          // Backward compatibility - redirect old portfolio/add route
          path: 'landlord/portfolio/add',
          element: <Navigate to="/landlord/properties/add" replace />
        },
        {
          path: 'landlord/property-add-workflow',
          element: <PropertyAddWorkflow />
        },
        {
          path: 'landlord/properties/import',
          element: (
            <SubscriptionPausedGuard>
              <PropertyImportPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          // Backward compatibility - redirect old route
          path: 'landlord/properties/add',
          element: <PropertyAdd />
        },
        {
          // property details by ID
          path: 'landlord/property/:propertyId',
          element: (
            <SubscriptionPausedGuard>
              <Property />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/property/:propertyId/e-sign',
          element: (
            <SubscriptionPausedGuard>
              <ESignDocumentPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/property/:propertyId/settings',
          element: (
            <SubscriptionPausedGuard>
              <PropertySettingsPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/property/:propertyId/add-units',
          element: (
            <SubscriptionPausedGuard>
              <PropertyAddUnits />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/property/:propertyId/add-units/import',
          element: (
            <SubscriptionPausedGuard>
              <UnitImportPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/checklist/:checklistId',
          element: (
            <SubscriptionPausedGuard>
              <ChecklistPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/unit/:unitId',
          element: (
            <SubscriptionPausedGuard>
              <UnitPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/unit/:unitId/checklists',
          element: (
            <SubscriptionPausedGuard>
              <UnitChecklistsPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases',
          element: (
            <SubscriptionPausedGuard>
              <Leases />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId',
          element: (
            <SubscriptionPausedGuard>
              <LeasePage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId/edit',
          element: (
            <SubscriptionPausedGuard>
              <LeaseEditPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId/settings',
          element: (
            <SubscriptionPausedGuard>
              <LeaseSettingsPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId/activity',
          element: (
            <SubscriptionPausedGuard>
              <LeaseActivity />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId/payment-history',
          element: (
            <SubscriptionPausedGuard>
              <LeasePaymentHistory />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId/charges',
          element: (
            <SubscriptionPausedGuard>
              <LeaseCharges />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId/upload-document',
          element: (
            <SubscriptionPausedGuard>
              <LeaseUploadDocument />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId/addendum',
          element: (
            <SubscriptionPausedGuard>
              <LeaseAddendum />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId/builder',
          element: (
            <SubscriptionPausedGuard>
              <LeaseBuilderPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/:leaseId/add-tenant',
          element: (
            <SubscriptionPausedGuard>
              <LeaseAddTenantPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/selection',
          element: (
            <SubscriptionPausedGuard>
              <LeaseSelectionPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/builder',
          element: (
            <SubscriptionPausedGuard>
              <LeaseBuilderPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/builder-bulk',
          element: (
            <SubscriptionPausedGuard>
              <LeaseBuilderBulkPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/lease-agreement-builder',
          element: (
            <SubscriptionPausedGuard>
              <LeaseAgreementBuilderPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/build-lease-agreement',
          element: (
            <SubscriptionPausedGuard>
              <BuildLeaseAgreementPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/build-lease-agreement/lease-specifics',
          element: (
            <SubscriptionPausedGuard>
              <LeaseSpecificsPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/build-lease-agreement/rent-deposit-fees',
          element: (
            <SubscriptionPausedGuard>
              <RentDepositFeesPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/build-lease-agreement/people-on-lease',
          element: (
            <SubscriptionPausedGuard>
              <PeopleOnLeasePage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/build-lease-agreement/pets-smoking-other',
          element: (
            <SubscriptionPausedGuard>
              <PetsSmokingOtherPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/build-lease-agreement/utilities-maintenance-keys',
          element: (
            <SubscriptionPausedGuard>
              <UtilitiesMaintenanceKeysPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/leases/build-lease-agreement/provisions-attachments',
          element: (
            <SubscriptionPausedGuard>
              <ProvisionsAttachmentsPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/lease-agreements',
          element: (
            <SubscriptionPausedGuard>
              <LeaseAgreements />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/create-lease-agreement',
          element: (
            <SubscriptionPausedGuard>
              <CreateLeaseAgreementPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/priorities',
          element: (
            <SubscriptionPausedGuard>
              <Priorities />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/property-activity/:propertyId',
          element: (
            <SubscriptionPausedGuard>
              <PropertyActivity />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/maintenances',
          element: (
            <SubscriptionPausedGuard>
              <Maintenances />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/maintenances/add',
          element: (
            <SubscriptionPausedGuard>
              <MaintenanceAddWorkflow />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/maintenance/:maintenanceId',
          element: (
            <SubscriptionPausedGuard>
              <MaintenancePage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/announcements',
          element: (
            <SubscriptionPausedGuard>
              <AnnouncementsPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/announcements/selection',
          element: (
            <SubscriptionPausedGuard>
              <AnnouncementSelectionPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/announcements/create-all',
          element: (
            <SubscriptionPausedGuard>
              <AnnouncementCreateAllPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/announcements/create-select',
          element: (
            <SubscriptionPausedGuard>
              <AnnouncementCreateSelectPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/announcements/edit',
          element: (
            <SubscriptionPausedGuard>
              <AnnouncementEditPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/announcements/details',
          element: (
            <SubscriptionPausedGuard>
              <AnnouncementDetailsPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/tenants/:tenantId',
          element: (
            <SubscriptionPausedGuard>
              <Tenant />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/listings',
          element: (
            <SubscriptionPausedGuard>
              <Listings />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/listings/add',
          element: (
            <SubscriptionPausedGuard>
              <ListingCreate />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/listings/:id/setup/photos',
          element: (
            <SubscriptionPausedGuard>
              <ListingSetupPhotos />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/listings/:id/setup/terms',
          element: (
            <SubscriptionPausedGuard>
              <ListingSetupTerms />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/listings/:id/setup/amenities',
          element: (
            <SubscriptionPausedGuard>
              <ListingSetupAmenities />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/listings/:id/setup/application',
          element: (
            <SubscriptionPausedGuard>
              <ListingSetupApplication />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/listings/:id/setup',
          element: (
            <SubscriptionPausedGuard>
              <ListingSetup />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/listings/:id/settings',
          element: (
            <SubscriptionPausedGuard>
              <ListingSettings />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/listings/:id',
          element: (
            <SubscriptionPausedGuard>
              <ListingDetail />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/screenings',
          element: (
            <SubscriptionPausedGuard>
              <Screenings />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/applications',
          element: (
            <SubscriptionPausedGuard>
              <Applications />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/invite-renter',
          element: (
            <SubscriptionPausedGuard>
              <InviteRenter />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/admin-members',
          element: (
            <SubscriptionPausedGuard>
              <Team />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/files',
          element: (
            <SubscriptionPausedGuard>
              <Files />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/tools',
          element: (
            <SubscriptionPausedGuard>
              <ToolsTabs />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/documents',
          element: (
            <SubscriptionPausedGuard>
              <Documents />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/customize-move-in-report',
          element: <CustomizeMoveInReportPage />
        },
        {
          path: 'landlord/checklists',
          element: (
            <SubscriptionPausedGuard>
              <ChecklistsPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/inspection/:propertyId',
          element: (
            <SubscriptionPausedGuard>
              <InspectionDetailPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/inspection/:propertyId/unit/:unitId',
          element: (
            <SubscriptionPausedGuard>
              <InspectionDetailPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/expenses',
          element: (
            <SubscriptionPausedGuard>
              <Expenses />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/payments',
          element: (
            <SubscriptionPausedGuard>
              <Payments />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/ledger',
          element: (
            <SubscriptionPausedGuard>
              <Ledger />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/expense/add-workflow',
          element: (
            <SubscriptionPausedGuard>
              <ExpenseAddWorkflow />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/messages',
          element: (
            <SubscriptionPausedGuard>
              <Messages />
            </SubscriptionPausedGuard>
          )
        },
      {
        path: 'landlord/properties',
        element: (
          <SubscriptionPausedGuard>
            <PropertiesPage />
          </SubscriptionPausedGuard>
        )
      },
        {
          path: 'landlord/urgent-messages',
          element: (
            <SubscriptionPausedGuard>
              <UrgentMessages />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/reports',
          element: <ReportsDashboard />
        },
        {
          path: 'landlord/reports/occupancy',
          element: <OccupancyReport />
        },
        {
          path: 'landlord/reports/revenue-per-unit',
          element: <RevenuePerUnitReport />
        },
        {
          path: 'landlord/reports/units-per-client',
          element: <UnitsPerClientReport />
        },
        {
          path: 'landlord/reports/client-churn',
          element: <ClientChurnReport />
        },
        {
          path: 'landlord/reports/units-per-employee',
          element: <UnitsPerEmployeeReport />
        },
        {
          path: 'landlord/reports/closing-rate',
          element: <ClosingRateReport />
        },
        {
          path: 'landlord/reports/median-dom',
          element: <MedianDOMReport />
        },
        {
          path: 'landlord/reports/median-ttt',
          element: <MedianTTTReport />
        },
        {
          path: 'landlord/reports/nps-client',
          element: <NPSClientReport />
        },
        {
          path: 'landlord/reports/nps-tenant',
          element: <NPSTenantReport />
        },
        {
          path: 'landlord/reports/financial',
          element: <FinancialReports />
        },
        {
          path: 'landlord/reports/tax',
          element: <TaxReports />
        },
        {
          path: 'landlord/upcoming-features',
          element: (
            <SubscriptionPausedGuard>
              <UpcomingFeatures />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/tax-reports',
          element: (
            <SubscriptionPausedGuard>
              <Navigate to="/landlord/reports?tab=2" replace />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/property-portfolio',
          element: (
            <SubscriptionPausedGuard>
              <Navigate to="/landlord/reports?tab=0" replace />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/settings',
          element: (
            <SubscriptionPausedGuard>
              <Settings />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/help',
          element: (
            <SubscriptionPausedGuard>
              <Help />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/feedback',
          element: (
            <SubscriptionPausedGuard>
              <Feedback />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/support/ticket',
          element: (
            <SubscriptionPausedGuard>
              <SubmitSupportTicket />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/lease-shield',
          element: (
            <SubscriptionPausedGuard>
              <LeaseShield />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/ai-center',
          element: (
            <SubscriptionPausedGuard>
              <AICenter />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/ai-center/collections-history',
          element: (
            <SubscriptionPausedGuard>
              <CollectionsHistory />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/ai-center/collections-agent',
          element: (
            <SubscriptionPausedGuard>
              <CollectionsAgent />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/ai-center/maintenance-agent',
          element: (
            <SubscriptionPausedGuard>
              <MaintenanceAgent />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/notifications',
          element: (
            <SubscriptionPausedGuard>
              <Notifications />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/activity',
          element: (
            <SubscriptionPausedGuard>
              <Activity />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/appearance',
          element: (
            <SubscriptionPausedGuard>
              <Appearance />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/subscription',
          element: <Subscription />
        },
        {
          path: 'landlord/subscription-success',
          element: <SubscriptionSuccess />
        },
        {
          path: 'landlord/subscription/billing-history',
          element: <BillingHistory />
        },
        {
          path: 'landlord/vendors',
          element: (
            <SubscriptionPausedGuard>
              <Vendors />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/vendors/import',
          element: (
            <SubscriptionPausedGuard>
              <VendorImportPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/clients',
          element: (
            <SubscriptionPausedGuard>
              <Owners />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/clients/add',
          element: (
            <SubscriptionPausedGuard>
              <ClientAddWizard />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/time-tracking',
          element: (
            <SubscriptionPausedGuard>
              <TimeTracking />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/time-entry/:id',
          element: (
            <SubscriptionPausedGuard>
              <TimeEntryDetail />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/staff-members',
          element: (
            <SubscriptionPausedGuard>
              <StaffMembers />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/staff-member/:staffMemberId',
          element: (
            <SubscriptionPausedGuard>
              <StaffMember />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/time-tracking-settings',
          element: (
            <SubscriptionPausedGuard>
              <TimeTrackingSettings />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/payments/record',
          element: (
            <SubscriptionPausedGuard>
              <RecordPaymentPage />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/payments/add',
          element: (
            <SubscriptionPausedGuard>
              <PaymentAddWorkflow />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'landlord/rent-collection',
          element: <RentCollection />
        },
        {
          path: 'landlord/rent-collection/:propertyId',
          element: <RentCollectionSingle />
        },
        {
          path: 'landlord/money-activity',
          element: <MoneyActivity />
        },
        {
          path: 'contact-us',
          element: <ContactUs />
        },
        // Tenant routes
        {
          path: 'tenant/dashboard',
          element: <TenantDashboard />
        },
        {
          path: 'tenant/lease',
          element: <TenantLease />
        },
        {
          path: 'tenant/lease-added/:leaseId',
          element: <TenantLeaseAdded />
        },
        {
          path: 'tenant/applications',
          element: <TenantApplications />
        },
        {
          path: 'tenant/applications/:applicationId/complete',
          element: <TenantApplicationForm />
        },
        {
          path: 'tenant/maintenance',
          element: <TenantMaintenance />
        },
        {
          path: 'tenant/maintenance/add',
          element: <TenantMaintenanceAddWorkflow />
        },
        {
          path: 'tenant/maintenance/:maintenanceId',
          element: <TenantMaintenance />
        },
        {
          path: 'tenant/payments',
          element: <TenantPayments />
        },
        {
          path: 'tenant/messages',
          element: <TenantMessages />
        },
        {
          path: 'tenant/settings',
          element: <TenantSettings />
        },
        {
          path: 'tenant/notifications',
          element: <TenantNotifications />
        },
        {
          path: 'tenant/invite-accept',
          element: <TenantInviteAcceptPortal />
        },
        {
          path: 'tenant/announcements',
          element: <TenantAnnouncements />
        },
        {
          path: 'tenant/documents',
          element: <TenantDocuments />
        },
        {
          path: 'tenant/lease-shield',
          element: (
            <SubscriptionPausedGuard>
              <TenantLeaseShield />
            </SubscriptionPausedGuard>
          )
        },
        {
          path: 'tenant/subscription',
          element: <TenantSubscription />
        },
        {
          path: 'tenant/subscription-success',
          element: <TenantSubscriptionSuccess />
        },
        {
          path: 'tenant/help',
          element: <Help />
        },
        // Admin routes (protected)
        {
          path: 'admin/dashboard',
          element: (
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          )
        },
        {
          path: 'admin/jobs',
          element: (
            <AdminRoute>
              <AdminJobs />
            </AdminRoute>
          )
        },
        {
          path: 'admin/lease-shield',
          element: (
            <AdminRoute>
              <AdminLeaseShield />
            </AdminRoute>
          )
        },
        {
          path: 'admin/subscriptions',
          element: (
            <AdminRoute>
              <AdminSubscriptions />
            </AdminRoute>
          )
        },
        {
          path: 'admin/users',
          element: (
            <AdminRoute>
              <AdminUsers />
            </AdminRoute>
          )
        },
        {
          path: 'admin/users/:userId',
          element: (
            <AdminRoute>
              <AdminUserDetail />
            </AdminRoute>
          )
        },
        {
          path: 'admin/storage',
          element: (
            <AdminRoute>
              <AdminStorage />
            </AdminRoute>
          )
        },
        {
          path: 'admin/settings',
          element: (
            <AdminRoute>
              <AdminSettings />
            </AdminRoute>
          )
        },
        {
          path: 'admin/messages',
          element: (
            <AdminRoute>
              <AdminMessages />
            </AdminRoute>
          )
        },
        {
          path: 'admin/upcoming-features',
          element: (
            <AdminRoute>
              <AdminUpcomingFeatures />
            </AdminRoute>
          )
        },
        {
          path: 'admin/invite-landlord',
          element: (
            <AdminRoute>
              <InviteLandlord />
            </AdminRoute>
          )
        },
        {
          path: 'admin/broadcast-email',
          element: (
            <AdminRoute>
              <AdminBroadcastEmail />
            </AdminRoute>
          )
        }
      ]
    }
  ]
};

export default MainRoutes;
