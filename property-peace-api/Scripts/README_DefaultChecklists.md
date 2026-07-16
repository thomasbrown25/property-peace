# Default Checklists for Properties

## Overview
This implementation automatically creates default Move-In and Move-Out checklists for each property when it is created. The checklists use the organization's default checklist items (templates) and are property-level (not unit-specific).

## How It Works

### 1. Automatic Creation for New Properties
When a new property is created via `PropertyService.AddOrUpdateProperty()`, the system automatically:
- Retrieves the organization's default checklist items
- Creates a "Default Move-In Checklist" with all organization items
- Creates a "Default Move-Out Checklist" with all organization items
- Both checklists are property-level (UnitId = NULL)

### 2. Organization Checklist Items
- Organization checklist items are templates stored in `OrganizationChecklistItems` table
- Each organization has its own set of default items
- Default items are seeded when an organization is created (via `SeedDefaultChecklistItems` endpoint)
- Landlords can add custom items to their organization's template

### 3. Property-Level Checklists
- Checklists are created at the property level (UnitId = NULL)
- This means all units in a property share the same default checklist template
- When creating a specific checklist for a unit, landlords can use the property's default checklist as a starting point

## Files Modified

### Backend Services
1. **ChecklistService.cs**
   - Added `CreateDefaultChecklistsForProperty()` method
   - This method creates both Move-In and Move-Out checklists using organization items

2. **PropertyService.cs**
   - Modified `AddOrUpdateProperty()` to call `CreateDefaultChecklistsForProperty()` after creating a new property
   - Wrapped in try-catch to prevent property creation failure if checklist creation fails

### SQL Scripts
1. **SeedDefaultChecklistsForExistingProperties.sql**
   - Full SQL script with cursors to seed default checklists for existing properties
   - Creates Move-In and Move-Out checklists with all organization items

2. **SeedDefaultChecklistsForExistingProperties_Simple.sql**
   - Simplified script that shows which properties need default checklists
   - Useful for verification before running the full script

## Usage

### For New Properties
No action needed - default checklists are created automatically when a property is created.

### For Existing Properties

#### Option 1: Use SQL Script (Recommended for bulk operations)
1. Ensure all organizations have default checklist items seeded:
   ```sql
   -- Check if organizations have default items
   SELECT OrganizationId, COUNT(*) AS ItemCount
   FROM OrganizationChecklistItems
   WHERE IsDeleted = 0 AND IsDefault = 1
   GROUP BY OrganizationId;
   ```

2. Run the SQL script:
   ```sql
   -- Execute SeedDefaultChecklistsForExistingProperties.sql
   -- This will create default checklists for all properties that don't have them
   ```

#### Option 2: Use API Endpoint (Recommended for individual properties)
Call the `CreateDefaultChecklistsForProperty` method via a custom endpoint or directly in code:

```csharp
var response = await _checklistService.CreateDefaultChecklistsForProperty(
    propertyId: 123,
    landlordId: 456,
    organizationId: 789
);
```

#### Option 3: Create a Migration Script
You can create a C# migration script that calls the service method for each existing property.

## Database Structure

### Checklists Table
- `ChecklistType`: 40 (MoveInChecklist) or 41 (MoveOutChecklist)
- `PropertyId`: The property this checklist belongs to
- `UnitId`: NULL for property-level checklists
- `Title`: "Default Move-In Checklist" or "Default Move-Out Checklist"
- `OrganizationId`: The organization that owns this checklist

### ChecklistItems Table
- Contains individual items from the organization's template
- Each checklist has items copied from `OrganizationChecklistItems`

## Notes

1. **Property-Level vs Unit-Level**: Default checklists are property-level. When a landlord creates a specific checklist for a unit, they can start from the property's default checklist.

2. **Organization Items**: If an organization doesn't have default items, the system will automatically seed them when creating checklists.

3. **Error Handling**: If checklist creation fails during property creation, the property is still created successfully (error is logged but doesn't fail the operation).

4. **Updates**: If organization items are updated, existing property checklists are NOT automatically updated. Only new properties will get the updated items.

## Verification

To verify that default checklists were created:

```sql
SELECT 
    p.Id AS PropertyId,
    p.Name AS PropertyName,
    p.OrganizationId,
    COUNT(c.Id) AS ChecklistCount,
    SUM(CASE WHEN c.ChecklistType = 40 THEN 1 ELSE 0 END) AS MoveInCount,
    SUM(CASE WHEN c.ChecklistType = 41 THEN 1 ELSE 0 END) AS MoveOutCount
FROM Properties p
LEFT JOIN Checklists c ON c.PropertyId = p.Id 
    AND c.UnitId IS NULL 
    AND c.Title LIKE 'Default%'
WHERE p.IsDeleted = 0
GROUP BY p.Id, p.Name, p.OrganizationId
ORDER BY p.OrganizationId, p.Id;
```

Expected result: Each property should have 2 checklists (1 Move-In, 1 Move-Out).

