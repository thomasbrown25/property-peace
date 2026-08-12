BEGIN TRANSACTION;
IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var sysname;
    SELECT @var = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'BackgroundCheckOverallPass');
    IF @var IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [BackgroundCheckOverallPass];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var1 sysname;
    SELECT @var1 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'BackgroundCheckProvider');
    IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var1 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [BackgroundCheckProvider];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var2 sysname;
    SELECT @var2 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'BackgroundCheckRejectionReason');
    IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var2 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [BackgroundCheckRejectionReason];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var3 sysname;
    SELECT @var3 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'BackgroundCheckReportUrl');
    IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var3 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [BackgroundCheckReportUrl];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var4 sysname;
    SELECT @var4 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'BackgroundCheckRequestId');
    IF @var4 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var4 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [BackgroundCheckRequestId];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var5 sysname;
    SELECT @var5 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'BackgroundCheckRequested');
    IF @var5 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var5 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [BackgroundCheckRequested];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var6 sysname;
    SELECT @var6 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'BackgroundCheckRequestedAt');
    IF @var6 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var6 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [BackgroundCheckRequestedAt];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var7 sysname;
    SELECT @var7 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'BackgroundCheckStatus');
    IF @var7 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var7 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [BackgroundCheckStatus];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var8 sysname;
    SELECT @var8 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'BackgroundCheckSummary');
    IF @var8 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var8 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [BackgroundCheckSummary];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var9 sysname;
    SELECT @var9 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'CreditScore');
    IF @var9 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var9 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [CreditScore];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var10 sysname;
    SELECT @var10 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'PassedCreditCheck');
    IF @var10 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var10 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [PassedCreditCheck];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var11 sysname;
    SELECT @var11 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'PassedCriminalCheck');
    IF @var11 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var11 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [PassedCriminalCheck];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var12 sysname;
    SELECT @var12 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'PassedEvictionCheck');
    IF @var12 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var12 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [PassedEvictionCheck];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var13 sysname;
    SELECT @var13 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'PassedIncomeVerification');
    IF @var13 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var13 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [PassedIncomeVerification];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    DECLARE @var14 sysname;
    SELECT @var14 = [d].[name]
    FROM [sys].[default_constraints] [d]
    INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
    WHERE ([d].[parent_object_id] = OBJECT_ID(N'[tenant].[RentalApplications]') AND [c].[name] = N'Ssn');
    IF @var14 IS NOT NULL EXEC(N'ALTER TABLE [tenant].[RentalApplications] DROP CONSTRAINT [' + @var14 + '];');
    ALTER TABLE [tenant].[RentalApplications] DROP COLUMN [Ssn];
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    IF SCHEMA_ID(N'screening') IS NULL EXEC(N'CREATE SCHEMA [screening];');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningSupportElevations] (
        [Id] bigint NOT NULL IDENTITY,
        [OrganizationId] bigint NOT NULL,
        [SubjectUserId] bigint NOT NULL,
        [ApprovedByUserId] bigint NOT NULL,
        [CaseReference] nvarchar(200) NOT NULL,
        [Reason] nvarchar(500) NOT NULL,
        [Purpose] nvarchar(32) NOT NULL,
        [IssuedAt] datetimeoffset(7) NOT NULL,
        [ExpiresAt] datetimeoffset(7) NOT NULL,
        [RevokedAt] datetimeoffset(7) NULL,
        [RevokedByUserId] bigint NULL,
        [MaximumAccessCount] int NOT NULL,
        [AccessCount] int NOT NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT [PK_ScreeningSupportElevations] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningSupportElevations_Approver] CHECK ([ApprovedByUserId] <> [SubjectUserId]),
        CONSTRAINT [CK_ScreeningSupportElevations_Count] CHECK ([MaximumAccessCount] > 0 AND [AccessCount] >= 0 AND [AccessCount] <= [MaximumAccessCount]),
        CONSTRAINT [CK_ScreeningSupportElevations_Lifetime] CHECK ([ExpiresAt] > [IssuedAt]),
        CONSTRAINT [FK_ScreeningSupportElevations_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningSupportElevations_Users_ApprovedByUserId] FOREIGN KEY ([ApprovedByUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningSupportElevations_Users_RevokedByUserId] FOREIGN KEY ([RevokedByUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningSupportElevations_Users_SubjectUserId] FOREIGN KEY ([SubjectUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[TenantScreeningOrders] (
        [Id] bigint NOT NULL IDENTITY,
        [OrganizationId] bigint NOT NULL,
        [RentalApplicationId] bigint NOT NULL,
        [PropertyId] bigint NOT NULL,
        [UnitId] bigint NULL,
        [ListingId] bigint NULL,
        [ApplicantAccessTokenHash] char(64) NULL,
        [ApplicantAccessExpiresAt] datetimeoffset(7) NULL,
        [InvitationIdempotencyKeyHash] char(64) NOT NULL,
        [Status] nvarchar(32) NOT NULL,
        [CurrentRevision] bigint NOT NULL,
        [PackageCode] nvarchar(100) NOT NULL,
        [JurisdictionCode] char(2) NOT NULL,
        [Payer] nvarchar(32) NOT NULL,
        [QuoteReference] nvarchar(200) NOT NULL,
        [LandlordAmountMinor] bigint NOT NULL,
        [ApplicantAmountMinor] bigint NOT NULL,
        [ProviderAmountMinor] bigint NOT NULL,
        [PlatformFeeMinor] bigint NOT NULL,
        [TaxAmountMinor] bigint NOT NULL,
        [TotalAmountMinor] bigint NOT NULL,
        [Currency] char(3) NOT NULL,
        [QuoteExpiresAt] datetimeoffset(7) NOT NULL,
        [QuotePolicyVersion] nvarchar(100) NOT NULL,
        [ProviderKey] nvarchar(100) NOT NULL,
        [ProviderOrderId] nvarchar(200) NULL,
        [RequesterUserId] bigint NOT NULL,
        [RequesterMemberId] bigint NOT NULL,
        [RequesterMemberRole] nvarchar(100) NOT NULL,
        [RequesterPermissionSnapshot] nvarchar(200) NOT NULL,
        [RequesterAuthorityVerifiedAt] datetimeoffset(7) NOT NULL,
        [PermissiblePurposeStatement] nvarchar(2000) NOT NULL,
        [PermissiblePurposeVersion] nvarchar(100) NOT NULL,
        [DisclosureStatement] nvarchar(4000) NOT NULL,
        [DisclosureVersion] nvarchar(100) NOT NULL,
        [AuthorizationStatement] nvarchar(4000) NOT NULL,
        [AuthorizationVersion] nvarchar(100) NOT NULL,
        [RentalCriteriaStatement] nvarchar(4000) NOT NULL,
        [RentalCriteriaVersion] nvarchar(100) NOT NULL,
        [PricingPolicyVersion] nvarchar(100) NOT NULL,
        [AllowedChecksJson] nvarchar(2000) NOT NULL,
        [MaximumApplicantTotalMinor] bigint NULL,
        [ApplicantTotalExpresslyUnrestricted] bit NOT NULL,
        [MaximumPlatformFeeMinor] bigint NOT NULL,
        [MarkupPermitted] bit NOT NULL,
        [MinimumQuoteLifetimeSeconds] bigint NOT NULL,
        [MaximumQuoteLifetimeSeconds] bigint NOT NULL,
        [CreatedAt] datetimeoffset(7) NOT NULL,
        [UpdatedAt] datetimeoffset(7) NOT NULL,
        [CompletedAt] datetimeoffset(7) NULL,
        [ExpiredAt] datetimeoffset(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT [PK_TenantScreeningOrders] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_TenantScreeningOrders_QuoteAmounts] CHECK ([LandlordAmountMinor] >= 0 AND [ApplicantAmountMinor] >= 0 AND [ProviderAmountMinor] >= 0 AND [PlatformFeeMinor] >= 0 AND [TaxAmountMinor] >= 0 AND [TotalAmountMinor] = [LandlordAmountMinor] + [ApplicantAmountMinor] AND [TotalAmountMinor] = [ProviderAmountMinor] + [PlatformFeeMinor] + [TaxAmountMinor]),
        CONSTRAINT [CK_TenantScreeningOrders_Revision] CHECK ([CurrentRevision] >= 0),
        CONSTRAINT [FK_TenantScreeningOrders_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TenantScreeningOrders_Properties_PropertyId] FOREIGN KEY ([PropertyId]) REFERENCES [property].[Properties] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TenantScreeningOrders_RentalApplications_RentalApplicationId] FOREIGN KEY ([RentalApplicationId]) REFERENCES [tenant].[RentalApplications] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_TenantScreeningOrders_Users_RequesterUserId] FOREIGN KEY ([RequesterUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningCancellationIntents] (
        [Id] bigint NOT NULL IDENTITY,
        [OperationId] uniqueidentifier NOT NULL,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [RentalApplicationId] bigint NOT NULL,
        [ActorUserId] bigint NOT NULL,
        [ExpectedOrderRevision] bigint NOT NULL,
        [ProviderKey] nvarchar(100) NOT NULL,
        [ProviderOrderId] nvarchar(200) NULL,
        [ReasonCode] nvarchar(100) NOT NULL,
        [Status] nvarchar(40) NOT NULL,
        [Attempts] int NOT NULL,
        [ProcessingLeaseId] uniqueidentifier NULL,
        [ProcessingLeaseUntil] datetimeoffset(7) NULL,
        [NextAttemptAt] datetimeoffset(7) NULL,
        [CreatedAt] datetimeoffset(7) NOT NULL,
        [ProviderAcceptedAt] datetimeoffset(7) NULL,
        [CompletedAt] datetimeoffset(7) NULL,
        [ProviderReference] nvarchar(200) NULL,
        [FailureCode] nvarchar(100) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT [PK_ScreeningCancellationIntents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningCancellationIntents_Attempts] CHECK ([Attempts] >= 0),
        CONSTRAINT [FK_ScreeningCancellationIntents_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningCancellationIntents_RentalApplications_RentalApplicationId] FOREIGN KEY ([RentalApplicationId]) REFERENCES [tenant].[RentalApplications] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningCancellationIntents_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningCancellationIntents_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningConsentEvidence] (
        [Id] bigint NOT NULL IDENTITY,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [DisclosureVersion] nvarchar(100) NOT NULL,
        [AuthorizationVersion] nvarchar(100) NOT NULL,
        [ConsentedAt] datetimeoffset(7) NOT NULL,
        [ActorType] nvarchar(32) NOT NULL,
        [IpAddressHash] char(64) NOT NULL,
        [UserAgentHash] char(64) NOT NULL,
        [QuoteReferenceHash] char(64) NOT NULL,
        [ProviderAuthorizationReference] nvarchar(200) NULL,
        CONSTRAINT [PK_ScreeningConsentEvidence] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_ScreeningConsentEvidence_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningConsentEvidence_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningIncidents] (
        [Id] bigint NOT NULL IDENTITY,
        [TenantScreeningOrderId] bigint NULL,
        [OrganizationId] bigint NULL,
        [ProviderKey] nvarchar(100) NULL,
        [ProviderEventId] nvarchar(200) NULL,
        [IncidentType] nvarchar(32) NOT NULL,
        [Severity] nvarchar(32) NOT NULL,
        [Status] nvarchar(32) NOT NULL,
        [DetectedAt] datetimeoffset(7) NOT NULL,
        [ContainedAt] datetimeoffset(7) NULL,
        [ResolvedAt] datetimeoffset(7) NULL,
        [ActorUserId] bigint NULL,
        [AffectedResourceSha256Hash] char(64) NOT NULL,
        [DetectionSource] nvarchar(100) NOT NULL,
        [FailureEvidenceReference] nvarchar(200) NULL,
        [RemediationEvidenceReference] nvarchar(200) NULL,
        [NotificationEvidenceReference] nvarchar(200) NULL,
        CONSTRAINT [PK_ScreeningIncidents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningIncidents_Resolution] CHECK ([ResolvedAt] IS NULL OR [ContainedAt] IS NOT NULL),
        CONSTRAINT [FK_ScreeningIncidents_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningIncidents_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningIncidents_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningPaymentEvidence] (
        [Id] bigint NOT NULL IDENTITY,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [Payer] nvarchar(32) NOT NULL,
        [LandlordAmountMinor] bigint NOT NULL,
        [ApplicantAmountMinor] bigint NOT NULL,
        [ProviderAmountMinor] bigint NOT NULL,
        [PlatformFeeMinor] bigint NOT NULL,
        [TaxAmountMinor] bigint NOT NULL,
        [TotalAmountMinor] bigint NOT NULL,
        [Currency] char(3) NOT NULL,
        [QuoteReferenceHash] char(64) NOT NULL,
        [PaymentOperationReferenceHash] char(64) NOT NULL,
        [Status] nvarchar(32) NOT NULL,
        [Source] nvarchar(40) NOT NULL,
        [ActorUserId] bigint NULL,
        [Revision] bigint NOT NULL,
        [ProviderOccurredAt] datetimeoffset(7) NOT NULL,
        [RecordedAt] datetimeoffset(7) NOT NULL,
        [FailureCode] nvarchar(100) NULL,
        CONSTRAINT [PK_ScreeningPaymentEvidence] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningPaymentEvidence_Amounts] CHECK ([LandlordAmountMinor] >= 0 AND [ApplicantAmountMinor] >= 0 AND [ProviderAmountMinor] >= 0 AND [PlatformFeeMinor] >= 0 AND [TaxAmountMinor] >= 0 AND [TotalAmountMinor] = [LandlordAmountMinor] + [ApplicantAmountMinor] AND [TotalAmountMinor] = [ProviderAmountMinor] + [PlatformFeeMinor] + [TaxAmountMinor]),
        CONSTRAINT [CK_ScreeningPaymentEvidence_Revision] CHECK ([Revision] > 0),
        CONSTRAINT [FK_ScreeningPaymentEvidence_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningPaymentEvidence_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningPaymentEvidence_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningReportRevisions] (
        [Id] bigint NOT NULL IDENTITY,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [Revision] bigint NOT NULL,
        [ProviderKey] nvarchar(100) NOT NULL,
        [ProviderReportReference] nvarchar(200) NOT NULL,
        [ReceivedAt] datetimeoffset(7) NOT NULL,
        [ProviderOccurredAt] datetimeoffset(7) NOT NULL,
        [CorrectedAt] datetimeoffset(7) NULL,
        [Status] nvarchar(32) NOT NULL,
        [ReportVersion] nvarchar(100) NOT NULL,
        [NormalizedFactsJson] nvarchar(4000) NOT NULL,
        [NormalizedFactsSha256Hash] char(64) NOT NULL,
        [SupersedesScreeningReportRevisionId] bigint NULL,
        [RetentionExpiresAt] datetimeoffset(7) NOT NULL,
        [RetentionSignal] nvarchar(32) NOT NULL,
        [DeleteRequestedAt] datetimeoffset(7) NULL,
        [DeletedAt] datetimeoffset(7) NULL,
        [IsUnderLegalHold] bit NOT NULL,
        [LegalHoldPlacedAt] datetimeoffset(7) NULL,
        [LegalHoldReleasedAt] datetimeoffset(7) NULL,
        [LegalHoldReasonCode] nvarchar(100) NULL,
        [DeletionClaimToken] uniqueidentifier NULL,
        [DeletionClaimedAt] datetimeoffset(7) NULL,
        [DeletionClaimExpiresAt] datetimeoffset(7) NULL,
        [DeletionProviderCallStartedAt] datetimeoffset(7) NULL,
        [PendingDisputeOperationId] uniqueidentifier NULL,
        CONSTRAINT [PK_ScreeningReportRevisions] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningReportRevisions_Deletion] CHECK ([DeletedAt] IS NULL OR [DeleteRequestedAt] IS NOT NULL),
        CONSTRAINT [CK_ScreeningReportRevisions_NormalizedFactsJson] CHECK (ISJSON([NormalizedFactsJson]) = 1),
        CONSTRAINT [CK_ScreeningReportRevisions_Revision] CHECK ([Revision] > 0),
        CONSTRAINT [FK_ScreeningReportRevisions_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReportRevisions_ScreeningReportRevisions_SupersedesScreeningReportRevisionId] FOREIGN KEY ([SupersedesScreeningReportRevisionId]) REFERENCES [screening].[ScreeningReportRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReportRevisions_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningDisputeIntents] (
        [Id] bigint NOT NULL IDENTITY,
        [OperationId] uniqueidentifier NOT NULL,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [RentalApplicationId] bigint NOT NULL,
        [ScreeningReportRevisionId] bigint NOT NULL,
        [ProviderKey] nvarchar(100) NOT NULL,
        [ProviderOrderId] nvarchar(200) NOT NULL,
        [ProviderReportReference] nvarchar(200) NOT NULL,
        [ActorType] nvarchar(32) NOT NULL,
        [ActorUserId] bigint NULL,
        [IssueCodesJson] nvarchar(2000) NOT NULL,
        [NotesSha256Hash] char(64) NOT NULL,
        [RetentionExpiresAt] datetimeoffset(7) NOT NULL,
        [Status] nvarchar(32) NOT NULL,
        [Attempts] int NOT NULL,
        [ProcessingLeaseId] uniqueidentifier NULL,
        [ProcessingLeaseUntil] datetimeoffset(7) NULL,
        [NextAttemptAt] datetimeoffset(7) NULL,
        [CreatedAt] datetimeoffset(7) NOT NULL,
        [ProviderAcceptedAt] datetimeoffset(7) NULL,
        [CompletedAt] datetimeoffset(7) NULL,
        [ProviderReference] nvarchar(200) NULL,
        [FailureCode] nvarchar(100) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT [PK_ScreeningDisputeIntents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningDisputeIntents_Attempts] CHECK ([Attempts] >= 0),
        CONSTRAINT [CK_ScreeningDisputeIntents_IssueCodesJson] CHECK (ISJSON([IssueCodesJson]) = 1),
        CONSTRAINT [FK_ScreeningDisputeIntents_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputeIntents_RentalApplications_RentalApplicationId] FOREIGN KEY ([RentalApplicationId]) REFERENCES [tenant].[RentalApplications] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputeIntents_ScreeningReportRevisions_ScreeningReportRevisionId] FOREIGN KEY ([ScreeningReportRevisionId]) REFERENCES [screening].[ScreeningReportRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputeIntents_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputeIntents_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningTransitionEvents] (
        [Id] bigint NOT NULL IDENTITY,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [FromStatus] nvarchar(32) NULL,
        [ToStatus] nvarchar(32) NOT NULL,
        [Revision] bigint NOT NULL,
        [OccurredAt] datetimeoffset(7) NOT NULL,
        [RecordedAt] datetimeoffset(7) NOT NULL,
        [Source] nvarchar(32) NOT NULL,
        [ReasonCode] nvarchar(200) NULL,
        [ProviderEventId] nvarchar(200) NULL,
        [ProviderKey] nvarchar(100) NOT NULL,
        [ActorUserId] bigint NULL,
        CONSTRAINT [PK_ScreeningTransitionEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningTransitionEvents_Revision] CHECK ([Revision] > 0),
        CONSTRAINT [FK_ScreeningTransitionEvents_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningTransitionEvents_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningTransitionEvents_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningWebhookInboxEvents] (
        [Id] bigint NOT NULL IDENTITY,
        [ProviderKey] nvarchar(100) NOT NULL,
        [ProviderEventId] nvarchar(200) NOT NULL,
        [PayloadSha256Hash] char(64) NOT NULL,
        [ReceivedAt] datetimeoffset(7) NOT NULL,
        [OccurredAt] datetimeoffset(7) NOT NULL,
        [SignedAt] datetimeoffset(7) NOT NULL,
        [AuthenticationScheme] nvarchar(50) NOT NULL,
        [AuthenticationKeyVersion] nvarchar(100) NOT NULL,
        [ProviderSequence] bigint NULL,
        [ProviderOrderId] nvarchar(200) NOT NULL,
        [CanonicalStatus] nvarchar(32) NOT NULL,
        [NormalizedReasonCode] nvarchar(200) NULL,
        [PaymentQuoteReferenceHash] char(64) NULL,
        [PaymentOperationReferenceHash] char(64) NULL,
        [PaymentPayer] nvarchar(32) NULL,
        [PaymentLandlordAmountMinor] bigint NULL,
        [PaymentApplicantAmountMinor] bigint NULL,
        [PaymentProviderAmountMinor] bigint NULL,
        [PaymentPlatformFeeMinor] bigint NULL,
        [PaymentTaxAmountMinor] bigint NULL,
        [PaymentTotalAmountMinor] bigint NULL,
        [PaymentCurrency] char(3) NULL,
        [PaymentStatus] nvarchar(32) NULL,
        [PaymentOccurredAt] datetimeoffset(7) NULL,
        [PaymentFailureCode] nvarchar(100) NULL,
        [ProcessedAt] datetimeoffset(7) NULL,
        [ProcessingLeaseId] uniqueidentifier NULL,
        [ProcessingLeaseUntil] datetimeoffset(7) NULL,
        [ProcessingStatus] nvarchar(32) NOT NULL,
        [ProcessingAttempts] int NOT NULL,
        [NextAttemptAt] datetimeoffset(7) NULL,
        [FailureCode] nvarchar(100) NULL,
        [FailureDetail] nvarchar(500) NULL,
        [DuplicateCount] int NOT NULL,
        [LastDuplicateReceivedAt] datetimeoffset(7) NULL,
        [SecurityIncidentCode] nvarchar(100) NULL,
        [SecurityIncidentCount] int NOT NULL,
        [LastSecurityIncidentAt] datetimeoffset(7) NULL,
        [TenantScreeningOrderId] bigint NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT [PK_ScreeningWebhookInboxEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningWebhookInboxEvents_Attempts] CHECK ([ProcessingAttempts] >= 0),
        CONSTRAINT [CK_ScreeningWebhookInboxEvents_Duplicates] CHECK ([DuplicateCount] >= 0),
        CONSTRAINT [FK_ScreeningWebhookInboxEvents_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningIncidentEvents] (
        [Id] bigint NOT NULL IDENTITY,
        [ScreeningIncidentId] bigint NOT NULL,
        [Revision] bigint NOT NULL,
        [Status] nvarchar(32) NOT NULL,
        [OccurredAt] datetimeoffset(7) NOT NULL,
        [ActorUserId] bigint NULL,
        [EvidenceReference] nvarchar(200) NULL,
        CONSTRAINT [PK_ScreeningIncidentEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningIncidentEvents_Revision] CHECK ([Revision] > 0),
        CONSTRAINT [FK_ScreeningIncidentEvents_ScreeningIncidents_ScreeningIncidentId] FOREIGN KEY ([ScreeningIncidentId]) REFERENCES [screening].[ScreeningIncidents] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningIncidentEvents_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningDisputes] (
        [Id] bigint NOT NULL IDENTITY,
        [LocalDisputeId] uniqueidentifier NOT NULL,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [ProviderKey] nvarchar(100) NOT NULL,
        [ProviderDisputeReference] nvarchar(200) NOT NULL,
        [Status] nvarchar(32) NOT NULL,
        [OpenedAt] datetimeoffset(7) NOT NULL,
        [ResolvedAt] datetimeoffset(7) NULL,
        [OriginalScreeningReportRevisionId] bigint NOT NULL,
        [CorrectedScreeningReportRevisionId] bigint NULL,
        [OpenedByActorType] nvarchar(32) NULL,
        [OpenedByUserId] bigint NULL,
        [IssueCodesJson] nvarchar(2000) NOT NULL,
        [NotesSha256Hash] char(64) NOT NULL,
        [RetentionExpiresAt] datetimeoffset(7) NOT NULL,
        CONSTRAINT [PK_ScreeningDisputes] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningDisputes_IssueCodesJson] CHECK (ISJSON([IssueCodesJson]) = 1),
        CONSTRAINT [CK_ScreeningDisputes_ResolvedAt] CHECK ([ResolvedAt] IS NULL OR [ResolvedAt] >= [OpenedAt]),
        CONSTRAINT [FK_ScreeningDisputes_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputes_ScreeningReportRevisions_CorrectedScreeningReportRevisionId] FOREIGN KEY ([CorrectedScreeningReportRevisionId]) REFERENCES [screening].[ScreeningReportRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputes_ScreeningReportRevisions_OriginalScreeningReportRevisionId] FOREIGN KEY ([OriginalScreeningReportRevisionId]) REFERENCES [screening].[ScreeningReportRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputes_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputes_Users_OpenedByUserId] FOREIGN KEY ([OpenedByUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningRentalDecisionRevisions] (
        [Id] bigint NOT NULL IDENTITY,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [RentalApplicationId] bigint NOT NULL,
        [Revision] bigint NOT NULL,
        [DecisionActorUserId] bigint NOT NULL,
        [Decision] nvarchar(32) NOT NULL,
        [CriteriaVersion] nvarchar(100) NOT NULL,
        [CriteriaSnapshotSha256Hash] char(64) NOT NULL,
        [ReliedUponScreeningReportRevisionId] bigint NULL,
        [ReasonCodesJson] nvarchar(2000) NOT NULL,
        [CreatedAt] datetimeoffset(7) NOT NULL,
        [SupersedesScreeningRentalDecisionRevisionId] bigint NULL,
        [IsFrozenByDispute] bit NOT NULL,
        [DisputeStatus] nvarchar(32) NOT NULL,
        CONSTRAINT [PK_ScreeningRentalDecisionRevisions] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningRentalDecisionRevisions_ReasonCodesJson] CHECK (ISJSON([ReasonCodesJson]) = 1),
        CONSTRAINT [CK_ScreeningRentalDecisionRevisions_Revision] CHECK ([Revision] > 0),
        CONSTRAINT [FK_ScreeningRentalDecisionRevisions_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningRentalDecisionRevisions_RentalApplications_RentalApplicationId] FOREIGN KEY ([RentalApplicationId]) REFERENCES [tenant].[RentalApplications] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningRentalDecisionRevisions_ScreeningRentalDecisionRevisions_SupersedesScreeningRentalDecisionRevisionId] FOREIGN KEY ([SupersedesScreeningRentalDecisionRevisionId]) REFERENCES [screening].[ScreeningRentalDecisionRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningRentalDecisionRevisions_ScreeningReportRevisions_ReliedUponScreeningReportRevisionId] FOREIGN KEY ([ReliedUponScreeningReportRevisionId]) REFERENCES [screening].[ScreeningReportRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningRentalDecisionRevisions_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningRentalDecisionRevisions_Users_DecisionActorUserId] FOREIGN KEY ([DecisionActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningReportAccessAudits] (
        [Id] bigint NOT NULL IDENTITY,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [ActorUserId] bigint NULL,
        [ScreeningReportRevisionId] bigint NOT NULL,
        [AttemptSequence] bigint NOT NULL,
        [Purpose] nvarchar(32) NOT NULL,
        [Status] nvarchar(32) NOT NULL,
        [RequestedAt] datetimeoffset(7) NOT NULL,
        [CompletedAt] datetimeoffset(7) NULL,
        [ScreeningSupportElevationId] bigint NULL,
        [GrantExpiresAt] datetimeoffset(7) NULL,
        [GrantReference] nvarchar(200) NULL,
        [FailureCode] nvarchar(100) NULL,
        CONSTRAINT [PK_ScreeningReportAccessAudits] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningReportAccessAudits_Grant] CHECK (([Status] = 'Granted' AND [GrantReference] IS NOT NULL AND [GrantExpiresAt] IS NOT NULL) OR ([Status] <> 'Granted' AND [GrantReference] IS NULL AND [GrantExpiresAt] IS NULL)),
        CONSTRAINT [CK_ScreeningReportAccessAudits_Sequence] CHECK ([AttemptSequence] > 0),
        CONSTRAINT [FK_ScreeningReportAccessAudits_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReportAccessAudits_ScreeningReportRevisions_ScreeningReportRevisionId] FOREIGN KEY ([ScreeningReportRevisionId]) REFERENCES [screening].[ScreeningReportRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReportAccessAudits_ScreeningSupportElevations_ScreeningSupportElevationId] FOREIGN KEY ([ScreeningSupportElevationId]) REFERENCES [screening].[ScreeningSupportElevations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReportAccessAudits_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReportAccessAudits_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningReportDeletionEvents] (
        [Id] bigint NOT NULL IDENTITY,
        [ScreeningReportRevisionId] bigint NOT NULL,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [Revision] bigint NOT NULL,
        [EventType] nvarchar(32) NOT NULL,
        [OccurredAt] datetimeoffset(7) NOT NULL,
        [ReasonCode] nvarchar(100) NULL,
        CONSTRAINT [PK_ScreeningReportDeletionEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningReportDeletionEvents_Revision] CHECK ([Revision] > 0),
        CONSTRAINT [FK_ScreeningReportDeletionEvents_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReportDeletionEvents_ScreeningReportRevisions_ScreeningReportRevisionId] FOREIGN KEY ([ScreeningReportRevisionId]) REFERENCES [screening].[ScreeningReportRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReportDeletionEvents_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningDisputeEvents] (
        [Id] bigint NOT NULL IDENTITY,
        [ScreeningDisputeId] bigint NOT NULL,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [Revision] bigint NOT NULL,
        [Status] nvarchar(32) NOT NULL,
        [OccurredAt] datetimeoffset(7) NOT NULL,
        [RecordedAt] datetimeoffset(7) NOT NULL,
        [ProviderEventType] nvarchar(100) NULL,
        [ProviderEventReference] nvarchar(200) NULL,
        [ActorType] nvarchar(32) NULL,
        [ActorUserId] bigint NULL,
        CONSTRAINT [PK_ScreeningDisputeEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningDisputeEvents_Revision] CHECK ([Revision] > 0),
        CONSTRAINT [FK_ScreeningDisputeEvents_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputeEvents_ScreeningDisputes_ScreeningDisputeId] FOREIGN KEY ([ScreeningDisputeId]) REFERENCES [screening].[ScreeningDisputes] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputeEvents_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningDisputeEvents_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningAdverseActions] (
        [Id] bigint NOT NULL IDENTITY,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [RentalApplicationId] bigint NOT NULL,
        [DecisionActorUserId] bigint NOT NULL,
        [OriginalScreeningRentalDecisionRevisionId] bigint NOT NULL,
        [OriginalScreeningReportRevisionId] bigint NULL,
        [ActionType] nvarchar(32) NOT NULL,
        [ReasonCodesJson] nvarchar(2000) NOT NULL,
        [RentalCriteriaVersion] nvarchar(100) NOT NULL,
        [CraContactName] nvarchar(200) NOT NULL,
        [CraContactAddress] nvarchar(500) NOT NULL,
        [CraContactPhone] nvarchar(50) NOT NULL,
        [NoticeVersion] nvarchar(100) NOT NULL,
        [ImmutableNoticeContent] nvarchar(max) NOT NULL,
        [NoticeContentSha256Hash] char(64) NOT NULL,
        [StatutoryDisclosureVersion] nvarchar(100) NOT NULL,
        [StatutoryDisclosureSha256Hash] char(64) NOT NULL,
        [StateLocalDisclosureVersion] nvarchar(100) NOT NULL,
        [StateLocalDisclosureSha256Hash] char(64) NOT NULL,
        [JurisdictionCode] nvarchar(10) NOT NULL,
        [CreatedAt] datetimeoffset(7) NOT NULL,
        [ReconsiderationLinkReference] nvarchar(200) NULL,
        CONSTRAINT [PK_ScreeningAdverseActions] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningAdverseActions_ReasonCodesJson] CHECK (ISJSON([ReasonCodesJson]) = 1),
        CONSTRAINT [FK_ScreeningAdverseActions_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningAdverseActions_RentalApplications_RentalApplicationId] FOREIGN KEY ([RentalApplicationId]) REFERENCES [tenant].[RentalApplications] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningAdverseActions_ScreeningRentalDecisionRevisions_OriginalScreeningRentalDecisionRevisionId] FOREIGN KEY ([OriginalScreeningRentalDecisionRevisionId]) REFERENCES [screening].[ScreeningRentalDecisionRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningAdverseActions_ScreeningReportRevisions_OriginalScreeningReportRevisionId] FOREIGN KEY ([OriginalScreeningReportRevisionId]) REFERENCES [screening].[ScreeningReportRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningAdverseActions_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningAdverseActions_Users_DecisionActorUserId] FOREIGN KEY ([DecisionActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningAdverseActionDeliveryAttempts] (
        [Id] bigint NOT NULL IDENTITY,
        [ScreeningAdverseActionId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [AttemptNumber] int NOT NULL,
        [Channel] nvarchar(32) NOT NULL,
        [AttemptedAt] datetimeoffset(7) NOT NULL,
        [DeliveredAt] datetimeoffset(7) NULL,
        [Status] nvarchar(32) NOT NULL,
        [ProviderDeliveryReference] nvarchar(200) NULL,
        [FailureCode] nvarchar(100) NULL,
        [NoticeContentSha256Hash] char(64) NOT NULL,
        [ProviderIdempotencyKey] char(64) NOT NULL,
        [ProcessingLeaseId] uniqueidentifier NULL,
        [ProcessingLeaseUntil] datetimeoffset(7) NULL,
        [NextAttemptAt] datetimeoffset(7) NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT [PK_ScreeningAdverseActionDeliveryAttempts] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningAdverseActionDeliveryAttempts_Attempt] CHECK ([AttemptNumber] > 0),
        CONSTRAINT [FK_ScreeningAdverseActionDeliveryAttempts_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningAdverseActionDeliveryAttempts_ScreeningAdverseActions_ScreeningAdverseActionId] FOREIGN KEY ([ScreeningAdverseActionId]) REFERENCES [screening].[ScreeningAdverseActions] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE TABLE [screening].[ScreeningReconsiderationEvents] (
        [Id] bigint NOT NULL IDENTITY,
        [ScreeningAdverseActionId] bigint NOT NULL,
        [TenantScreeningOrderId] bigint NOT NULL,
        [OrganizationId] bigint NOT NULL,
        [Revision] bigint NOT NULL,
        [FromStatus] nvarchar(32) NOT NULL,
        [ToStatus] nvarchar(32) NOT NULL,
        [OccurredAt] datetimeoffset(7) NOT NULL,
        [RecordedAt] datetimeoffset(7) NOT NULL,
        [ActorUserId] bigint NOT NULL,
        [ReasonSha256Hash] char(64) NOT NULL,
        [NewScreeningRentalDecisionRevisionId] bigint NULL,
        CONSTRAINT [PK_ScreeningReconsiderationEvents] PRIMARY KEY ([Id]),
        CONSTRAINT [CK_ScreeningReconsiderationEvents_Revision] CHECK ([Revision] > 0),
        CONSTRAINT [FK_ScreeningReconsiderationEvents_Organizations_OrganizationId] FOREIGN KEY ([OrganizationId]) REFERENCES [organization].[Organizations] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReconsiderationEvents_ScreeningAdverseActions_ScreeningAdverseActionId] FOREIGN KEY ([ScreeningAdverseActionId]) REFERENCES [screening].[ScreeningAdverseActions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReconsiderationEvents_ScreeningRentalDecisionRevisions_NewScreeningRentalDecisionRevisionId] FOREIGN KEY ([NewScreeningRentalDecisionRevisionId]) REFERENCES [screening].[ScreeningRentalDecisionRevisions] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReconsiderationEvents_TenantScreeningOrders_TenantScreeningOrderId] FOREIGN KEY ([TenantScreeningOrderId]) REFERENCES [screening].[TenantScreeningOrders] ([Id]) ON DELETE NO ACTION,
        CONSTRAINT [FK_ScreeningReconsiderationEvents_Users_ActorUserId] FOREIGN KEY ([ActorUserId]) REFERENCES [core].[Users] ([Id]) ON DELETE NO ACTION
    );
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActionDeliveryAttempts_OrganizationId] ON [screening].[ScreeningAdverseActionDeliveryAttempts] ([OrganizationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActionDeliveryAttempts_Status_NextAttemptAt_ProcessingLeaseUntil_AttemptedAt] ON [screening].[ScreeningAdverseActionDeliveryAttempts] ([Status], [NextAttemptAt], [ProcessingLeaseUntil], [AttemptedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActionDeliveryAttempts_ProviderIdempotencyKey] ON [screening].[ScreeningAdverseActionDeliveryAttempts] ([ProviderIdempotencyKey]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningAdverseActionDeliveryAttempts_ScreeningAdverseActionId_AttemptNumber] ON [screening].[ScreeningAdverseActionDeliveryAttempts] ([ScreeningAdverseActionId], [AttemptNumber]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActionDeliveryAttempts_ScreeningAdverseActionId_Channel] ON [screening].[ScreeningAdverseActionDeliveryAttempts] ([ScreeningAdverseActionId], [Channel]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActions_DecisionActorUserId] ON [screening].[ScreeningAdverseActions] ([DecisionActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActions_OrganizationId_CreatedAt] ON [screening].[ScreeningAdverseActions] ([OrganizationId], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningAdverseActions_OrganizationId_OriginalScreeningRentalDecisionRevisionId_ActionType] ON [screening].[ScreeningAdverseActions] ([OrganizationId], [OriginalScreeningRentalDecisionRevisionId], [ActionType]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActions_OrganizationId_RentalApplicationId_CreatedAt] ON [screening].[ScreeningAdverseActions] ([OrganizationId], [RentalApplicationId], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActions_OriginalScreeningRentalDecisionRevisionId] ON [screening].[ScreeningAdverseActions] ([OriginalScreeningRentalDecisionRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActions_OriginalScreeningReportRevisionId] ON [screening].[ScreeningAdverseActions] ([OriginalScreeningReportRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActions_RentalApplicationId] ON [screening].[ScreeningAdverseActions] ([RentalApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningAdverseActions_TenantScreeningOrderId] ON [screening].[ScreeningAdverseActions] ([TenantScreeningOrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningCancellationIntents_ActorUserId] ON [screening].[ScreeningCancellationIntents] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningCancellationIntents_OperationId] ON [screening].[ScreeningCancellationIntents] ([OperationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningCancellationIntents_OrganizationId] ON [screening].[ScreeningCancellationIntents] ([OrganizationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningCancellationIntents_RentalApplicationId] ON [screening].[ScreeningCancellationIntents] ([RentalApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningCancellationIntents_Status_NextAttemptAt_ProcessingLeaseUntil_CreatedAt] ON [screening].[ScreeningCancellationIntents] ([Status], [NextAttemptAt], [ProcessingLeaseUntil], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningCancellationIntents_TenantScreeningOrderId] ON [screening].[ScreeningCancellationIntents] ([TenantScreeningOrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningConsentEvidence_OrganizationId_ConsentedAt] ON [screening].[ScreeningConsentEvidence] ([OrganizationId], [ConsentedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningConsentEvidence_TenantScreeningOrderId] ON [screening].[ScreeningConsentEvidence] ([TenantScreeningOrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputeEvents_ActorUserId] ON [screening].[ScreeningDisputeEvents] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputeEvents_OrganizationId_RecordedAt] ON [screening].[ScreeningDisputeEvents] ([OrganizationId], [RecordedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_ScreeningDisputeEvents_ScreeningDisputeId_ProviderEventReference] ON [screening].[ScreeningDisputeEvents] ([ScreeningDisputeId], [ProviderEventReference]) WHERE [ProviderEventReference] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningDisputeEvents_ScreeningDisputeId_Revision] ON [screening].[ScreeningDisputeEvents] ([ScreeningDisputeId], [Revision]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputeEvents_TenantScreeningOrderId_OccurredAt] ON [screening].[ScreeningDisputeEvents] ([TenantScreeningOrderId], [OccurredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputeIntents_ActorUserId] ON [screening].[ScreeningDisputeIntents] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningDisputeIntents_OperationId] ON [screening].[ScreeningDisputeIntents] ([OperationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputeIntents_OrganizationId] ON [screening].[ScreeningDisputeIntents] ([OrganizationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputeIntents_RentalApplicationId] ON [screening].[ScreeningDisputeIntents] ([RentalApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputeIntents_ScreeningReportRevisionId] ON [screening].[ScreeningDisputeIntents] ([ScreeningReportRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputeIntents_Status_NextAttemptAt_ProcessingLeaseUntil_CreatedAt] ON [screening].[ScreeningDisputeIntents] ([Status], [NextAttemptAt], [ProcessingLeaseUntil], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningDisputeIntents_TenantScreeningOrderId_ScreeningReportRevisionId] ON [screening].[ScreeningDisputeIntents] ([TenantScreeningOrderId], [ScreeningReportRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputes_CorrectedScreeningReportRevisionId] ON [screening].[ScreeningDisputes] ([CorrectedScreeningReportRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningDisputes_LocalDisputeId] ON [screening].[ScreeningDisputes] ([LocalDisputeId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputes_OpenedByUserId] ON [screening].[ScreeningDisputes] ([OpenedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputes_OrganizationId_RetentionExpiresAt] ON [screening].[ScreeningDisputes] ([OrganizationId], [RetentionExpiresAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputes_OrganizationId_Status_ResolvedAt] ON [screening].[ScreeningDisputes] ([OrganizationId], [Status], [ResolvedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputes_OriginalScreeningReportRevisionId] ON [screening].[ScreeningDisputes] ([OriginalScreeningReportRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningDisputes_ProviderKey_ProviderDisputeReference] ON [screening].[ScreeningDisputes] ([ProviderKey], [ProviderDisputeReference]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningDisputes_TenantScreeningOrderId_OpenedAt] ON [screening].[ScreeningDisputes] ([TenantScreeningOrderId], [OpenedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningIncidentEvents_ActorUserId] ON [screening].[ScreeningIncidentEvents] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningIncidentEvents_ScreeningIncidentId_Revision] ON [screening].[ScreeningIncidentEvents] ([ScreeningIncidentId], [Revision]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningIncidentEvents_Status_OccurredAt] ON [screening].[ScreeningIncidentEvents] ([Status], [OccurredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningIncidents_ActorUserId] ON [screening].[ScreeningIncidents] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningIncidents_OrganizationId_Status_DetectedAt] ON [screening].[ScreeningIncidents] ([OrganizationId], [Status], [DetectedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE INDEX [IX_ScreeningIncidents_ProviderKey_ProviderEventId_IncidentType] ON [screening].[ScreeningIncidents] ([ProviderKey], [ProviderEventId], [IncidentType]) WHERE [ProviderEventId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningIncidents_TenantScreeningOrderId_DetectedAt] ON [screening].[ScreeningIncidents] ([TenantScreeningOrderId], [DetectedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningPaymentEvidence_ActorUserId] ON [screening].[ScreeningPaymentEvidence] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningPaymentEvidence_OrganizationId_RecordedAt] ON [screening].[ScreeningPaymentEvidence] ([OrganizationId], [RecordedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningPaymentEvidence_TenantScreeningOrderId_PaymentOperationReferenceHash_Status] ON [screening].[ScreeningPaymentEvidence] ([TenantScreeningOrderId], [PaymentOperationReferenceHash], [Status]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningPaymentEvidence_TenantScreeningOrderId_Revision] ON [screening].[ScreeningPaymentEvidence] ([TenantScreeningOrderId], [Revision]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReconsiderationEvents_ActorUserId] ON [screening].[ScreeningReconsiderationEvents] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReconsiderationEvents_NewScreeningRentalDecisionRevisionId] ON [screening].[ScreeningReconsiderationEvents] ([NewScreeningRentalDecisionRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReconsiderationEvents_OrganizationId_RecordedAt] ON [screening].[ScreeningReconsiderationEvents] ([OrganizationId], [RecordedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningReconsiderationEvents_ScreeningAdverseActionId_Revision] ON [screening].[ScreeningReconsiderationEvents] ([ScreeningAdverseActionId], [Revision]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReconsiderationEvents_TenantScreeningOrderId_OccurredAt] ON [screening].[ScreeningReconsiderationEvents] ([TenantScreeningOrderId], [OccurredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningRentalDecisionRevisions_DecisionActorUserId] ON [screening].[ScreeningRentalDecisionRevisions] ([DecisionActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningRentalDecisionRevisions_OrganizationId_RentalApplicationId_CreatedAt] ON [screening].[ScreeningRentalDecisionRevisions] ([OrganizationId], [RentalApplicationId], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningRentalDecisionRevisions_ReliedUponScreeningReportRevisionId] ON [screening].[ScreeningRentalDecisionRevisions] ([ReliedUponScreeningReportRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningRentalDecisionRevisions_RentalApplicationId] ON [screening].[ScreeningRentalDecisionRevisions] ([RentalApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningRentalDecisionRevisions_SupersedesScreeningRentalDecisionRevisionId] ON [screening].[ScreeningRentalDecisionRevisions] ([SupersedesScreeningRentalDecisionRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningRentalDecisionRevisions_TenantScreeningOrderId_Revision] ON [screening].[ScreeningRentalDecisionRevisions] ([TenantScreeningOrderId], [Revision]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportAccessAudits_ActorUserId] ON [screening].[ScreeningReportAccessAudits] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportAccessAudits_OrganizationId_RequestedAt] ON [screening].[ScreeningReportAccessAudits] ([OrganizationId], [RequestedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportAccessAudits_ScreeningReportRevisionId] ON [screening].[ScreeningReportAccessAudits] ([ScreeningReportRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportAccessAudits_ScreeningSupportElevationId] ON [screening].[ScreeningReportAccessAudits] ([ScreeningSupportElevationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportAccessAudits_Status_RequestedAt] ON [screening].[ScreeningReportAccessAudits] ([Status], [RequestedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningReportAccessAudits_TenantScreeningOrderId_AttemptSequence] ON [screening].[ScreeningReportAccessAudits] ([TenantScreeningOrderId], [AttemptSequence]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportDeletionEvents_OrganizationId_OccurredAt] ON [screening].[ScreeningReportDeletionEvents] ([OrganizationId], [OccurredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningReportDeletionEvents_ScreeningReportRevisionId_Revision] ON [screening].[ScreeningReportDeletionEvents] ([ScreeningReportRevisionId], [Revision]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportDeletionEvents_TenantScreeningOrderId] ON [screening].[ScreeningReportDeletionEvents] ([TenantScreeningOrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportRevisions_OrganizationId_IsUnderLegalHold_DeleteRequestedAt] ON [screening].[ScreeningReportRevisions] ([OrganizationId], [IsUnderLegalHold], [DeleteRequestedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportRevisions_OrganizationId_RetentionExpiresAt_DeletedAt] ON [screening].[ScreeningReportRevisions] ([OrganizationId], [RetentionExpiresAt], [DeletedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningReportRevisions_ProviderKey_ProviderReportReference] ON [screening].[ScreeningReportRevisions] ([ProviderKey], [ProviderReportReference]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningReportRevisions_SupersedesScreeningReportRevisionId] ON [screening].[ScreeningReportRevisions] ([SupersedesScreeningReportRevisionId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningReportRevisions_TenantScreeningOrderId_Revision] ON [screening].[ScreeningReportRevisions] ([TenantScreeningOrderId], [Revision]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningSupportElevations_ApprovedByUserId] ON [screening].[ScreeningSupportElevations] ([ApprovedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningSupportElevations_OrganizationId_SubjectUserId_Purpose_ExpiresAt_RevokedAt] ON [screening].[ScreeningSupportElevations] ([OrganizationId], [SubjectUserId], [Purpose], [ExpiresAt], [RevokedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningSupportElevations_RevokedByUserId] ON [screening].[ScreeningSupportElevations] ([RevokedByUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningSupportElevations_SubjectUserId] ON [screening].[ScreeningSupportElevations] ([SubjectUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningTransitionEvents_ActorUserId] ON [screening].[ScreeningTransitionEvents] ([ActorUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningTransitionEvents_OrganizationId_RecordedAt] ON [screening].[ScreeningTransitionEvents] ([OrganizationId], [RecordedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_ScreeningTransitionEvents_ProviderKey_ProviderEventId] ON [screening].[ScreeningTransitionEvents] ([ProviderKey], [ProviderEventId]) WHERE [ProviderEventId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningTransitionEvents_TenantScreeningOrderId_Revision] ON [screening].[ScreeningTransitionEvents] ([TenantScreeningOrderId], [Revision]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningWebhookInboxEvents_ProcessedAt] ON [screening].[ScreeningWebhookInboxEvents] ([ProcessedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningWebhookInboxEvents_ProcessingStatus_NextAttemptAt_ProcessingLeaseUntil] ON [screening].[ScreeningWebhookInboxEvents] ([ProcessingStatus], [NextAttemptAt], [ProcessingLeaseUntil]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_ScreeningWebhookInboxEvents_ProviderKey_ProviderEventId] ON [screening].[ScreeningWebhookInboxEvents] ([ProviderKey], [ProviderEventId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_ScreeningWebhookInboxEvents_TenantScreeningOrderId] ON [screening].[ScreeningWebhookInboxEvents] ([TenantScreeningOrderId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_TenantScreeningOrders_OrganizationId_CompletedAt] ON [screening].[TenantScreeningOrders] ([OrganizationId], [CompletedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_TenantScreeningOrders_OrganizationId_ExpiredAt] ON [screening].[TenantScreeningOrders] ([OrganizationId], [ExpiredAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE UNIQUE INDEX [IX_TenantScreeningOrders_OrganizationId_InvitationIdempotencyKeyHash] ON [screening].[TenantScreeningOrders] ([OrganizationId], [InvitationIdempotencyKeyHash]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_TenantScreeningOrders_OrganizationId_RentalApplicationId] ON [screening].[TenantScreeningOrders] ([OrganizationId], [RentalApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_TenantScreeningOrders_OrganizationId_Status_CreatedAt] ON [screening].[TenantScreeningOrders] ([OrganizationId], [Status], [CreatedAt]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_TenantScreeningOrders_PropertyId] ON [screening].[TenantScreeningOrders] ([PropertyId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE UNIQUE INDEX [IX_TenantScreeningOrders_ProviderKey_ProviderOrderId] ON [screening].[TenantScreeningOrders] ([ProviderKey], [ProviderOrderId]) WHERE [ProviderOrderId] IS NOT NULL');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_TenantScreeningOrders_RentalApplicationId] ON [screening].[TenantScreeningOrders] ([RentalApplicationId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    CREATE INDEX [IX_TenantScreeningOrders_RequesterUserId] ON [screening].[TenantScreeningOrders] ([RequesterUserId]);
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_AppendOnly_ScreeningPaymentEvidence]
    ON [screening].[ScreeningPaymentEvidence] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted)
            THROW 51000, ''Screening evidence is append-only.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_AppendOnly_ScreeningTransitionEvents]
    ON [screening].[ScreeningTransitionEvents] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted)
            THROW 51000, ''Screening evidence is append-only.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_AppendOnly_ScreeningConsentEvidence]
    ON [screening].[ScreeningConsentEvidence] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted)
            THROW 51000, ''Screening evidence is append-only.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_AppendOnly_ScreeningReportDeletionEvents]
    ON [screening].[ScreeningReportDeletionEvents] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted)
            THROW 51000, ''Screening evidence is append-only.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_AppendOnly_ScreeningDisputeEvents]
    ON [screening].[ScreeningDisputeEvents] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted)
            THROW 51000, ''Screening evidence is append-only.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_AppendOnly_ScreeningReconsiderationEvents]
    ON [screening].[ScreeningReconsiderationEvents] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted)
            THROW 51000, ''Screening evidence is append-only.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_AppendOnly_ScreeningIncidentEvents]
    ON [screening].[ScreeningIncidentEvents] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted)
            THROW 51000, ''Screening evidence is append-only.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_AppendOnly_ScreeningAdverseActions]
    ON [screening].[ScreeningAdverseActions] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted)
            THROW 51000, ''Screening evidence is append-only.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningRentalDecisionRevisions]
    ON [screening].[ScreeningRentalDecisionRevisions] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([TenantScreeningOrderId]) OR UPDATE([OrganizationId]) OR UPDATE([RentalApplicationId]) OR UPDATE([Revision]) OR UPDATE([DecisionActorUserId]) OR UPDATE([Decision]) OR UPDATE([CriteriaVersion]) OR UPDATE([CriteriaSnapshotSha256Hash]) OR UPDATE([ReliedUponScreeningReportRevisionId]) OR UPDATE([ReasonCodesJson]) OR UPDATE([CreatedAt]) OR UPDATE([SupersedesScreeningRentalDecisionRevisionId])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningReportRevisions]
    ON [screening].[ScreeningReportRevisions] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([TenantScreeningOrderId]) OR UPDATE([OrganizationId]) OR UPDATE([Revision]) OR UPDATE([ProviderKey]) OR UPDATE([ProviderReportReference]) OR UPDATE([ReceivedAt]) OR UPDATE([ProviderOccurredAt]) OR UPDATE([CorrectedAt]) OR UPDATE([Status]) OR UPDATE([ReportVersion]) OR UPDATE([NormalizedFactsSha256Hash]) OR UPDATE([SupersedesScreeningReportRevisionId]) OR UPDATE([RetentionExpiresAt]) OR UPDATE([RetentionSignal])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningWebhookInboxEvents]
    ON [screening].[ScreeningWebhookInboxEvents] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([ProviderKey]) OR UPDATE([ProviderEventId]) OR UPDATE([PayloadSha256Hash]) OR UPDATE([ReceivedAt]) OR UPDATE([OccurredAt]) OR UPDATE([SignedAt]) OR UPDATE([AuthenticationScheme]) OR UPDATE([AuthenticationKeyVersion]) OR UPDATE([ProviderSequence]) OR UPDATE([ProviderOrderId]) OR UPDATE([CanonicalStatus]) OR UPDATE([NormalizedReasonCode]) OR UPDATE([PaymentQuoteReferenceHash]) OR UPDATE([PaymentOperationReferenceHash]) OR UPDATE([PaymentPayer]) OR UPDATE([PaymentLandlordAmountMinor]) OR UPDATE([PaymentApplicantAmountMinor]) OR UPDATE([PaymentProviderAmountMinor]) OR UPDATE([PaymentPlatformFeeMinor]) OR UPDATE([PaymentTaxAmountMinor]) OR UPDATE([PaymentTotalAmountMinor]) OR UPDATE([PaymentCurrency]) OR UPDATE([PaymentStatus]) OR UPDATE([PaymentOccurredAt]) OR UPDATE([PaymentFailureCode])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningCancellationIntents]
    ON [screening].[ScreeningCancellationIntents] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([OperationId]) OR UPDATE([TenantScreeningOrderId]) OR UPDATE([OrganizationId]) OR UPDATE([RentalApplicationId]) OR UPDATE([ActorUserId]) OR UPDATE([ExpectedOrderRevision]) OR UPDATE([ProviderKey]) OR UPDATE([ProviderOrderId]) OR UPDATE([ReasonCode]) OR UPDATE([CreatedAt])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningDisputeIntents]
    ON [screening].[ScreeningDisputeIntents] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([OperationId]) OR UPDATE([TenantScreeningOrderId]) OR UPDATE([OrganizationId]) OR UPDATE([RentalApplicationId]) OR UPDATE([ScreeningReportRevisionId]) OR UPDATE([ProviderKey]) OR UPDATE([ProviderOrderId]) OR UPDATE([ProviderReportReference]) OR UPDATE([ActorType]) OR UPDATE([ActorUserId]) OR UPDATE([IssueCodesJson]) OR UPDATE([NotesSha256Hash]) OR UPDATE([RetentionExpiresAt]) OR UPDATE([CreatedAt])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningReportAccessAudits]
    ON [screening].[ScreeningReportAccessAudits] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([TenantScreeningOrderId]) OR UPDATE([OrganizationId]) OR UPDATE([ActorUserId]) OR UPDATE([ScreeningReportRevisionId]) OR UPDATE([AttemptSequence]) OR UPDATE([Purpose]) OR UPDATE([RequestedAt]) OR UPDATE([ScreeningSupportElevationId])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningSupportElevations]
    ON [screening].[ScreeningSupportElevations] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([OrganizationId]) OR UPDATE([SubjectUserId]) OR UPDATE([ApprovedByUserId]) OR UPDATE([CaseReference]) OR UPDATE([Reason]) OR UPDATE([Purpose]) OR UPDATE([IssuedAt]) OR UPDATE([ExpiresAt]) OR UPDATE([MaximumAccessCount])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningDisputes]
    ON [screening].[ScreeningDisputes] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([LocalDisputeId]) OR UPDATE([TenantScreeningOrderId]) OR UPDATE([OrganizationId]) OR UPDATE([ProviderKey]) OR UPDATE([ProviderDisputeReference]) OR UPDATE([OpenedAt]) OR UPDATE([OriginalScreeningReportRevisionId]) OR UPDATE([OpenedByActorType]) OR UPDATE([OpenedByUserId]) OR UPDATE([IssueCodesJson]) OR UPDATE([NotesSha256Hash]) OR UPDATE([RetentionExpiresAt])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningAdverseActionDeliveryAttempts]
    ON [screening].[ScreeningAdverseActionDeliveryAttempts] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([ScreeningAdverseActionId]) OR UPDATE([OrganizationId]) OR UPDATE([AttemptNumber]) OR UPDATE([Channel]) OR UPDATE([NoticeContentSha256Hash]) OR UPDATE([ProviderIdempotencyKey])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    EXEC(N'CREATE OR ALTER TRIGGER [screening].[TR_ImmutableEvidence_ScreeningIncidents]
    ON [screening].[ScreeningIncidents] AFTER UPDATE, DELETE AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (SELECT 1 FROM deleted) AND NOT EXISTS (SELECT 1 FROM inserted)
            THROW 51000, ''Screening evidence cannot be deleted.'', 1;
        IF UPDATE([Id]) OR UPDATE([OrganizationId]) OR UPDATE([TenantScreeningOrderId]) OR UPDATE([ProviderKey]) OR UPDATE([ProviderEventId]) OR UPDATE([IncidentType]) OR UPDATE([Severity]) OR UPDATE([DetectedAt]) OR UPDATE([AffectedResourceSha256Hash]) OR UPDATE([DetectionSource]) OR UPDATE([FailureEvidenceReference])
            THROW 51000, ''Immutable screening evidence cannot be updated.'', 1;
    END');
END;

IF NOT EXISTS (
    SELECT * FROM [__EFMigrationsHistory]
    WHERE [MigrationId] = N'20260807120109_Milestone3TenantScreeningProductionization'
)
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
    VALUES (N'20260807120109_Milestone3TenantScreeningProductionization', N'9.0.3');
END;

COMMIT;
GO
