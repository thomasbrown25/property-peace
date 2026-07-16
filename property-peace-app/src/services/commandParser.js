import { generateChatCompletion } from './azureAIService';
import { buildCommandPrompt } from './copilotPrompts';

/**
 * Parse natural language command into structured action
 * @param {string} command - User's natural language command
 * @param {Object} summaryData - Organization summary data for context
 * @returns {Promise<Object>} - Parsed action object
 */
export const parseCommand = async (command, summaryData) => {
  try {
    // Define available functions for function calling
    const functions = [
      {
        name: 'resendInvite',
        description: 'Resend a tenant invite for an application',
        parameters: {
          type: 'object',
          properties: {
            inviteId: {
              type: 'number',
              description: 'The invite ID to resend'
            },
            applicationId: {
              type: 'number',
              description: 'The application ID associated with the invite'
            },
            tenantName: {
              type: 'string',
              description: 'Name of the tenant to resend invite to'
            }
          }
        }
      },
      {
        name: 'sendPaymentReminder',
        description: 'Send a payment reminder to a tenant. Can identify by tenant name, property name, or lease ID.',
        parameters: {
          type: 'object',
          properties: {
            tenantId: {
              type: 'number',
              description: 'The tenant ID'
            },
            tenantName: {
              type: 'string',
              description: 'Name of the tenant (e.g., "John Smith")'
            },
            leaseId: {
              type: 'number',
              description: 'The lease ID'
            },
            propertyName: {
              type: 'string',
              description: 'Name of the property or unit (e.g., "Shannon House", "123 Main St", "Apartment 2B")'
            }
          },
          required: []
        }
      },
      {
        name: 'approveApplication',
        description: 'Approve a rental application',
        parameters: {
          type: 'object',
          properties: {
            applicationId: {
              type: 'number',
              description: 'The application ID to approve'
            },
            applicantName: {
              type: 'string',
              description: 'Name of the applicant'
            }
          },
          required: ['applicationId']
        }
      },
      {
        name: 'createWorkOrder',
        description: 'Create a work order from a maintenance request',
        parameters: {
          type: 'object',
          properties: {
            maintenanceRequestId: {
              type: 'number',
              description: 'The maintenance request ID'
            },
            title: {
              type: 'string',
              description: 'Title of the maintenance request'
            }
          },
          required: ['maintenanceRequestId']
        }
      },
      {
        name: 'sendLeaseRenewalNotice',
        description: 'Send a lease renewal notice',
        parameters: {
          type: 'object',
          properties: {
            leaseId: {
              type: 'number',
              description: 'The lease ID'
            },
            tenantName: {
              type: 'string',
              description: 'Name of the tenant'
            },
            propertyName: {
              type: 'string',
              description: 'Name of the property'
            }
          },
          required: ['leaseId']
        }
      },
      {
        name: 'navigateToPage',
        description: 'Navigate to a specific page in the application',
        parameters: {
          type: 'object',
          properties: {
            route: {
              type: 'string',
              description: 'The route path to navigate to (e.g., /landlord/maintenances, /landlord/applications)',
              enum: [
                '/landlord/dashboard',
                '/landlord/properties',
                '/landlord/tenants',
                '/landlord/applications',
                '/landlord/maintenances',
                '/landlord/rent-collection',
                '/landlord/leases',
                '/landlord/reports'
              ]
            }
          },
          required: ['route']
        }
      },
      {
        name: 'showData',
        description: 'Display data for the user (teams, properties, tenants, applications, leases, rent collection, payments, reports)',
        parameters: {
          type: 'object',
          properties: {
            dataType: {
              type: 'string',
              description: 'The type of data to show',
              enum: [
                'teams',
                'organizations',
                'properties',
                'tenants',
                'applications',
                'leases',
                'rentCollection',
                'payments',
                'reports',
                'tenantLookup'
              ]
            },
            propertyName: {
              type: 'string',
              description: 'Property name for tenant lookup or filtering'
            },
            leaseId: {
              type: 'number',
              description: 'Lease ID for payments query'
            },
            reportType: {
              type: 'string',
              description: 'Type of report (expense, tax, analytics, occupancy)'
            }
          },
          required: ['dataType']
        }
      }
    ];

    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that parses user commands and maps them to actions. Extract entities (names, IDs) from the command and match them to the available data.'
      },
      {
        role: 'user',
        content: buildCommandPrompt(command, summaryData)
      }
    ];

    // Try function calling first
    const response = await generateChatCompletion(messages, {
      functions,
      functionCall: 'auto',
      temperature: 0.3
    });

    // If function call was returned, use it
    if (response.functionCall) {
      const functionName = response.functionCall.name;
      let params = {};

      try {
        params = JSON.parse(response.functionCall.arguments || '{}');
      } catch (e) {
        console.warn('Failed to parse function arguments:', e);
      }

      // Try to match entities from summary data
      params = matchEntitiesToData(params, command, summaryData);

      return {
        action: functionName,
        params
      };
    }

    // Fallback: try to parse from text response
    return parseFromTextResponse(response.content || response, command, summaryData);
  } catch (error) {
    console.error('Error parsing command:', error);
    return {
      action: null,
      params: {},
      error: error.message
    };
  }
};

/**
 * Match entity names to IDs from summary data
 * @param {Object} params - Initial params with names
 * @param {string} command - Original command
 * @param {Object} summaryData - Summary data
 * @returns {Object} - Params with IDs filled in
 */
const matchEntitiesToData = (params, command, summaryData) => {
  const result = { ...params };

  // Match tenant names
  if (params.tenantName && !params.tenantId) {
    const tenant = summaryData?.tenants?.find(t => 
      t.name?.toLowerCase().includes(params.tenantName.toLowerCase()) ||
      params.tenantName.toLowerCase().includes(t.name?.toLowerCase())
    );
    if (tenant) {
      result.tenantId = tenant.id;
    }
  }

  // Match application by applicant name
  if (params.applicantName && !params.applicationId) {
    const application = summaryData?.applications?.find(a =>
      a.applicantName?.toLowerCase().includes(params.applicantName.toLowerCase()) ||
      params.applicantName.toLowerCase().includes(a.applicantName?.toLowerCase())
    );
    if (application) {
      result.applicationId = application.id;
    }
  }

  // Match maintenance request by title
  if (params.title && !params.maintenanceRequestId) {
    const maintenance = summaryData?.maintenanceRequests?.find(mr =>
      mr.title?.toLowerCase().includes(params.title.toLowerCase()) ||
      params.title.toLowerCase().includes(mr.title?.toLowerCase())
    );
    if (maintenance) {
      result.maintenanceRequestId = maintenance.id;
    }
  }

  // Match lease by tenant/property
  if (params.tenantName && !params.leaseId) {
    const tenant = summaryData?.tenants?.find(t =>
      t.name?.toLowerCase().includes(params.tenantName.toLowerCase())
    );
    
    // First try to find lease from rentStatus (overdue/dueSoon) - most common case
    if (summaryData?.rentStatus) {
      const allLeases = [
        ...(summaryData.rentStatus.overdue || []),
        ...(summaryData.rentStatus.dueSoon || [])
      ];
      const lease = allLeases.find(l =>
        l.tenantNames?.some(name => 
          name?.toLowerCase().includes(params.tenantName.toLowerCase()) ||
          params.tenantName.toLowerCase().includes(name?.toLowerCase())
        )
      );
      if (lease?.leaseId) {
        result.leaseId = lease.leaseId;
      }
    }
    
    // Fallback to leaseExpirations if not found in rentStatus
    if (!result.leaseId && tenant && summaryData?.leaseExpirations) {
      const lease = summaryData.leaseExpirations.find(l =>
        l.tenantName?.toLowerCase().includes(params.tenantName.toLowerCase())
      );
      if (lease) {
        result.leaseId = lease.id;
      }
    }
  }

  // Match lease by property name - NEW: Handle property names in commands
  if (params.propertyName && !params.leaseId) {
    const propertyNameLower = params.propertyName.toLowerCase();
    
    // Try to find lease from rentStatus by property name
    if (summaryData?.rentStatus) {
      const allLeases = [
        ...(summaryData.rentStatus.overdue || []),
        ...(summaryData.rentStatus.dueSoon || [])
      ];
      const lease = allLeases.find(l =>
        l.propertyName?.toLowerCase().includes(propertyNameLower) ||
        propertyNameLower.includes(l.propertyName?.toLowerCase() || '') ||
        l.unitName?.toLowerCase().includes(propertyNameLower) ||
        propertyNameLower.includes(l.unitName?.toLowerCase() || '')
      );
      if (lease?.leaseId) {
        result.leaseId = lease.leaseId;
      }
    }
    
    // Also check leaseExpirations
    if (!result.leaseId && summaryData?.leaseExpirations) {
      const lease = summaryData.leaseExpirations.find(l =>
        l.propertyName?.toLowerCase().includes(propertyNameLower) ||
        propertyNameLower.includes(l.propertyName?.toLowerCase() || '')
      );
      if (lease?.id) {
        result.leaseId = lease.id;
      }
    }
  }
  
  // Also match leaseId if tenantId is provided but leaseId is not
  if (params.tenantId && !params.leaseId && summaryData?.rentStatus) {
    const allLeases = [
      ...(summaryData.rentStatus.overdue || []),
      ...(summaryData.rentStatus.dueSoon || [])
    ];
    // Try to find lease by matching tenant IDs in the lease data
    // Note: This requires the lease data to have tenant IDs, which may not always be available
    // The sendPaymentReminder function will handle lookup if needed
  }

  return result;
};

/**
 * Fallback parser for text responses
 * @param {string} response - AI text response
 * @param {string} command - Original command
 * @param {Object} summaryData - Summary data
 * @returns {Object} - Parsed action
 */
const parseFromTextResponse = (response, command, summaryData) => {
  // Simple keyword matching as fallback
  const lowerCommand = command.toLowerCase();

  if (lowerCommand.includes('resend') && (lowerCommand.includes('invite') || lowerCommand.includes('invitation'))) {
    return {
      action: 'resendInvite',
      params: extractIdsFromCommand(command, summaryData)
    };
  }

  if (lowerCommand.includes('remind') && (lowerCommand.includes('payment') || lowerCommand.includes('rent'))) {
    const params = extractIdsFromCommand(command, summaryData);
    
    // Try to extract property name from common patterns
    // Patterns: "send reminder to [property]", "remind [property]", "reminder for [property]"
    const propertyPatterns = [
      /(?:send|payment|rent).*?reminder.*?(?:to|for|at)\s+([^\?\.]+)/i,
      /remind.*?(?:to|for|at)\s+([^\?\.]+)/i,
      /reminder.*?(?:to|for|at)\s+([^\?\.]+)/i
    ];
    
    for (const pattern of propertyPatterns) {
      const match = command.match(pattern);
      if (match && match[1]) {
        const extractedName = match[1].trim();
        // Remove common words that might be part of the command
        const cleanedName = extractedName
          .replace(/\b(property|house|apartment|unit|tenant|the|a|an)\b/gi, '')
          .trim();
        if (cleanedName) {
          params.propertyName = cleanedName;
        }
      }
    }
    
    return {
      action: 'sendPaymentReminder',
      params
    };
  }

  if (lowerCommand.includes('approve') && lowerCommand.includes('application')) {
    return {
      action: 'approveApplication',
      params: extractIdsFromCommand(command, summaryData)
    };
  }

  if (lowerCommand.includes('work order') || lowerCommand.includes('maintenance')) {
    return {
      action: 'createWorkOrder',
      params: extractIdsFromCommand(command, summaryData)
    };
  }

  if (lowerCommand.includes('renewal') || lowerCommand.includes('renew')) {
    return {
      action: 'sendLeaseRenewalNotice',
      params: extractIdsFromCommand(command, summaryData)
    };
  }

  // Handle "show me" commands - prioritize navigation over data display
  if (lowerCommand.includes('show me') || lowerCommand.includes('show my') || lowerCommand.includes('display')) {
    // Check if it's a specific item (e.g., "show me the lease for shannon house")
    if (lowerCommand.includes('lease') && (lowerCommand.includes('for') || lowerCommand.includes('at'))) {
      // Extract property name
      const propertyMatch = command.match(/(?:lease|property)\s+(?:for|at)\s+([^\?\.]+)/i) || 
                           command.match(/(?:for|at)\s+([^\?\.]+)/i);
      const params = { dataType: 'navigateToLease' };
      if (propertyMatch) {
        params.propertyName = propertyMatch[1].trim();
      }
      return {
        action: 'navigateToSpecificItem',
        params
      };
    }
    
    // Check if it's a specific property
    if (lowerCommand.includes('propert') && (lowerCommand.includes('for') || lowerCommand.includes('named'))) {
      const propertyMatch = command.match(/property\s+(?:for|named|called)\s+([^\?\.]+)/i);
      const params = { dataType: 'navigateToProperty' };
      if (propertyMatch) {
        params.propertyName = propertyMatch[1].trim();
      }
      return {
        action: 'navigateToSpecificItem',
        params
      };
    }
    
    // General navigation commands - navigate to pages
    if (lowerCommand.includes('team') || lowerCommand.includes('organization')) {
      return {
        action: 'navigateToPage',
        params: { route: '/landlord/settings' } // Assuming organizations are in settings
      };
    }
    if (lowerCommand.includes('propert') || lowerCommand.includes('portfolio')) {
      return {
        action: 'navigateToPage',
        params: { route: '/landlord/properties' }
      };
    }
    if (lowerCommand.includes('tenant')) {
      return {
        action: 'navigateToPage',
        params: { route: '/landlord/tenants' }
      };
    }
    if (lowerCommand.includes('application')) {
      return {
        action: 'navigateToPage',
        params: { route: '/landlord/applications' }
      };
    }
    if (lowerCommand.includes('lease')) {
      return {
        action: 'navigateToPage',
        params: { route: '/landlord/leases' }
      };
    }
    if (lowerCommand.includes('rent collection') || lowerCommand.includes('rent collection')) {
      return {
        action: 'navigateToPage',
        params: { route: '/landlord/rent-collection' }
      };
    }
    if (lowerCommand.includes('payment')) {
      // Try to extract lease ID or property name
      // Patterns: "payments for lease X", "payments for lease (name)", "show payments"
      const leaseIdMatch = command.match(/lease\s+(\d+)/i);
      const leaseNameMatch = command.match(/lease\s+([^\?\.]+)/i);
      const params = { dataType: 'payments' };
      
      if (leaseIdMatch) {
        const leaseId = parseInt(leaseIdMatch[1]);
        if (!isNaN(leaseId)) {
          params.leaseId = leaseId;
        }
      } else if (leaseNameMatch && summaryData) {
        // Try to find lease by property/unit name from summary data
        const leaseName = leaseNameMatch[1].trim();
        // Look in rent collection data or leases
        if (summaryData.rentStatus) {
          // Check overdue and dueSoon lists
          const allLeases = [
            ...(summaryData.rentStatus.overdue || []),
            ...(summaryData.rentStatus.dueSoon || [])
          ];
          const matchingLease = allLeases.find(l => 
            l.propertyName?.toLowerCase().includes(leaseName.toLowerCase()) ||
            l.unitName?.toLowerCase().includes(leaseName.toLowerCase())
          );
          if (matchingLease?.leaseId) {
            params.leaseId = matchingLease.leaseId;
          }
        }
      }
      return {
        action: 'showData',
        params
      };
    }
    if (lowerCommand.includes('report')) {
      let reportType = null;
      if (lowerCommand.includes('expense')) reportType = 'expense';
      else if (lowerCommand.includes('tax')) reportType = 'tax';
      else if (lowerCommand.includes('analytics')) reportType = 'analytics';
      else if (lowerCommand.includes('occupancy')) reportType = 'occupancy';
      
      return {
        action: 'showData',
        params: { dataType: 'reports', reportType }
      };
    }
  }

  // Handle tenant lookup queries
  if (lowerCommand.includes('who is') && lowerCommand.includes('tenant') && lowerCommand.includes('property')) {
    // Extract property name
    const propertyMatch = command.match(/property\s+([^\?]+)/i);
    const params = { dataType: 'tenantLookup' };
    if (propertyMatch) {
      params.propertyName = propertyMatch[1].trim();
    }
    return {
      action: 'showData',
      params
    };
  }

  // Handle common bracket action phrases
  if (lowerCommand.includes('view rent collection') || lowerCommand.includes('rent collection')) {
    return {
      action: 'navigateToPage',
      params: { route: '/landlord/rent-collection' }
    };
  }
  if (lowerCommand.includes('review application') || lowerCommand.includes('view application')) {
    // Try to find application ID from summary data
    if (summaryData?.applications && summaryData.applications.length > 0) {
      // Extract name if mentioned
      const nameMatch = command.match(/(?:review|view).*?application.*?(?:for|from)\s+([^\s]+(?:\s+[^\s]+)?)/i);
      if (nameMatch) {
        const name = nameMatch[1].trim();
        const app = summaryData.applications.find(a => 
          a.applicantName?.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(a.applicantName?.toLowerCase())
        );
        if (app?.id) {
          return {
            action: 'viewApplication',
            params: { applicationId: app.id }
          };
        }
      }
      // Default to first application
      return {
        action: 'viewApplication',
        params: { applicationId: summaryData.applications[0].id }
      };
    }
    return {
      action: 'navigateToPage',
      params: { route: '/landlord/applications' }
    };
  }
  if (lowerCommand.includes('view maintenance') || lowerCommand.includes('review maintenance')) {
    // Try to find maintenance request ID
    if (summaryData?.maintenanceRequests && summaryData.maintenanceRequests.length > 0) {
      const nameMatch = command.match(/(?:view|review).*?maintenance.*?"([^"]+)"/i);
      if (nameMatch) {
        const title = nameMatch[1].trim();
        const mr = summaryData.maintenanceRequests.find(m => 
          m.title?.toLowerCase().includes(title.toLowerCase())
        );
        if (mr?.id) {
          return {
            action: 'viewMaintenanceRequest',
            params: { maintenanceRequestId: mr.id }
          };
        }
      }
      // Default to first maintenance request
      return {
        action: 'viewMaintenanceRequest',
        params: { maintenanceRequestId: summaryData.maintenanceRequests[0].id }
      };
    }
    return {
      action: 'navigateToPage',
      params: { route: '/landlord/maintenances' }
    };
  }
  if (lowerCommand.includes('view lease') || lowerCommand.includes('see lease')) {
    // Try to find lease by property name
    const propertyMatch = command.match(/(?:view|see).*?lease.*?(?:for|at)\s+([^\?\.]+)/i);
    if (propertyMatch && summaryData) {
      return {
        action: 'navigateToSpecificItem',
        params: { dataType: 'navigateToLease', propertyName: propertyMatch[1].trim() }
      };
    }
    return {
      action: 'navigateToPage',
      params: { route: '/landlord/leases' }
    };
  }
  if (lowerCommand.includes('confirm rent payment') || lowerCommand.includes('view rent payment')) {
    return {
      action: 'navigateToPage',
      params: { route: '/landlord/rent-collection' }
    };
  }

  // Handle navigation commands
  if (lowerCommand.includes('show') || lowerCommand.includes('go to') || lowerCommand.includes('open') || lowerCommand.includes('view')) {
    // Try to extract route
    let route = '/landlord/dashboard';
    if (lowerCommand.includes('maintenance')) route = '/landlord/maintenances';
    else if (lowerCommand.includes('application')) route = '/landlord/applications';
    else if (lowerCommand.includes('tenant')) route = '/landlord/tenants';
    else if (lowerCommand.includes('property') || lowerCommand.includes('portfolio')) route = '/landlord/properties';
    else if (lowerCommand.includes('rent') || lowerCommand.includes('payment')) route = '/landlord/rent-collection';
    else if (lowerCommand.includes('lease')) route = '/landlord/leases';
    else if (lowerCommand.includes('report')) route = '/landlord/reports';

    return {
      action: 'navigateToPage',
      params: { route }
    };
  }

  return {
    action: null,
    params: {},
    error: 'Could not parse command'
  };
};

/**
 * Extract IDs from command using summary data
 * @param {string} command - User command
 * @param {Object} summaryData - Summary data
 * @returns {Object} - Extracted params
 */
const extractIdsFromCommand = (command, summaryData) => {
  const params = {};
  const lowerCommand = command.toLowerCase();

  // Try to find tenant
  if (summaryData?.tenants) {
    for (const tenant of summaryData.tenants) {
      if (tenant.name && lowerCommand.includes(tenant.name.toLowerCase())) {
        params.tenantId = tenant.id;
        break;
      }
    }
  }

  // Try to find application
  if (summaryData?.applications) {
    for (const app of summaryData.applications) {
      if (app.applicantName && lowerCommand.includes(app.applicantName.toLowerCase())) {
        params.applicationId = app.id;
        break;
      }
    }
  }

  // Try to find maintenance request
  if (summaryData?.maintenanceRequests) {
    for (const mr of summaryData.maintenanceRequests) {
      if (mr.title && lowerCommand.includes(mr.title.toLowerCase().substring(0, 10))) {
        params.maintenanceRequestId = mr.id;
        break;
      }
    }
  }

  return params;
};

