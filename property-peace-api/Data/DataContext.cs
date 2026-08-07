using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using FileEntity = brownstone_hub_api.Models.File;

namespace brownstone_hub_api.Data
{
    public class DataContext : DbContext
    {
        public DataContext(DbContextOptions<DataContext> options) : base(options) { }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            optionsBuilder.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Pull in all IEntityTypeConfiguration<T> from this assembly
            modelBuilder.ApplyConfigurationsFromAssembly(typeof(DataContext).Assembly);
        }

        public DbSet<MaintenanceEvent> MaintenanceEvents => Set<MaintenanceEvent>();
        public override int SaveChanges(bool acceptAllChangesOnSuccess)
        {
            RejectScreeningDeletionEvidenceMutation();
            return base.SaveChanges(acceptAllChangesOnSuccess);
        }

        public override Task<int> SaveChangesAsync(CancellationToken ct = default) =>
            SaveChangesAsync(acceptAllChangesOnSuccess: true, ct);

        public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken ct = default)
        {
            RejectScreeningDeletionEvidenceMutation();
            var now = DateTime.Now;

            foreach (var entry in ChangeTracker.Entries<MaintenanceRequest>())
            {
                if (entry.State == EntityState.Added)
                {
                    entry.Entity.CreatedAt = now;
                    entry.Entity.UpdatedAt = now;
                    continue;
                }

                if (entry.State == EntityState.Modified)
                {
                    entry.Entity.UpdatedAt = now;

                    // status changed?
                    var statusProp = entry.Property(x => x.Status);
                    if (statusProp.IsModified)
                    {
                        var from = (EMaintenanceStatus)statusProp.OriginalValue!;
                        var to = (EMaintenanceStatus)statusProp.CurrentValue!;

                        MaintenanceEvents.Add(new MaintenanceEvent
                        {
                            MaintenanceId = entry.Entity.Id,
                            EventType = MaintenanceEventType.StatusChanged,
                            FromValue = ToCamel(from.ToString()),
                            ToValue = ToCamel(to.ToString()),
                            // ChangedByUserId = CurrentUserId; // see note below
                            ChangedAt = now
                        });

                        if (to == EMaintenanceStatus.Resolved)
                        {
                            entry.Entity.CompletedAt = now;
                        }
                        else
                            entry.Entity.CompletedAt = null; // in case you reopen
                    }
                }

                // priority changed?
                var priProp = entry.Property(x => x.Priority);
                if (priProp.IsModified)
                {
                    var from = (EMaintenancePriority)priProp.OriginalValue!;
                    var to = (EMaintenancePriority)priProp.CurrentValue!;

                    MaintenanceEvents.Add(new MaintenanceEvent
                    {
                        MaintenanceId = entry.Entity.Id,
                        EventType = MaintenanceEventType.PriorityChanged,
                        FromValue = ToCamel(from.ToString()),
                        ToValue = ToCamel(to.ToString()),
                        ChangedAt = now
                    });
                }
            }
            return await base.SaveChangesAsync(acceptAllChangesOnSuccess, ct);

            static string ToCamel(string s) =>
                string.IsNullOrEmpty(s) ? s : char.ToLowerInvariant(s[0]) + s[1..];
        }

        private void RejectScreeningDeletionEvidenceMutation()
        {
            // Compliance evidence is append-only at the context boundary. Aggregates which carry an
            // explicitly mutable lifecycle are handled separately so their immutable facts cannot be rewritten.
            RejectAppendOnly<ScreeningPaymentEvidence>();
            RejectAppendOnly<ScreeningTransitionEvent>();
            RejectAppendOnly<ScreeningConsentEvidence>();
            RejectAppendOnly<ScreeningReportDeletionEvent>();
            RejectAppendOnly<ScreeningDisputeEvent>();
            RejectAppendOnly<ScreeningReconsiderationEvent>();
            RejectAppendOnly<ScreeningIncidentEvent>();
            RejectAppendOnly<ScreeningAdverseAction>();
            RejectImmutableChanges<ScreeningWebhookInboxEvent>(nameof(ScreeningWebhookInboxEvent.ProcessedAt),
                nameof(ScreeningWebhookInboxEvent.ProcessingLeaseId), nameof(ScreeningWebhookInboxEvent.ProcessingLeaseUntil),
                nameof(ScreeningWebhookInboxEvent.ProcessingStatus), nameof(ScreeningWebhookInboxEvent.ProcessingAttempts),
                nameof(ScreeningWebhookInboxEvent.NextAttemptAt), nameof(ScreeningWebhookInboxEvent.FailureCode),
                nameof(ScreeningWebhookInboxEvent.FailureDetail), nameof(ScreeningWebhookInboxEvent.DuplicateCount),
                nameof(ScreeningWebhookInboxEvent.LastDuplicateReceivedAt), nameof(ScreeningWebhookInboxEvent.SecurityIncidentCode),
                nameof(ScreeningWebhookInboxEvent.SecurityIncidentCount), nameof(ScreeningWebhookInboxEvent.LastSecurityIncidentAt),
                nameof(ScreeningWebhookInboxEvent.TenantScreeningOrderId), nameof(ScreeningWebhookInboxEvent.RowVersion));
            RejectImmutableChanges<ScreeningCancellationIntent>(nameof(ScreeningCancellationIntent.Status),
                nameof(ScreeningCancellationIntent.Attempts), nameof(ScreeningCancellationIntent.ProcessingLeaseId),
                nameof(ScreeningCancellationIntent.ProcessingLeaseUntil), nameof(ScreeningCancellationIntent.NextAttemptAt), nameof(ScreeningCancellationIntent.ProviderAcceptedAt),
                nameof(ScreeningCancellationIntent.CompletedAt), nameof(ScreeningCancellationIntent.ProviderReference),
                nameof(ScreeningCancellationIntent.FailureCode), nameof(ScreeningCancellationIntent.RowVersion));
            RejectImmutableChanges<ScreeningDisputeIntent>(nameof(ScreeningDisputeIntent.Status),
                nameof(ScreeningDisputeIntent.Attempts), nameof(ScreeningDisputeIntent.ProcessingLeaseId),
                nameof(ScreeningDisputeIntent.ProcessingLeaseUntil), nameof(ScreeningDisputeIntent.NextAttemptAt), nameof(ScreeningDisputeIntent.ProviderAcceptedAt),
                nameof(ScreeningDisputeIntent.CompletedAt), nameof(ScreeningDisputeIntent.ProviderReference),
                nameof(ScreeningDisputeIntent.FailureCode), nameof(ScreeningDisputeIntent.RowVersion));
            RejectImmutableChanges<ScreeningReportAccessAudit>(nameof(ScreeningReportAccessAudit.Status),
                nameof(ScreeningReportAccessAudit.CompletedAt), nameof(ScreeningReportAccessAudit.GrantExpiresAt),
                nameof(ScreeningReportAccessAudit.GrantReference), nameof(ScreeningReportAccessAudit.FailureCode));
            RejectImmutableChanges<ScreeningAdverseActionDeliveryAttempt>(nameof(ScreeningAdverseActionDeliveryAttempt.Status),
                nameof(ScreeningAdverseActionDeliveryAttempt.AttemptedAt), nameof(ScreeningAdverseActionDeliveryAttempt.DeliveredAt),
                nameof(ScreeningAdverseActionDeliveryAttempt.ProviderDeliveryReference), nameof(ScreeningAdverseActionDeliveryAttempt.FailureCode),
                nameof(ScreeningAdverseActionDeliveryAttempt.ProcessingLeaseId), nameof(ScreeningAdverseActionDeliveryAttempt.ProcessingLeaseUntil),
                nameof(ScreeningAdverseActionDeliveryAttempt.NextAttemptAt), nameof(ScreeningAdverseActionDeliveryAttempt.RowVersion));
            RejectImmutableChanges<ScreeningSupportElevation>(nameof(ScreeningSupportElevation.RevokedAt),
                nameof(ScreeningSupportElevation.RevokedByUserId), nameof(ScreeningSupportElevation.AccessCount),
                nameof(ScreeningSupportElevation.RowVersion));
            RejectImmutableChanges<ScreeningDispute>(nameof(ScreeningDispute.Status), nameof(ScreeningDispute.ResolvedAt),
                nameof(ScreeningDispute.CorrectedScreeningReportRevisionId));
            RejectImmutableChanges<ScreeningIncident>(nameof(ScreeningIncident.Status), nameof(ScreeningIncident.ContainedAt),
                nameof(ScreeningIncident.ResolvedAt), nameof(ScreeningIncident.ActorUserId),
                nameof(ScreeningIncident.RemediationEvidenceReference), nameof(ScreeningIncident.NotificationEvidenceReference));
            RejectImmutableChanges<ScreeningRentalDecisionRevision>(nameof(ScreeningRentalDecisionRevision.IsFrozenByDispute),
                nameof(ScreeningRentalDecisionRevision.DisputeStatus));
            RejectImmutableChanges<ScreeningReportRevision>(nameof(ScreeningReportRevision.DeleteRequestedAt),
                nameof(ScreeningReportRevision.DeletedAt), nameof(ScreeningReportRevision.NormalizedFactsJson),
                nameof(ScreeningReportRevision.IsUnderLegalHold), nameof(ScreeningReportRevision.LegalHoldPlacedAt),
                nameof(ScreeningReportRevision.LegalHoldReleasedAt), nameof(ScreeningReportRevision.LegalHoldReasonCode),
                nameof(ScreeningReportRevision.DeletionClaimToken), nameof(ScreeningReportRevision.DeletionClaimedAt),
                nameof(ScreeningReportRevision.DeletionClaimExpiresAt), nameof(ScreeningReportRevision.DeletionProviderCallStartedAt),
                nameof(ScreeningReportRevision.PendingDisputeOperationId));
        }

        private void RejectAppendOnly<TEntity>() where TEntity : class
        {
            if (ChangeTracker.Entries<TEntity>().Any(entry => entry.State is EntityState.Modified or EntityState.Deleted))
                throw new InvalidOperationException($"{typeof(TEntity).Name} evidence is append-only.");
        }

        private void RejectImmutableChanges<TEntity>(params string[] mutableLifecycleProperties) where TEntity : class
        {
            var allowed = mutableLifecycleProperties.ToHashSet(StringComparer.Ordinal);
            foreach (var entry in ChangeTracker.Entries<TEntity>())
            {
                if (entry.State == EntityState.Deleted ||
                    entry.State == EntityState.Modified && entry.Properties.Any(p => p.IsModified && !allowed.Contains(p.Metadata.Name)))
                    throw new InvalidOperationException($"{typeof(TEntity).Name} immutable evidence is append-only.");
            }
        }



        public DbSet<User> Users => Set<User>();
        public DbSet<UserRefreshToken> UserRefreshTokens => Set<UserRefreshToken>();
        public DbSet<ImpersonationSession> ImpersonationSessions => Set<ImpersonationSession>();
        public DbSet<ImpersonationAuditRecord> ImpersonationAuditRecords => Set<ImpersonationAuditRecord>();
        public DbSet<PasskeyCredential> PasskeyCredentials => Set<PasskeyCredential>();
        public DbSet<PasskeyCeremony> PasskeyCeremonies => Set<PasskeyCeremony>();
        public DbSet<MfaEnrollment> MfaEnrollments => Set<MfaEnrollment>();
        public DbSet<MfaChallenge> MfaChallenges => Set<MfaChallenge>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<UserRole> UserRoles => Set<UserRole>();
        public DbSet<UserSettings> UserSettings => Set<UserSettings>();
        public DbSet<NotificationSetting> NotificationSettings => Set<NotificationSetting>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<Announcement> Announcements => Set<Announcement>();
        public DbSet<AnnouncementRecipient> AnnouncementRecipients => Set<AnnouncementRecipient>();
        public DbSet<Admin> Admins => Set<Admin>();
        public DbSet<AdminSettings> AdminSettings => Set<AdminSettings>();
        public DbSet<Property> Properties => Set<Property>();
        public DbSet<PropertyImage> PropertyImages => Set<PropertyImage>();
        public DbSet<Unit> Units => Set<Unit>();
        public DbSet<Tenant> Tenants => Set<Tenant>();
        public DbSet<TenantLease> TenantLeases => Set<TenantLease>();
        public DbSet<TenantInvite> TenantInvites => Set<TenantInvite>();
        public DbSet<LandlordInvite> LandlordInvites => Set<LandlordInvite>();
        public DbSet<ApplicationInvite> ApplicationInvites => Set<ApplicationInvite>();
        public DbSet<UnitLifecycleEvent> UnitLifecycleEvents => Set<UnitLifecycleEvent>();
        public DbSet<Lead> Leads => Set<Lead>();
        public DbSet<LeadSource> LeadSources => Set<LeadSource>();
        public DbSet<PreScreenConfiguration> PreScreenConfigurations => Set<PreScreenConfiguration>();
        public DbSet<PreScreenResponse> PreScreenResponses => Set<PreScreenResponse>();
        public DbSet<ShowingAvailability> ShowingAvailabilities => Set<ShowingAvailability>();
        public DbSet<Showing> Showings => Set<Showing>();
        public DbSet<LeadNote> LeadNotes => Set<LeadNote>();
        public DbSet<LeadTask> LeadTasks => Set<LeadTask>();
        public DbSet<LeadNotificationIntent> LeadNotificationIntents => Set<LeadNotificationIntent>();
        public DbSet<LeadTokenDelivery> LeadTokenDeliveries => Set<LeadTokenDelivery>();
        public DbSet<ShowingOperation> ShowingOperations => Set<ShowingOperation>();
        public DbSet<Lease> Leases => Set<Lease>();
        public DbSet<LeaseAgreement> LeaseAgreements => Set<LeaseAgreement>();
        public DbSet<LeaseHistory> LeaseHistories => Set<LeaseHistory>();
        public DbSet<LeaseFee> LeaseFees => Set<LeaseFee>();
        public DbSet<LeaseLandlord> LeaseLandlords => Set<LeaseLandlord>();
        public DbSet<LeaseDeposit> LeaseDeposits => Set<LeaseDeposit>();
        public DbSet<Pet> Pets => Set<Pet>();
        public DbSet<Parking> Parking => Set<Parking>();
        public DbSet<UtilityServiceResponsibility> UtilityServiceResponsibilities => Set<UtilityServiceResponsibility>();
        public DbSet<MaintenanceResponsibility> MaintenanceResponsibilities => Set<MaintenanceResponsibility>();
        public DbSet<LeaseKey> LeaseKeys => Set<LeaseKey>();
        public DbSet<LeaseCoSigner> LeaseCoSigners => Set<LeaseCoSigner>();
        public DbSet<LeaseAdditionalSigner> LeaseAdditionalSigners => Set<LeaseAdditionalSigner>();
        public DbSet<LeaseOccupant> LeaseOccupants => Set<LeaseOccupant>();
        public DbSet<StateLateFeeLaw> StateLateFeeLaws => Set<StateLateFeeLaw>();
        public DbSet<StateDepositLaw> StateDepositLaws => Set<StateDepositLaw>();
        public DbSet<JobRunHistory> JobRunHistories => Set<JobRunHistory>();
        public DbSet<StateLawSource> StateLawSources => Set<StateLawSource>();
        public DbSet<LeaseShieldConversation> LeaseShieldConversations => Set<LeaseShieldConversation>();
        public DbSet<LeaseShieldMessage> LeaseShieldMessages => Set<LeaseShieldMessage>();
        public DbSet<LeaseShieldStateLawSource> LeaseShieldStateLawSources => Set<LeaseShieldStateLawSource>();
        public DbSet<LeaseShieldStateLawSection> LeaseShieldStateLawSections => Set<LeaseShieldStateLawSection>();
        public DbSet<MaintenanceRequest> MaintenanceRequests => Set<MaintenanceRequest>();
        public DbSet<MaintenanceCategory> MaintenanceCategories => Set<MaintenanceCategory>();
        public DbSet<MaintenanceImage> MaintenanceImages => Set<MaintenanceImage>();
        public DbSet<Amenity> Amenities => Set<Amenity>();
        public DbSet<IncludedUtility> IncludedUtilities => Set<IncludedUtility>();
        public DbSet<Payment> Payments => Set<Payment>();
        public DbSet<StripePaymentMethod> StripePaymentMethods => Set<StripePaymentMethod>();
        public DbSet<StripeWebhookEvent> StripeWebhookEvents => Set<StripeWebhookEvent>();
        public DbSet<StripeRentPayment> StripeRentPayments => Set<StripeRentPayment>();
        public DbSet<StripeConnectedPayeeReview> StripeConnectedPayeeReviews => Set<StripeConnectedPayeeReview>();
        public DbSet<StorageObject> StorageObjects => Set<StorageObject>();
        public DbSet<Deposit> Deposits => Set<Deposit>();
        public DbSet<Expense> Expenses => Set<Expense>();
        public DbSet<ExpenseReceipt> ExpenseReceipts => Set<ExpenseReceipt>();
        public DbSet<TaxCategory> TaxCategories => Set<TaxCategory>();
        public DbSet<RecurringExpense> RecurringExpenses => Set<RecurringExpense>();
        public DbSet<FutureExpense> FutureExpenses => Set<FutureExpense>();
        public DbSet<Vendor> Vendors => Set<Vendor>();
        public DbSet<TenantDocument> TenantDocuments => Set<TenantDocument>();
        public DbSet<DocumentTemplate> DocumentTemplates => Set<DocumentTemplate>();
        public DbSet<RentalApplication> RentalApplications => Set<RentalApplication>();
        public DbSet<TenantScreeningOrder> TenantScreeningOrders => Set<TenantScreeningOrder>();
        public DbSet<ScreeningTransitionEvent> ScreeningTransitionEvents => Set<ScreeningTransitionEvent>();
        public DbSet<ScreeningConsentEvidence> ScreeningConsentEvidence => Set<ScreeningConsentEvidence>();
        public DbSet<ScreeningPaymentEvidence> ScreeningPaymentEvidence => Set<ScreeningPaymentEvidence>();
        public DbSet<ScreeningWebhookInboxEvent> ScreeningWebhookInboxEvents => Set<ScreeningWebhookInboxEvent>();
        public DbSet<ScreeningCancellationIntent> ScreeningCancellationIntents => Set<ScreeningCancellationIntent>();
        public DbSet<ScreeningReportAccessAudit> ScreeningReportAccessAudits => Set<ScreeningReportAccessAudit>();
        public DbSet<ScreeningSupportElevation> ScreeningSupportElevations => Set<ScreeningSupportElevation>();
        public DbSet<ScreeningReportRevision> ScreeningReportRevisions => Set<ScreeningReportRevision>();
        public DbSet<ScreeningReportDeletionEvent> ScreeningReportDeletionEvents => Set<ScreeningReportDeletionEvent>();
        public DbSet<ScreeningRentalDecisionRevision> ScreeningRentalDecisionRevisions => Set<ScreeningRentalDecisionRevision>();
        public DbSet<ScreeningDispute> ScreeningDisputes => Set<ScreeningDispute>();
        public DbSet<ScreeningDisputeIntent> ScreeningDisputeIntents => Set<ScreeningDisputeIntent>();
        public DbSet<ScreeningDisputeEvent> ScreeningDisputeEvents => Set<ScreeningDisputeEvent>();
        public DbSet<ScreeningAdverseAction> ScreeningAdverseActions => Set<ScreeningAdverseAction>();
        public DbSet<ScreeningAdverseActionDeliveryAttempt> ScreeningAdverseActionDeliveryAttempts => Set<ScreeningAdverseActionDeliveryAttempt>();
        public DbSet<ScreeningReconsiderationEvent> ScreeningReconsiderationEvents => Set<ScreeningReconsiderationEvent>();
        public DbSet<ScreeningIncident> ScreeningIncidents => Set<ScreeningIncident>();
        public DbSet<ScreeningIncidentEvent> ScreeningIncidentEvents => Set<ScreeningIncidentEvent>();
        public DbSet<Checklist> Checklists => Set<Checklist>();
        public DbSet<ChecklistItem> ChecklistItems => Set<ChecklistItem>();
        public DbSet<OrganizationChecklistItem> OrganizationChecklistItems => Set<OrganizationChecklistItem>();
        public DbSet<OrganizationMoveInReportTemplate> OrganizationMoveInReportTemplates => Set<OrganizationMoveInReportTemplate>();
        public DbSet<OrganizationReportSpace> OrganizationReportSpaces => Set<OrganizationReportSpace>();
        public DbSet<OrganizationReportSpaceItem> OrganizationReportSpaceItems => Set<OrganizationReportSpaceItem>();
        public DbSet<Conversation> Conversations => Set<Conversation>();
        public DbSet<Message> Messages => Set<Message>();
        public DbSet<ConversationParticipant> ConversationParticipants => Set<ConversationParticipant>();
        public DbSet<MessageRead> MessageReads => Set<MessageRead>();
        public DbSet<OrganizationSmsNumber> OrganizationSmsNumbers => Set<OrganizationSmsNumber>();

        // Subscriptions
        public DbSet<SubscriptionPlan> SubscriptionPlans => Set<SubscriptionPlan>();
        public DbSet<Subscription> Subscriptions => Set<Subscription>();
        public DbSet<SubscriptionHistory> SubscriptionHistories => Set<SubscriptionHistory>();

        // Logging
        public DbSet<LoggingTrace> LoggingTrace => Set<LoggingTrace>();
        public DbSet<LoggingException> LoggingException => Set<LoggingException>();
        public DbSet<LoggingDataExchange> LoggingDataExchange => Set<LoggingDataExchange>();

        // Support and Feedback
        public DbSet<SupportAndFeedback> SupportAndFeedbacks => Set<SupportAndFeedback>();

        // Email Verification
        public DbSet<EmailVerification> EmailVerifications => Set<EmailVerification>();

        // Upcoming Features
        public DbSet<UpcomingFeature> UpcomingFeatures => Set<UpcomingFeature>();

        // Organizations
        public DbSet<Organization> Organizations => Set<Organization>();
        public DbSet<OrganizationMember> OrganizationMembers => Set<OrganizationMember>();
        public DbSet<OrganizationInvite> OrganizationInvites => Set<OrganizationInvite>();

        // Clients
        public DbSet<Client> Clients => Set<Client>();
        public DbSet<ClientInvite> ClientInvites => Set<ClientInvite>();

        // Bank Accounts
        public DbSet<BankAccount> BankAccounts => Set<BankAccount>();

        // Accounts (Chart of Accounts)
        public DbSet<Account> Accounts => Set<Account>();

        // General Ledger
        public DbSet<GeneralLedgerEntry> GeneralLedgerEntries => Set<GeneralLedgerEntry>();

        // Bank Reconciliation
        public DbSet<BankStatement> BankStatements => Set<BankStatement>();
        public DbSet<BankStatementTransaction> BankStatementTransactions => Set<BankStatementTransaction>();
        public DbSet<BankReconciliation> BankReconciliations => Set<BankReconciliation>();

        // Lease Builder
        public DbSet<LeaseTemplate> LeaseTemplates => Set<LeaseTemplate>();
        public DbSet<LeaseTemplatePolicy> LeaseTemplatePolicies => Set<LeaseTemplatePolicy>();
        public DbSet<LeaseTemplateDefaultPolicy> LeaseTemplateDefaultPolicies => Set<LeaseTemplateDefaultPolicy>();

        // Files
        public DbSet<FileEntity> Files => Set<FileEntity>();
        public DbSet<FileCategory> FileCategories => Set<FileCategory>();
        public DbSet<LeaseTemplateSection> LeaseTemplateSections => Set<LeaseTemplateSection>();
        public DbSet<ClauseLibrary> ClauseLibraries => Set<ClauseLibrary>();
        public DbSet<PolicyPack> PolicyPacks => Set<PolicyPack>();
        public DbSet<PolicyPackItem> PolicyPackItems => Set<PolicyPackItem>();
        public DbSet<LeaseInstance> LeaseInstances => Set<LeaseInstance>();
        public DbSet<LeaseVariable> LeaseVariables => Set<LeaseVariable>();
        public DbSet<LeaseDocument> LeaseDocuments => Set<LeaseDocument>();
        public DbSet<LeasePolicySection> LeasePolicySections => Set<LeasePolicySection>();

        // Demo Requests
        public DbSet<DemoRequest> DemoRequests => Set<DemoRequest>();

        // Action Suppressions
        public DbSet<ActionSuppression> ActionSuppressions => Set<ActionSuppression>();

        // Collections Agent History
        public DbSet<CollectionsAgentAction> CollectionsAgentActions => Set<CollectionsAgentAction>();

        // Percy (dedicated AI conversation persistence)
        public DbSet<PercyConversation> PercyConversations => Set<PercyConversation>();
        public DbSet<PercyMessage> PercyMessages => Set<PercyMessage>();
        public DbSet<PercyActionConfirmation> PercyActionConfirmations => Set<PercyActionConfirmation>();
        public DbSet<PercyAuditRecord> PercyAuditRecords => Set<PercyAuditRecord>();

        // Time Tracking
        public DbSet<StaffMember> StaffMembers => Set<StaffMember>();
        public DbSet<StaffMemberInvite> StaffMemberInvites => Set<StaffMemberInvite>();
        public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();
        public DbSet<TimeBreak> TimeBreaks => Set<TimeBreak>();
        public DbSet<TimeTrackingSettings> TimeTrackingSettings => Set<TimeTrackingSettings>();

        // Listings
        public DbSet<Listing> Listings => Set<Listing>();
        public DbSet<ListingImage> ListingImages => Set<ListingImage>();
        public DbSet<DefaultAmenity> DefaultAmenities => Set<DefaultAmenity>();
        public DbSet<BasicAmenity> BasicAmenities => Set<BasicAmenity>();
        public DbSet<CustomAmenity> CustomAmenities => Set<CustomAmenity>();
        public DbSet<DefaultFeature> DefaultFeatures => Set<DefaultFeature>();
        public DbSet<CustomFeature> CustomFeatures => Set<CustomFeature>();
        public DbSet<ListingBasicAmenity> ListingBasicAmenities => Set<ListingBasicAmenity>();
        public DbSet<ListingAmenity> ListingAmenities => Set<ListingAmenity>();
        public DbSet<ListingFeature> ListingFeatures => Set<ListingFeature>();
        public DbSet<RentEstimateCache> RentEstimateCache => Set<RentEstimateCache>();
        public DbSet<Models.LandlordTask> LandlordTasks => Set<Models.LandlordTask>();
    }
}
