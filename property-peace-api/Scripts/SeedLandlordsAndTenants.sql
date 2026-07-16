-- =============================================================================
-- SeedLandlordsAndTenants.sql
--
-- Seeds:
--   - 200 landlord user accounts (AuthProvider = 'Google', PasswordHash/Salt = 0x)
--   - 200 organizations (one per landlord, landlord is Owner)
--   - 200 UserSettings records
--   - 200 OrganizationMembers rows (role = 'Owner')
--   - 200 UserRoles rows (role = 'Landlord')
--   - 100 tenant records in tenant.Tenants, connected via OrganizationId
--     (one tenant assigned per landlord for the first 100 landlords)
--
-- Safe to run against dev/staging. All emails use @brownstonehub.test domain.
-- Roles (Landlord, Tenant) are created if they do not already exist.
-- =============================================================================

SET NOCOUNT ON;
BEGIN TRANSACTION;

-- ============================================================
-- 1. Ensure Roles exist
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'Landlord')
    INSERT INTO dbo.Roles (RoleName) VALUES ('Landlord');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'Tenant')
    INSERT INTO dbo.Roles (RoleName) VALUES ('Tenant');

DECLARE @LandlordRoleId BIGINT = (SELECT Id FROM dbo.Roles WHERE RoleName = 'Landlord');
DECLARE @TenantRoleId   BIGINT = (SELECT Id FROM dbo.Roles WHERE RoleName = 'Tenant');

-- ============================================================
-- 2. Name pools
-- ============================================================
CREATE TABLE #FirstNames (Id INT IDENTITY(1,1), Name NVARCHAR(50));
CREATE TABLE #LastNames  (Id INT IDENTITY(1,1), Name NVARCHAR(50));

INSERT INTO #FirstNames (Name) VALUES
('James'),('John'),('Robert'),('Michael'),('William'),('David'),('Richard'),('Joseph'),('Thomas'),('Charles'),
('Christopher'),('Daniel'),('Matthew'),('Anthony'),('Mark'),('Donald'),('Steven'),('Paul'),('Andrew'),('Joshua'),
('Mary'),('Patricia'),('Jennifer'),('Linda'),('Barbara'),('Elizabeth'),('Susan'),('Jessica'),('Sarah'),('Karen'),
('Emma'),('Olivia'),('Ava'),('Isabella'),('Sophia'),('Charlotte'),('Mia'),('Amelia'),('Harper'),('Evelyn'),
('Kevin'),('Brian'),('George'),('Edward'),('Ronald'),('Timothy'),('Jason'),('Jeffrey'),('Ryan'),('Jacob');

INSERT INTO #LastNames (Name) VALUES
('Smith'),('Johnson'),('Williams'),('Brown'),('Jones'),('Garcia'),('Miller'),('Davis'),('Rodriguez'),('Martinez'),
('Hernandez'),('Lopez'),('Gonzalez'),('Wilson'),('Anderson'),('Thomas'),('Taylor'),('Moore'),('Jackson'),('Martin'),
('Lee'),('Perez'),('Thompson'),('White'),('Harris'),('Sanchez'),('Clark'),('Ramirez'),('Lewis'),('Robinson'),
('Walker'),('Young'),('Allen'),('King'),('Wright'),('Scott'),('Torres'),('Nguyen'),('Hill'),('Flores'),
('Green'),('Adams'),('Nelson'),('Baker'),('Hall'),('Rivera'),('Campbell'),('Mitchell'),('Carter'),('Roberts');

DECLARE @FirstNameCount INT = (SELECT COUNT(*) FROM #FirstNames);
DECLARE @LastNameCount  INT = (SELECT COUNT(*) FROM #LastNames);

-- ============================================================
-- 3. Tracking table for org assignment
-- ============================================================
CREATE TABLE #SeedLandlords (
    Idx   INT,
    OrgId BIGINT,
    Email NVARCHAR(200)
);

-- ============================================================
-- 4. Seed 200 landlords
-- ============================================================
DECLARE @i         INT          = 1;
DECLARE @Now       DATETIME2    = GETDATE();
DECLARE @FirstName NVARCHAR(50);
DECLARE @LastName  NVARCHAR(50);
DECLARE @Email     NVARCHAR(200);
DECLARE @Phone     NVARCHAR(20);
DECLARE @FnIdx     INT;
DECLARE @LnIdx     INT;
DECLARE @UserId    BIGINT;
DECLARE @OrgId     BIGINT;

WHILE @i <= 200
BEGIN
    -- Pick names using different primes so first/last names vary independently
    SET @FnIdx = (@i          % @FirstNameCount) + 1;
    SET @LnIdx = ((@i * 7 + 13) % @LastNameCount)  + 1;

    SELECT @FirstName = Name FROM #FirstNames WHERE Id = @FnIdx;
    SELECT @LastName  = Name FROM #LastNames  WHERE Id = @LnIdx;

    -- Email similar to name; index suffix ensures uniqueness across duplicates
    SET @Email = LOWER(@FirstName) + '.' + LOWER(@LastName)
                 + CAST(@i AS VARCHAR(10)) + '@brownstonehub.test';

    -- Random-ish US phone number that stays in valid ranges
    SET @Phone =
        '(' + RIGHT('000' + CAST(200 + (@i % 800)           AS VARCHAR(3)), 3) + ') ' +
               RIGHT('000' + CAST(100 + ((@i * 3)  % 900)   AS VARCHAR(3)), 3) + '-' +
               RIGHT('0000'+ CAST(1000+ ((@i * 97) % 9000)  AS VARCHAR(4)), 4);

    -- ---- core.Users ----
    INSERT INTO core.Users (
        SettingId, FirstName, LastName, Email, PhoneNumber, Company,
        HasSeenTutorial, PasswordHash, PasswordSalt, GoogleId, AuthProvider,
        CreateDate, UpdatedDate, LastVisited, LastLogin, LoginCount,
        StripeAccountEnabled, IsDeleted, IsSuspended,
        CurrentOrganizationId, IsSeeded
    ) VALUES (
        0, @FirstName, @LastName, @Email, @Phone, '',
        0, 0x, 0x, NULL, 'Google',
        @Now, @Now, @Now, @Now, 1,
        0, 0, 0,
        NULL, 1  -- CurrentOrganizationId filled in after org is created; IsSeeded = true
    );
    SET @UserId = SCOPE_IDENTITY();

    -- ---- UserSettings (dbo) ----
    INSERT INTO dbo.UserSettings (
        UserId, FontSize, Language, DarkMode, SidenavMini, NavbarFixed, SidenavType,
        PropertyLayout,
        AiSummaryEnabled, AiSummaryCheckTenantAccounts,
        AiSummaryCheckMoveInChecklist, AiSummaryCheckMoveOutChecklist,
        AiSummaryCheckApplicationsSentSigned, AiSummaryCheckUnpaidSecurityDeposits
    ) VALUES (
        @UserId, 0, 'English', 0, 0, 1, 'dark',
        'cards',
        1, 1, 1, 1, 1, 1
    );

    -- ---- organization.Organizations ----
    INSERT INTO organization.Organizations (
        Name, Description, OwnerId, IsActive, CreatedAt, UpdatedAt, IsDeleted
    ) VALUES (
        @FirstName + ' ' + @LastName + ' Properties',
        'Seed organization for ' + @FirstName + ' ' + @LastName,
        @UserId, 1, @Now, @Now, 0
    );
    SET @OrgId = SCOPE_IDENTITY();

    -- Back-fill CurrentOrganizationId on the user
    UPDATE core.Users SET CurrentOrganizationId = @OrgId WHERE Id = @UserId;

    -- ---- organization.OrganizationMembers ----
    INSERT INTO organization.OrganizationMembers (
        OrganizationId, UserId, Email, Role, IsActive, JoinedAt,
        CanManageProperties, CanManageTenants, CanManageLeases,
        CanManageMaintenance, CanManageBilling, CanManageMembers
    ) VALUES (
        @OrgId, @UserId, @Email, 'Owner', 1, @Now,
        1, 1, 1, 1, 1, 1
    );

    -- ---- core.UserRoles ----
    INSERT INTO core.UserRoles (UserId, RoleId) VALUES (@UserId, @LandlordRoleId);

    -- Track for tenant assignment
    INSERT INTO #SeedLandlords (Idx, OrgId, Email) VALUES (@i, @OrgId, @Email);

    SET @i = @i + 1;
END;

-- ============================================================
-- 5. Seed 100 tenants, one per first 100 landlords
-- ============================================================
DECLARE @j          INT = 1;
DECLARE @TFirstName NVARCHAR(50);
DECLARE @TLastName  NVARCHAR(50);
DECLARE @TEmail     NVARCHAR(200);
DECLARE @TPhone     NVARCHAR(20);
DECLARE @TOrgId     BIGINT;

WHILE @j <= 100
BEGIN
    -- Use different offsets so tenant names differ from landlord names in the list
    SET @FnIdx = ((@j * 3 + 5)  % @FirstNameCount) + 1;
    SET @LnIdx = ((@j * 11 + 17) % @LastNameCount)  + 1;

    SELECT @TFirstName = Name FROM #FirstNames WHERE Id = @FnIdx;
    SELECT @TLastName  = Name FROM #LastNames  WHERE Id = @LnIdx;

    SET @TEmail = LOWER(@TFirstName) + '.' + LOWER(@TLastName)
                  + '_t' + CAST(@j AS VARCHAR(10)) + '@brownstonehub.test';

    SET @TPhone =
        '(' + RIGHT('000' + CAST(300 + (@j % 700)           AS VARCHAR(3)), 3) + ') ' +
               RIGHT('000' + CAST(200 + ((@j * 5)  % 800)   AS VARCHAR(3)), 3) + '-' +
               RIGHT('0000'+ CAST(1000+ ((@j * 53) % 9000)  AS VARCHAR(4)), 4);

    -- Assign to landlord #j (first 100 landlords each get one tenant)
    SELECT @TOrgId = OrgId FROM #SeedLandlords WHERE Idx = @j;

    -- ---- tenant.Tenants ----
    INSERT INTO tenant.Tenants (
        Firstname, Lastname, Email, PhoneNumber,
        IsDeleted, UnitId, UserId, OrganizationId, CreatedAt, IsSeeded
    ) VALUES (
        @TFirstName, @TLastName, @TEmail, @TPhone,
        0, NULL, NULL, @TOrgId, @Now, 1
    );

    SET @j = @j + 1;
END;

-- ============================================================
-- Cleanup
-- ============================================================
DROP TABLE #FirstNames;
DROP TABLE #LastNames;
DROP TABLE #SeedLandlords;

COMMIT TRANSACTION;

PRINT 'Seed complete.';
PRINT '  200 landlord users inserted into core.Users';
PRINT '  200 UserSettings inserted into dbo.UserSettings';
PRINT '  200 organizations inserted into organization.Organizations';
PRINT '  200 OrganizationMembers inserted into organization.OrganizationMembers';
PRINT '  200 UserRoles (Landlord) inserted into core.UserRoles';
PRINT '  100 tenant records inserted into tenant.Tenants';
