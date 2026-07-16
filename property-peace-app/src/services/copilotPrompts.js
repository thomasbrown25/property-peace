/**
 * System prompt for AI Copilot
 */
export const SYSTEM_PROMPT = `You are BrownstoneHub AI Copilot, a helpful property management assistant for landlords.
Your role is to provide clear, prioritized summaries of portfolio items requiring attention and tell the landlord exactly what they should do today.

Guidelines:
- Greet the landlord by name if available
- Always check and report on ALL six portfolio health areas: (1) unpaid/overdue rent, (2) expiring leases, (3) aging work orders, (4) vacant units, (5) missing documents or signatures, (6) what the landlord should do today
- Prioritize items by urgency: urgent tenant messages > overdue rent > maintenance with no vendor assigned > expiring leases (< 30 days) > unsigned leases > missing move-in/out checklists > pending applications > vacant units > tenant accounts
- Use specific details: tenant names, property names, amounts, dates
- Pay special attention to urgent messages from tenants - these often require immediate response
- If an item has "Follow-up already sent" mentioned, note that a follow-up message was already sent to the tenant and the item is temporarily suppressed
- For suppressed items, mention them but note that follow-ups have already been sent (e.g., "Rent is overdue for such and such property but you have already sent a follow-up")
- IMPORTANT: Always mention issues even if tenants don't have email addresses. For tenants without emails, mention the issue (e.g., "Rent is overdue for Property - Unit by Tenant Name") but do not suggest email follow-up actions since they cannot be contacted via email
- Priority guidance:
  - (High): overdue rent, urgent messages, maintenance open > 14 days with no vendor, lease expirations within 14 days
  - (Medium): maintenance open > 7 days or with no vendor assigned, pending applications, unsigned leases, unpaid deposits, tenant accounts missing, lease expirations within 30 days
  - (Low): vacant units (opportunity to re-list), upcoming rent due, move-in/out checklists, tenant account reminders
- Suggest 3-8 top items
- For vacant units: mention how long the unit has been vacant and flag it as a revenue opportunity
- End the summary with a "Today's Top Actions" section listing 2-3 concrete things the landlord should do right now
- Format as natural, conversational language
- Do NOT include lines like "To manage these, you can [View Rent Collection]..." or similar management suggestions
- Do NOT use bracket notation [Action Name] in the message text - actions are handled separately
- Focus on providing the summary and recommendations only
- Keep each item description CONCISE - maximum 1-2 sentences per item

Output Format:
1. Brief greeting (one line)
2. Brief overview (e.g., "You have 3 items requiring immediate attention")
3. Prioritized list with details - Format each issue as a numbered item with priority indicator:
   - Use numbered format: "1. Issue Title (High):" or "2. Issue Title (Medium):" or "3. Issue Title (Low):"
   - Priority levels: (High), (Medium), or (Low)
   - Make sure each numbered issue is clearly formatted
   - Keep descriptions brief and actionable - 1-2 sentences max
4. Today's Top Actions: End with a short bulleted list of 2-3 concrete actions to take today

IMPORTANT: Always format issues as numbered items with priority indicators in parentheses. For example:
"1. Overdue Rent Payment (High): Tenant Name at Property - Unit owes $X.XX, N days overdue."
"2. Maintenance Request — No Vendor (Medium): Broken door at Property - Unit, open N days with no vendor assigned."
"3. Vacant Unit (Low): Unit 2B at Property has been vacant for N days — consider re-listing."

Be concise but informative. Use a friendly, professional tone.`;

/**
 * Build the user prompt with organization data
 * @param {Object} summaryData - Organization summary data
 * @param {string} landlordName - Optional landlord name
 * @returns {string} - Formatted prompt
 */
export const buildSummaryPrompt = (summaryData, landlordName = null) => {
  if (!summaryData) {
    return 'No data available.';
  }

  const sections = [];

  // Properties
  if (summaryData.properties?.length > 0) {
    sections.push(`Properties: ${summaryData.properties.length} total`);
    summaryData.properties.slice(0, 5).forEach(prop => {
      sections.push(`  - ${prop.name} (${prop.address}): ${prop.unitCount} units, ${prop.occupancyRate.toFixed(1)}% occupied`);
    });
  }

  // Overdue Rent
  if (summaryData.rentStatus?.overdue?.length > 0) {
    sections.push(`\nOverdue Rent Payments:`);
    summaryData.rentStatus.overdue.forEach(overdue => {
      const tenantNames = overdue.tenantNames && overdue.tenantNames.length > 0 
        ? overdue.tenantNames.join(' and ') 
        : 'Tenants';
      
      // Check if property is single-family (has only 1 unit) - don't show unit name for single-family
      const property = summaryData.properties?.find(p => p.name === overdue.propertyName);
      const isSingleFamily = property && property.unitCount === 1;
      const unitInfo = (!isSingleFamily && overdue.unitName) ? ` - ${overdue.unitName}` : '';
      
      const rentDuePart = overdue.rentAmount ? `, $${overdue.rentAmount.toFixed(2)} due this month` : '';
      const overdueAmountPart = overdue.amount > 0 ? `$${overdue.amount.toFixed(2)} past due` : 'current month not yet paid';
      sections.push(`  - ${tenantNames} at ${overdue.propertyName}${unitInfo}: ${overdueAmountPart}${rentDuePart} (${overdue.daysOverdue} days overdue)`);
    });
  }

  // Due Soon Rent (includes due today)
  if (summaryData.rentStatus?.dueSoon?.length > 0) {
    const dueToday = summaryData.rentStatus.dueSoon.filter(due => due.isDueToday);
    const dueSoon = summaryData.rentStatus.dueSoon.filter(due => !due.isDueToday);
    
    if (dueToday.length > 0) {
      sections.push(`\nRent Due Today:`);
      dueToday.forEach(due => {
        const dueDate = new Date(due.dueDate).toLocaleDateString();
        const tenantNames = due.tenantNames && due.tenantNames.length > 0 
          ? due.tenantNames.join(' and ') 
          : 'Tenants';
        
        // Check if property is single-family (has only 1 unit) - don't show unit name for single-family
        const property = summaryData.properties?.find(p => p.name === due.propertyName);
        const isSingleFamily = property && property.unitCount === 1;
        const unitInfo = (!isSingleFamily && due.unitName) ? ` - ${due.unitName}` : '';
        
        sections.push(`  - ${tenantNames} at ${due.propertyName}${unitInfo}: $${due.amount.toFixed(2)} (due today, ${dueDate})`);
      });
    }
    
    if (dueSoon.length > 0) {
      sections.push(`\nRent Due Soon:`);
      dueSoon.forEach(due => {
        const dueDate = new Date(due.dueDate).toLocaleDateString();
        const tenantNames = due.tenantNames && due.tenantNames.length > 0 
          ? due.tenantNames.join(' and ') 
          : 'Tenants';
        
        // Check if property is single-family (has only 1 unit) - don't show unit name for single-family
        const property = summaryData.properties?.find(p => p.name === due.propertyName);
        const isSingleFamily = property && property.unitCount === 1;
        const unitInfo = (!isSingleFamily && due.unitName) ? ` - ${due.unitName}` : '';
        
        sections.push(`  - ${tenantNames} at ${due.propertyName}${unitInfo}: $${due.amount.toFixed(2)} (due ${dueDate})`);
      });
    }
  }

  // Maintenance Requests
  if (summaryData.maintenanceRequests?.length > 0) {
    sections.push(`\nMaintenance Requests:`);
    summaryData.maintenanceRequests.slice(0, 10).forEach(mr => {
      const vendorStatus = mr.hasVendorAssigned ? 'vendor assigned' : 'NO VENDOR ASSIGNED';
      sections.push(`  - ${mr.title} at ${mr.propertyName || 'Property'}: ${mr.priority} priority, ${mr.status} status, ${mr.daysOpen} days open, ${vendorStatus}`);
      if (mr.tenantName) {
        sections[sections.length - 1] += ` (from ${mr.tenantName})`;
      }
    });
  }

  // Applications
  if (summaryData.applications?.length > 0) {
    sections.push(`\nPending Applications:`);
    summaryData.applications.forEach(app => {
      // Check if property is single-family (has only 1 unit) - don't show unit name for single-family
      const property = summaryData.properties?.find(p => p.name === app.propertyName);
      const isSingleFamily = property && property.unitCount === 1;
      const unitInfo = (!isSingleFamily && app.unitName) ? ` - ${app.unitName}` : '';
      
      sections.push(`  - ${app.applicantName} for ${app.propertyName || 'Property'}${unitInfo}: ${app.status} (${app.daysPending} days pending)`);
    });
  }

  // Upcoming Leases (leases that haven't started yet but will start soon)
  if (summaryData.upcomingLeases?.length > 0) {
    sections.push(`\nUpcoming Leases (Leases Starting Soon):`);
    summaryData.upcomingLeases.forEach(lease => {
      const startDate = new Date(lease.startDate).toLocaleDateString();
      const tenantNames = lease.tenantNames && lease.tenantNames.length > 0 
        ? lease.tenantNames.join(' and ') 
        : 'Tenants';
      
      // Check if property is single-family (has only 1 unit) - don't show unit name for single-family
      const property = summaryData.properties?.find(p => p.id === lease.propertyId || p.name === lease.propertyName);
      const isSingleFamily = property && property.unitCount === 1;
      const unitInfo = (!isSingleFamily && lease.unitName) ? ` - ${lease.unitName}` : '';
      
      const hasApplication = lease.hasApplication !== undefined ? lease.hasApplication : false;
      const checklistCompleted = lease.checklistCompleted !== undefined ? lease.checklistCompleted : false;
      sections.push(`  - ${tenantNames} at ${lease.propertyName}${unitInfo}: Starting ${startDate} (in ${lease.daysUntilStart} days), Rent: $${lease.rentAmount.toFixed(2)}/month, HasApplication: ${hasApplication}, ChecklistCompleted: ${checklistCompleted}`);
    });
  }

  // Lease Expirations
  if (summaryData.leaseExpirations?.length > 0) {
    sections.push(`\nUpcoming Lease Expirations:`);
    summaryData.leaseExpirations.forEach(lease => {
      const expDate = new Date(lease.expirationDate).toLocaleDateString();
      
      // Check if property is single-family (has only 1 unit) - don't show unit name for single-family
      const property = summaryData.properties?.find(p => p.name === lease.propertyName);
      const isSingleFamily = property && property.unitCount === 1;
      const unitInfo = (!isSingleFamily && lease.unitName) ? ` - ${lease.unitName}` : '';
      
      sections.push(`  - ${lease.tenantName} at ${lease.propertyName}${unitInfo}: expires ${expDate} (${lease.daysUntilExpiration} days)`);
    });
  }

  // Vacant Units
  if (summaryData.vacantUnits?.length > 0) {
    sections.push(`\nVacant Units (no active lease):`);
    summaryData.vacantUnits.forEach(unit => {
      const vacancyInfo = unit.daysVacant > 0
        ? `vacant for ${unit.daysVacant} days`
        : 'never leased';
      const rentInfo = unit.listedRentAmount > 0 ? `, listed at $${unit.listedRentAmount.toFixed(2)}/month` : '';
      sections.push(`  - ${unit.unitName} at ${unit.propertyName}: ${vacancyInfo}${rentInfo}`);
    });
  }

  // Important Tasks
  if (summaryData.importantTasks?.length > 0) {
    sections.push(`\nImportant Tasks:`);
    summaryData.importantTasks.forEach(task => {
      sections.push(`  - ${task.type}: ${task.description} (${task.priority} priority)`);
    });
  }

  // Urgent Messages
  if (summaryData.urgentMessages?.length > 0) {
    sections.push(`\nUrgent Messages from Tenants:`);
    summaryData.urgentMessages.forEach(msg => {
      const tenantInfo = msg.tenantName ? ` from ${msg.tenantName}` : '';
      const propertyInfo = msg.propertyName ? ` at ${msg.propertyName}` : '';
      
      // Check if property is single-family (has only 1 unit) - don't show unit name for single-family
      const property = summaryData.properties?.find(p => p.name === msg.propertyName);
      const isSingleFamily = property && property.unitCount === 1;
      const unitInfo = (!isSingleFamily && msg.unitName) ? ` - ${msg.unitName}` : '';
      
      sections.push(`  - ${msg.title}${tenantInfo}${propertyInfo}${unitInfo}:`);
      
      if (msg.urgentItems && msg.urgentItems.length > 0) {
        msg.urgentItems.forEach(item => {
          sections.push(`    * ${item.type} (${item.severity}): ${item.description}`);
          if (item.messageExcerpt) {
            sections[sections.length - 1] += ` - "${item.messageExcerpt}"`;
          }
        });
      } else if (msg.aiSummary) {
        sections.push(`    * ${msg.aiSummary}`);
      }
      
      if (msg.lastMessageAt) {
        const lastMessageDate = new Date(msg.lastMessageAt).toLocaleDateString();
        sections[sections.length - 1] += ` (Last message: ${lastMessageDate})`;
      }
    });
  }

  // Suppressed Actions (items where follow-ups have already been sent)
  if (summaryData.suppressedActions?.length > 0) {
    sections.push(`\nItems with Follow-ups Already Sent (not requiring immediate action):`);
    summaryData.suppressedActions.forEach(suppressed => {
      const suppressedUntil = new Date(suppressed.suppressedUntil).toLocaleDateString();
      switch (suppressed.actionType) {
        case 'sendAIFollowUp_OverdueRent':
          sections.push(`  - Overdue rent follow-up already sent (suppressed until ${suppressedUntil})`);
          break;
        case 'sendAIFollowUp_TenantAccount':
          sections.push(`  - Tenant account creation follow-up already sent (suppressed until ${suppressedUntil})`);
          break;
        case 'sendAIFollowUp_LeaseSigning':
          sections.push(`  - Lease signing follow-up already sent (suppressed until ${suppressedUntil})`);
          break;
        default:
          sections.push(`  - Follow-up already sent for ${suppressed.actionType} (suppressed until ${suppressedUntil})`);
      }
      if (suppressed.reason) {
        sections[sections.length - 1] += ` - ${suppressed.reason}`;
      }
    });
  }

  const dataSection = sections.join('\n');
  const greeting = landlordName ? `Hello ${landlordName}!` : 'Hello!';

  return `${greeting}

Here's your organization's current status:

${dataSection}

IMPORTANT: When analyzing occupancy, keep in mind that "Upcoming Leases" represent units that will be occupied soon (leases that haven't started yet but are scheduled to start). These should be considered as upcoming occupancy, not vacant units. A property may show low current occupancy but have multiple upcoming leases that will fill most units soon.

For upcoming leases, explain WHY they need attention by listing specific action items:
- If "Application: No" is shown, mention that no application has been sent or approved for this unit
- If "Checklist: Incomplete" is shown, mention that the move-in checklist needs to be completed
- List the specific tasks that need to be done (e.g., "Send application to tenant", "Complete move-in checklist", "Upload before move-in photos", etc.)
- Be specific about what actions are required for each upcoming lease

For maintenance requests with "NO VENDOR ASSIGNED": flag these as needing immediate vendor assignment, especially if they have been open for more than 7 days.

For vacant units: these are revenue opportunities. Mention how long the unit has been vacant and suggest the landlord consider re-listing or updating the rent price.

Please provide a concise, prioritized summary covering all six areas (unpaid rent, expiring leases, aging work orders, vacant units, missing documents, and today's actions). End with a "Today's Top Actions" bullet list of 2-3 specific things the landlord should do right now.`;
};

/**
 * Build prompt for command parsing
 * @param {string} userCommand - User's natural language command
 * @param {Object} summaryData - Organization summary data for context
 * @returns {string} - Formatted prompt
 */
export const buildCommandPrompt = (userCommand, summaryData) => {
  return `The user said: "${userCommand}"

Based on the following organization data, determine what action they want to perform and extract the necessary parameters:

${JSON.stringify(summaryData, null, 2)}

Available actions:
- resendInvite: Resend tenant invite (requires tenantId or applicationId)
- sendPaymentReminder: Send payment reminder (requires tenantId, leaseId)
- approveApplication: Approve application (requires applicationId)
- createWorkOrder: Create work order from maintenance request (requires maintenanceRequestId)
- sendLeaseRenewalNotice: Send lease renewal notice (requires leaseId)
- navigateToPage: Navigate to a page (requires route)

Return a JSON object with:
{
  "action": "actionName",
  "params": { ... }
}`;
};

/**
 * Extract action suggestions from AI response
 * @param {string} aiResponse - AI generated response
 * @returns {Array} - Array of action objects
 */
export const extractActions = (aiResponse) => {
  const actions = [];
  
  // Look for action patterns in the response
  // This is a simple extraction - could be enhanced with more sophisticated parsing
  const actionPatterns = [
    { pattern: /resend.*invite/i, action: 'resendInvite' },
    { pattern: /send.*reminder|remind.*payment/i, action: 'sendPaymentReminder' },
    { pattern: /approve.*application/i, action: 'approveApplication' },
    { pattern: /create.*work.*order|work.*order/i, action: 'createWorkOrder' },
    { pattern: /renewal.*notice|lease.*renewal/i, action: 'sendLeaseRenewalNotice' }
  ];

  // For now, return empty array - actions will be determined by the AI response structure
  // In a full implementation, we'd parse the response more intelligently
  return actions;
};

