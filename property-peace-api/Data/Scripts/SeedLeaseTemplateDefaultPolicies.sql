-- Script to seed LeaseTemplateDefaultPolicies table
-- Run this script after creating the table via migration

-- Check if table exists and is empty before seeding
IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'LeaseTemplateDefaultPolicies')
BEGIN
    -- Only insert if table is empty
    IF NOT EXISTS (SELECT 1 FROM LeaseTemplateDefaultPolicies)
    BEGIN
        INSERT INTO LeaseTemplateDefaultPolicies (Title, Content, Category, [Order], CreatedAt)
        VALUES
            ('Rent Payment', 'Rent is due on the first day of each month; late payments may incur a fee as specified in the lease agreement.', 'Rent', 1, GETDATE()),
            ('Rent Payment', 'Tenant shall provide a security deposit prior to occupancy, which may be used to cover damages or unpaid rent and will be returned in accordance with state laws.', 'Rent', 2, GETDATE()),
            ('Quiet Hours', 'Quiet hours are from 10:00 PM to 7:00 AM daily: Tenant is expected to minimize noise during these hours to avoid disturbing neighbors.', 'QuietHours', 3, GETDATE()),
            ('Parking', 'Parking is permitted only in designated areas; Tenant shall not block driveways or park in spaces assigned to other residents.', 'Parking', 4, GETDATE()),
            ('Trash Disposal', 'Tenant is responsible for proper disposal of trash and recycling in designated containers and must adhere to local waste collection schedules.', 'Trash', 5, GETDATE()),
            ('Maintenance', 'Tenant shall promptly notify the landlord of any maintenance or repair issues; minor maintenance may be the Tenant''s responsibility as outlined in the lease.', 'Maintenance', 6, GETDATE()),
            ('Guests', 'Guests are allowed with prior notice to the landlord if staying longer than 7 consecutive days; overnight visitors must comply with lease terms.', 'Guests', 7, GETDATE()),
            ('Smoking', 'Smoking and the use of illegal drugs are strictly prohibited within the property and common areas to ensure a safe and healthy environment.', 'Smoking', 8, GETDATE()),
            ('Pets', 'Pets are allowed only with prior written approval and may be subject to additional fees or restrictions as specified in the lease.', 'Pets', 9, GETDATE()),
            ('Security Deposit', 'Tenant shall not change or add locks without landlord''s written consent; lost keys must be reported immediately for security purposes.', 'Deposit', 10, GETDATE()),
            ('Alterations', 'No alterations or modifications to the property are permitted without prior written approval from the landlord.', 'Alterations', 11, GETDATE()),
            ('Move-Out', 'Tenant is responsible for cleaning the premises upon move-out, including removing all personal belongings and leaving the property in a clean condition.', 'Cleaning', 12, GETDATE()),
            ('Utilities', 'Utilities shall be paid by the Tenant as specified in the lease; any utility accounts must be established in the Tenant''s name unless otherwise agreed.', 'Utilities', 13, GETDATE()),
            ('Subletting', 'Subletting or assigning the lease is prohibited without prior written consent from the landlord.', 'Subletting', 14, GETDATE()),
            ('Maintenance', 'Landlord reserves the right to enter the property for inspections, repairs, or emergencies with reasonable notice to the Tenant.', 'Maintenance', 15, GETDATE());
        
        PRINT 'Successfully seeded 15 default lease template policies.';
    END
    ELSE
    BEGIN
        PRINT 'LeaseTemplateDefaultPolicies table already contains data. Skipping seed.';
    END
END
ELSE
BEGIN
    PRINT 'ERROR: LeaseTemplateDefaultPolicies table does not exist. Please run the migration first.';
END
