-- ============================================
-- SELECT STATEMENTS FOR ALL TABLES
-- ============================================

-- ============================================
-- ADMIN SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [admin].[DemoRequests] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [admin].[SupportAndFeedbacks] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [admin].[UpcomingFeatures] ORDER BY 1 DESC;

-- ============================================
-- CHECKLIST SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [checklist].[ChecklistItems] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [checklist].[Checklists] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [checklist].[OrganizationChecklistItems] ORDER BY 1 DESC;

-- Checklist with Items
SELECT TOP (1000) 
    c.*,
    ci.*
FROM [checklist].[Checklists] c
LEFT JOIN [checklist].[ChecklistItems] ci ON c.Id = ci.ChecklistId
ORDER BY c.Id DESC;

-- ============================================
-- CLIENT SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [client].[ClientInvites] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [client].[Clients] ORDER BY 1 DESC;

-- Clients with Invites
SELECT TOP (1000) 
    c.*,
    ci.*
FROM [client].[Clients] c
LEFT JOIN [client].[ClientInvites] ci ON c.Id = ci.ClientId
ORDER BY c.Id DESC;

-- ============================================
-- COMMUNICATION SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [communication].[AnnouncementRecipients] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [communication].[Announcements] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [communication].[ConversationParticipants] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [communication].[Conversations] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [communication].[MessageReads] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [communication].[Messages] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [communication].[Notifications] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [communication].[NotificationSettings] ORDER BY 1 DESC;

-- Conversations with Participants and Messages
SELECT TOP (1000) 
    conv.*,
    cp.UserId AS ParticipantUserId,
    m.Id AS MessageId,
    m.Content AS MessageContent,
    m.CreatedAt AS MessageCreatedAt
FROM [communication].[Conversations] conv
LEFT JOIN [communication].[ConversationParticipants] cp ON conv.Id = cp.ConversationId
LEFT JOIN [communication].[Messages] m ON conv.Id = m.ConversationId
ORDER BY conv.Id DESC;

-- Announcements with Recipients
SELECT TOP (1000) 
    a.*,
    ar.UserId AS RecipientUserId,
    ar.IsRead AS RecipientIsRead
FROM [communication].[Announcements] a
LEFT JOIN [communication].[AnnouncementRecipients] ar ON a.Id = ar.AnnouncementId
ORDER BY a.Id DESC;

-- Messages with Read Status
SELECT TOP (1000) 
    m.*,
    mr.UserId AS ReadByUserId,
    mr.ReadAt
FROM [communication].[Messages] m
LEFT JOIN [communication].[MessageReads] mr ON m.Id = mr.MessageId
ORDER BY m.Id DESC;

-- ============================================
-- CORE SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [core].[ActionSuppressions] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [core].[UserRoles] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [core].[Users] ORDER BY 1 DESC;

-- Users with Roles
SELECT TOP (1000) 
    u.*,
    ur.RoleId,
    r.Name AS RoleName
FROM [core].[Users] u
LEFT JOIN [core].[UserRoles] ur ON u.Id = ur.UserId
LEFT JOIN [dbo].[Roles] r ON ur.RoleId = r.Id
ORDER BY u.Id DESC;

-- ============================================
-- DBO SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [dbo].[_EFMigrationsHistory] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[Admins] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[AdminSettings] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[AIReceptionistConversations] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[Amenities] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[EmailVerifications] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[IncludedUtilities] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[LoggingDataExchange] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[LoggingException] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[LoggingTrace] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[MaintenanceCategories] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[MaintenanceImages] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[PropertyImages] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[Roles] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [dbo].[UserSettings] ORDER BY 1 DESC;

-- Property Images with Properties
SELECT TOP (1000) 
    pi.*,
    p.Name AS PropertyName,
    p.StreetAddress + ', ' + p.City + ', ' + p.State + ' ' + p.ZipCode AS PropertyAddress
FROM [dbo].[PropertyImages] pi
LEFT JOIN [property].[Properties] p ON pi.RefId = p.Id
ORDER BY pi.Id DESC;

-- Maintenance Images with Maintenance Requests
SELECT TOP (1000) 
    mi.*,
    mr.Id AS MaintenanceRequestId,
    mr.Title AS MaintenanceRequestTitle
FROM [dbo].[MaintenanceImages] mi
LEFT JOIN [maintenance].[MaintenanceRequests] mr ON mi.RefId = mr.Id
ORDER BY mi.Id DESC;

-- User Settings with Users
SELECT TOP (1000) 
    us.*,
    u.Email AS UserEmail,
    u.FirstName,
    u.LastName
FROM [dbo].[UserSettings] us
LEFT JOIN [core].[Users] u ON us.UserId = u.Id
ORDER BY us.Id DESC;

-- ============================================
-- DOCUMENT SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [document].[DocumentTemplates] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [document].[FileCategories] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [document].[Files] ORDER BY 1 DESC;

-- Files with Categories, Properties, Units, Leases
SELECT TOP (1000) 
    f.*,
    fc.Name AS CategoryName,
    p.Name AS PropertyName,
    u.Name AS UnitName,
    l.Name AS LeaseName,
    o.Name AS OrganizationName,
    u_created.Email AS CreatedByEmail,
    u_updated.Email AS UpdatedByEmail
FROM [document].[Files] f
LEFT JOIN [document].[FileCategories] fc ON f.CategoryId = fc.Id
LEFT JOIN [property].[Properties] p ON f.PropertyId = p.Id
LEFT JOIN [property].[Units] u ON f.UnitId = u.Id
LEFT JOIN [lease].[Leases] l ON f.LeaseId = l.Id
LEFT JOIN [organization].[Organizations] o ON f.OrganizationId = o.Id
LEFT JOIN [core].[Users] u_created ON f.CreatedBy = u_created.Id
LEFT JOIN [core].[Users] u_updated ON f.UpdatedBy = u_updated.Id
ORDER BY f.Id DESC;

-- ============================================
-- FINANCIAL SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [financial].[Accounts] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[BankAccounts] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[BankReconciliations] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[BankStatements] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[BankStatementTransactions] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[Deposits] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[ExpenseReceipts] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[Expenses] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[FutureExpenses] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[GeneralLedgerEntries] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[Payments] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[RecurringExpenses] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[TaxCategories] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [financial].[Vendors] ORDER BY 1 DESC;

-- Accounts with Organization and Parent Account
SELECT TOP (1000) 
    a.*,
    o.Name AS OrganizationName,
    pa.AccountName AS ParentAccountName
FROM [financial].[Accounts] a
LEFT JOIN [organization].[Organizations] o ON a.OrganizationId = o.Id
LEFT JOIN [financial].[Accounts] pa ON a.ParentAccountId = pa.Id
ORDER BY a.Id DESC;

-- Bank Statements with Transactions
SELECT TOP (1000) 
    bs.*,
    ba.DisplayName AS BankAccountName,
    bst.*
FROM [financial].[BankStatements] bs
LEFT JOIN [financial].[BankAccounts] ba ON bs.BankAccountId = ba.Id
LEFT JOIN [financial].[BankSt atementTransactions] bst ON bs.Id = bst.BankStatementId
ORDER BY bs.Id DESC;

-- Expenses with Vendor, Account, and Receipts
SELECT TOP (1000) 
    e.*,
    v.Name AS VendorName,
    a.AccountName,
    er.BlobName AS ReceiptBlobName,
    er.BlobUrl AS ReceiptBlobUrl
FROM [financial].[Expenses] e
LEFT JOIN [financial].[Vendors] v ON e.VendorId = v.Id
LEFT JOIN [financial].[Accounts] a ON e.AccountId = a.Id
LEFT JOIN [financial].[ExpenseReceipts] er ON e.Id = er.ExpenseId
ORDER BY e.Id DESC;

-- Payments with Lease (Note: Payment doesn't have TenantId, only LeaseId)
SELECT TOP (1000) 
    p.*,
    l.Name AS LeaseName,
    l.RentAmount AS LeaseRentAmount
FROM [financial].[Payments] p
LEFT JOIN [lease].[Leases] l ON p.LeaseId = l.Id
ORDER BY p.Id DESC;

-- Deposits with Lease
SELECT TOP (1000) 
    d.*,
    l.Name AS LeaseName,
    l.RentAmount,
    l.DepositAmount
FROM [financial].[Deposits] d
LEFT JOIN [lease].[Leases] l ON d.LeaseId = l.Id
ORDER BY d.Id DESC;

-- Bank Reconciliations with Bank Account
SELECT TOP (1000) 
    br.*,
    ba.DisplayName AS BankAccountName,
    ba.Last4 AS BankAccountLast4
FROM [financial].[BankReconciliations] br
LEFT JOIN [financial].[BankAccounts] ba ON br.BankAccountId = ba.Id
ORDER BY br.Id DESC;

-- General Ledger Entries with Accounts
SELECT TOP (1000) 
    gle.*,
    da.AccountName AS DebitAccountName,
    ca.AccountName AS CreditAccountName
FROM [financial].[GeneralLedgerEntries] gle
LEFT JOIN [financial].[Accounts] da ON gle.DebitAccountId = da.Id
LEFT JOIN [financial].[Accounts] ca ON gle.CreditAccountId = ca.Id
ORDER BY gle.Id DESC;

-- ============================================
-- INVITE SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [invite].[ApplicationInvites] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [invite].[LandlordInvites] ORDER BY 1 DESC;

-- ============================================
-- LEASE SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [lease].[LeaseFees] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease].[LeaseHistories] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease].[Leases] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease].[StateLateFeeLaws] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease].[TenantLeases] ORDER BY 1 DESC;

-- Leases with Unit, Property, Organization, and Tenants
SELECT TOP (1000) 
    l.*,
    u.Name AS UnitName,
    u.Bedrooms,
    u.Baths,
    p.Name AS PropertyName,
    p.StreetAddress + ', ' + p.City + ', ' + p.State + ' ' + p.ZipCode AS PropertyAddress,
    o.Name AS OrganizationName,
    t.Id AS TenantId,
    t.Firstname AS TenantFirstName,
    t.Lastname AS TenantLastName,
    t.Email AS TenantEmail
FROM [lease].[Leases] l
LEFT JOIN [property].[Units] u ON l.UnitId = u.Id
LEFT JOIN [property].[Properties] p ON u.PropertyId = p.Id
LEFT JOIN [organization].[Organizations] o ON l.OrganizationId = o.Id
LEFT JOIN [lease].[TenantLeases] tl ON l.Id = tl.LeaseId
LEFT JOIN [tenant].[Tenants] t ON tl.TenantId = t.Id
ORDER BY l.Id DESC;

-- Lease Fees with Lease
SELECT TOP (1000) 
    lf.*,
    l.Name AS LeaseName,
    l.RentAmount
FROM [lease].[LeaseFees] lf
LEFT JOIN [lease].[Leases] l ON lf.LeaseId = l.Id
ORDER BY lf.Id DESC;

-- Tenant Leases with Tenant and Lease Details
SELECT TOP (1000) 
    tl.*,
    t.Firstname AS TenantFirstName,
    t.Lastname AS TenantLastName,
    t.Email AS TenantEmail,
    l.Name AS LeaseName,
    l.StartDate,
    l.EndDate,
    l.RentAmount
FROM [lease].[TenantLeases] tl
LEFT JOIN [tenant].[Tenants] t ON tl.TenantId = t.Id
LEFT JOIN [lease].[Leases] l ON tl.LeaseId = l.Id
ORDER BY tl.Id DESC;

-- Lease Histories with Lease
SELECT TOP (1000) 
    lh.*,
    l.Name AS LeaseName
FROM [lease].[LeaseHistories] lh
LEFT JOIN [lease].[Leases] l ON lh.LeaseId = l.Id
ORDER BY lh.Id DESC;

-- ============================================
-- LEASE_BUILDER SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [lease_builder].[ClauseLibraries] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[LeaseDocuments] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[LeaseInstances] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[LeasePolicySections] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[LeaseTemplateDefaultPolicies] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[LeaseTemplatePolicies] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[LeaseTemplates] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[LeaseTemplateSections] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[LeaseVariables] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[PolicyPackItems] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [lease_builder].[PolicyPacks] ORDER BY 1 DESC;

-- Lease Templates with Sections and Policies
SELECT TOP (1000) 
    lt.*,
    lts.Name AS SectionName,
    ltp.Name AS PolicyName
FROM [lease_builder].[LeaseTemplates] lt
LEFT JOIN [lease_builder].[LeaseTemplateSections] lts ON lt.Id = lts.LeaseTemplateId
LEFT JOIN [lease_builder].[LeaseTemplatePolicies] ltp ON lts.Id = ltp.LeaseTemplateSectionId
ORDER BY lt.Id DESC;

-- Lease Instances with Lease Template
SELECT TOP (1000) 
    li.*,
    lt.Name AS TemplateName
FROM [lease_builder].[LeaseInstances] li
LEFT JOIN [lease_builder].[LeaseTemplates] lt ON li.LeaseTemplateId = lt.Id
ORDER BY li.Id DESC;

-- Policy Packs with Items
SELECT TOP (1000) 
    pp.*,
    ppi.PolicyName,
    ppi.PolicyContent
FROM [lease_builder].[PolicyPacks] pp
LEFT JOIN [lease_builder].[PolicyPackItems] ppi ON pp.Id = ppi.PolicyPackId
ORDER BY pp.Id DESC;

-- ============================================
-- LISTING SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [listing].[BasicAmenities] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [listing].[CustomAmenities] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [listing].[DefaultAmenities] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [listing].[ListingAmenities] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [listing].[ListingFeatures] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [listing].[ListingImages] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [listing].[Listings] ORDER BY 1 DESC;

-- Listings with Property, Unit, Organization, Images, Amenities, and Features
SELECT TOP (1000) 
    l.*,
    p.Name AS PropertyName,
    p.StreetAddress + ', ' + p.City + ', ' + p.State + ' ' + p.ZipCode AS PropertyAddress,
    u.Name AS UnitName,
    u.Bedrooms,
    u.Baths,
    o.Name AS OrganizationName,
    u_created.Email AS CreatedByEmail
FROM [listing].[Listings] l
LEFT JOIN [property].[Properties] p ON l.PropertyId = p.Id
LEFT JOIN [property].[Units] u ON l.UnitId = u.Id
LEFT JOIN [organization].[Organizations] o ON l.OrganizationId = o.Id
LEFT JOIN [core].[Users] u_created ON l.CreatedBy = u_created.Id
ORDER BY l.Id DESC;

-- Listings with Amenities
SELECT TOP (1000) 
    l.*,
    la.AmenityId,
    ba.Name AS BasicAmenityName,
    ca.Name AS CustomAmenityName
FROM [listing].[Listings] l
LEFT JOIN [listing].[ListingAmenities] la ON l.Id = la.ListingId
LEFT JOIN [listing].[BasicAmenities] ba ON la.AmenityId = ba.Id AND la.AmenityType = 'Basic'
LEFT JOIN [listing].[CustomAmenities] ca ON la.AmenityId = ca.Id AND la.AmenityType = 'Custom'
ORDER BY l.Id DESC;

-- Listings with Images
SELECT TOP (1000) 
    l.*,
    li.BlobName AS ImageBlobName,
    li.BlobUrl AS ImageBlobUrl,
    li.SortOrder
FROM [listing].[Listings] l
LEFT JOIN [listing].[ListingImages] li ON l.Id = li.RefId
ORDER BY l.Id DESC, li.SortOrder;

-- ============================================
-- MAINTENANCE SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [maintenance].[MaintenanceEvents] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [maintenance].[MaintenanceRequests] ORDER BY 1 DESC;

-- Maintenance Requests with Property, Unit, and Events
SELECT TOP (1000) 
    mr.*,
    p.Name AS PropertyName,
    p.StreetAddress + ', ' + p.City + ', ' + p.State + ' ' + p.ZipCode AS PropertyAddress,
    u.Name AS UnitName,
    me.EventType,
    me.Description AS EventDescription,
    me.CreatedAt AS EventCreatedAt
FROM [maintenance].[MaintenanceRequests] mr
LEFT JOIN [property].[Properties] p ON mr.PropertyId = p.Id
LEFT JOIN [property].[Units] u ON mr.UnitId = u.Id
LEFT JOIN [maintenance].[MaintenanceEvents] me ON mr.Id = me.MaintenanceRequestId
ORDER BY mr.Id DESC;

-- ============================================
-- ORGANIZATION SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [organization].[OrganizationInvites] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [organization].[OrganizationMembers] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [organization].[Organizations] ORDER BY 1 DESC;

-- Organizations with Members
SELECT TOP (1000) 
    o.*,
    om.UserId,
    u.Email AS MemberEmail,
    u.FirstName AS MemberFirstName,
    u.LastName AS MemberLastName
FROM [organization].[Organizations] o
LEFT JOIN [organization].[OrganizationMembers] om ON o.Id = om.OrganizationId
LEFT JOIN [core].[Users] u ON om.UserId = u.Id
ORDER BY o.Id DESC;

-- Organization Invites
SELECT TOP (1000) 
    oi.*,
    o.Name AS OrganizationName,
    u_inviter.Email AS InvitedByEmail
FROM [organization].[OrganizationInvites] oi
LEFT JOIN [organization].[Organizations] o ON oi.OrganizationId = o.Id
LEFT JOIN [core].[Users] u_inviter ON oi.InvitedBy = u_inviter.Id
ORDER BY oi.Id DESC;

-- ============================================
-- PROPERTY SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [property].[Properties] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [property].[Units] ORDER BY 1 DESC;

-- Properties with Organization, Units, and Operating Account
SELECT TOP (1000) 
    p.*,
    o.Name AS OrganizationName,
    u.Name AS UnitName,
    u.Bedrooms,
    u.Baths,
    ba.DisplayName AS OperatingAccountName
FROM [property].[Properties] p
LEFT JOIN [organization].[Organizations] o ON p.OrganizationId = o.Id
LEFT JOIN [property].[Units] u ON p.Id = u.PropertyId
LEFT JOIN [financial].[BankAccounts] ba ON p.OperatingAccountId = ba.Id
ORDER BY p.Id DESC;

-- Units with Property and Leases
SELECT TOP (1000) 
    u.*,
    p.Name AS PropertyName,
    p.StreetAddress + ', ' + p.City + ', ' + p.State + ' ' + p.ZipCode AS PropertyAddress,
    l.Id AS LeaseId,
    l.Name AS LeaseName,
    l.StartDate,
    l.EndDate,
    l.RentAmount AS LeaseRentAmount,
    l.IsActive AS LeaseIsActive
FROM [property].[Units] u
LEFT JOIN [property].[Properties] p ON u.PropertyId = p.Id
LEFT JOIN [lease].[Leases] l ON u.Id = l.UnitId
ORDER BY u.Id DESC;

-- ============================================
-- STAFF SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [staff].[StaffMemberInvites] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [staff].[StaffMembers] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [staff].[TimeBreaks] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [staff].[TimeEntries] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [staff].[TimeTrackingSettings] ORDER BY 1 DESC;

-- Staff Members with Organization and User
SELECT TOP (1000) 
    sm.*,
    o.Name AS OrganizationName,
    u.Email AS UserEmail,
    u.FirstName,
    u.LastName
FROM [staff].[StaffMembers] sm
LEFT JOIN [organization].[Organizations] o ON sm.OrganizationId = o.Id
LEFT JOIN [core].[Users] u ON sm.UserId = u.Id
ORDER BY sm.Id DESC;

-- Time Entries with Staff Member and Breaks
SELECT TOP (1000) 
    te.*,
    COALESCE(u.FirstName, sm.FirstName) AS StaffFirstName,
    COALESCE(u.LastName, sm.LastName) AS StaffLastName,
    tb.StartTime AS BreakStartTime,
    tb.EndTime AS BreakEndTime,
    tb.DurationMinutes AS BreakDurationMinutes
FROM [staff].[TimeEntries] te
LEFT JOIN [staff].[StaffMembers] sm ON te.StaffMemberId = sm.Id
LEFT JOIN [core].[Users] u ON sm.UserId = u.Id
LEFT JOIN [staff].[TimeBreaks] tb ON te.Id = tb.TimeEntryId
ORDER BY te.Id DESC;

-- ============================================
-- SUBSCRIPTION SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [subscription].[SubscriptionHistories] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [subscription].[SubscriptionPlans] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [subscription].[Subscriptions] ORDER BY 1 DESC;

-- Subscriptions with Plan and Organization
SELECT TOP (1000) 
    s.*,
    sp.Name AS PlanName,
    sp.Price AS PlanPrice,
    o.Name AS OrganizationName
FROM [subscription].[Subscriptions] s
LEFT JOIN [subscription].[SubscriptionPlans] sp ON s.PlanId = sp.Id
LEFT JOIN [organization].[Organizations] o ON s.OrganizationId = o.Id
ORDER BY s.Id DESC;

-- Subscription Histories with Subscription and Plan
SELECT TOP (1000) 
    sh.*,
    s.OrganizationId,
    sp.Name AS PlanName
FROM [subscription].[SubscriptionHistories] sh
LEFT JOIN [subscription].[Subscriptions] s ON sh.SubscriptionId = s.Id
LEFT JOIN [subscription].[SubscriptionPlans] sp ON sh.PlanId = sp.Id
ORDER BY sh.Id DESC;

-- ============================================
-- TENANT SCHEMA
-- ============================================
SELECT TOP (1000) * FROM [tenant].[RentalApplications] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [tenant].[TenantDocuments] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [tenant].[TenantInvites] ORDER BY 1 DESC;
SELECT TOP (1000) * FROM [tenant].[Tenants] ORDER BY 1 DESC;

-- Tenants with Leases
SELECT TOP (1000) 
    t.*,
    l.Id AS LeaseId,
    l.Name AS LeaseName,
    l.StartDate,
    l.EndDate,
    l.RentAmount,
    u.Name AS UnitName,
    p.Name AS PropertyName
FROM [tenant].[Tenants] t
LEFT JOIN [lease].[TenantLeases] tl ON t.Id = tl.TenantId
LEFT JOIN [lease].[Leases] l ON tl.LeaseId = l.Id
LEFT JOIN [property].[Units] u ON l.UnitId = u.Id
LEFT JOIN [property].[Properties] p ON u.PropertyId = p.Id
ORDER BY t.Id DESC;

-- Rental Applications with Converted Tenant and Property/Unit
SELECT TOP (1000) 
    ra.*,
    t.Firstname AS ConvertedTenantFirstName,
    t.Lastname AS ConvertedTenantLastName,
    t.Email AS ConvertedTenantEmail,
    p.Name AS PropertyName,
    u.Name AS UnitName
FROM [tenant].[RentalApplications] ra
LEFT JOIN [tenant].[Tenants] t ON ra.ConvertedToTenantId = t.Id
LEFT JOIN [property].[Properties] p ON ra.PropertyId = p.Id
LEFT JOIN [property].[Units] u ON ra.UnitId = u.Id
ORDER BY ra.Id DESC;

-- Tenant Documents with Tenant
SELECT TOP (1000) 
    td.*,
    t.Firstname AS TenantFirstName,
    t.Lastname AS TenantLastName,
    t.Email AS TenantEmail
FROM [tenant].[TenantDocuments] td
LEFT JOIN [tenant].[Tenants] t ON td.TenantId = t.Id
ORDER BY td.Id DESC;

-- ============================================
-- COMPREHENSIVE QUERIES
-- ============================================

-- Complete Property Overview (Property -> Units -> Leases -> Tenants -> Payments)
SELECT TOP (1000) 
    p.Id AS PropertyId,
    p.Name AS PropertyName,
    p.StreetAddress + ', ' + p.City + ', ' + p.State + ' ' + p.ZipCode AS PropertyAddress,
    u.Id AS UnitId,
    u.Name AS UnitName,
    l.Id AS LeaseId,
    l.Name AS LeaseName,
    l.RentAmount,
    l.StartDate,
    l.EndDate,
    t.Id AS TenantId,
    t.Firstname AS TenantFirstName,
    t.Lastname AS TenantLastName,
    t.Email AS TenantEmail,
    pay.Amount AS PaymentAmount,
    pay.PaymentDate,
    pay.Status AS PaymentStatus
FROM [property].[Properties] p
LEFT JOIN [property].[Units] u ON p.Id = u.PropertyId
LEFT JOIN [lease].[Leases] l ON u.Id = l.UnitId
LEFT JOIN [lease].[TenantLeases] tl ON l.Id = tl.LeaseId
LEFT JOIN [tenant].[Tenants] t ON tl.TenantId = t.Id
LEFT JOIN [financial].[Payments] pay ON l.Id = pay.LeaseId
ORDER BY p.Id DESC, u.Id, l.Id;

-- Organization Financial Summary (Organization -> Accounts -> Expenses -> Payments)
SELECT TOP (1000) 
    o.Id AS OrganizationId,
    o.Name AS OrganizationName,
    a.Id AS AccountId,
    a.AccountName,
    a.AccountType,
    e.Amount AS ExpenseAmount,
    e.Description AS ExpenseDescription,
    e.ExpenseDate,
    pay.Amount AS PaymentAmount,
    pay.PaymentDate
FROM [organization].[Organizations] o
LEFT JOIN [financial].[Accounts] a ON o.Id = a.OrganizationId
LEFT JOIN [financial].[Expenses] e ON a.Id = e.AccountId
LEFT JOIN [financial].[Payments] pay ON o.Id = pay.OrganizationId
ORDER BY o.Id DESC, a.Id;
