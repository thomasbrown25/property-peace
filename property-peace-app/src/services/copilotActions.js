import axiosServices from 'utils/axios';
import { useNavigate } from 'react-router-dom';
import { aiFollowUpAPI } from 'api';

/**
 * Action handler service for AI Copilot actions
 */

/**
 * Resend tenant invite
 * @param {number} inviteId - Invite ID
 * @returns {Promise<Object>} - Success/error response
 */
export const resendTenantInvite = async (inviteId) => {
  try {
    const response = await axiosServices.post(`/api/tenantinvite/${inviteId}/resend`);
    return {
      success: true,
      message: 'Invite resent successfully',
      data: response.data
    };
  } catch (error) {
    console.error('Error resending invite:', error);
    return {
      success: false,
      message: error?.response?.data?.message || 'Failed to resend invite',
      error: error
    };
  }
};

/**
 * Send payment reminder to a tenant
 * @param {number} tenantId - Tenant ID (optional, used for lookup if leaseId not provided)
 * @param {number} leaseId - Lease ID (required for the API endpoint)
 * @param {string} propertyName - Property name (optional, used for lookup if leaseId not provided)
 * @param {string} tenantName - Tenant name (optional, used for lookup if leaseId not provided)
 * @returns {Promise<Object>} - Success/error response
 */
export const sendPaymentReminder = async (tenantId, leaseId, propertyName, tenantName) => {
  try {
    // If leaseId is not provided, try to find it using available information
    if (!leaseId) {
      // Fetch rent collection data to find the lease
      const rentResponse = await axiosServices.get('/api/rent-collection', { params: { lifetime: true } });
      if (rentResponse.data?.success && rentResponse.data?.data?.leases) {
        const leases = rentResponse.data.data.leases || [];
        let foundLease = null;

        // Priority 1: Find by tenantId if provided
        if (tenantId) {
          foundLease = leases.find(lease => 
            lease.tenants?.some(tenant => tenant.id === tenantId)
          );
        }

        // Priority 2: Find by property name if provided
        if (!foundLease && propertyName) {
          const propertyNameLower = propertyName.toLowerCase();
          foundLease = leases.find(lease => 
            lease.propertyName?.toLowerCase().includes(propertyNameLower) ||
            propertyNameLower.includes(lease.propertyName?.toLowerCase() || '') ||
            lease.unitName?.toLowerCase().includes(propertyNameLower) ||
            propertyNameLower.includes(lease.unitName?.toLowerCase() || '')
          );
        }

        // Priority 3: Find by tenant name if provided
        if (!foundLease && tenantName) {
          const tenantNameLower = tenantName.toLowerCase();
          foundLease = leases.find(lease => 
            lease.tenants?.some(tenant => {
              const fullName = `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim().toLowerCase();
              return fullName.includes(tenantNameLower) || tenantNameLower.includes(fullName);
            })
          );
        }

        if (foundLease?.id) {
          leaseId = foundLease.id;
        }
      }

      // If still not found, try using global search API
      if (!leaseId && (propertyName || tenantName)) {
        const searchQuery = propertyName || tenantName;
        try {
          const searchResponse = await axiosServices.get(`/api/search/global?query=${encodeURIComponent(searchQuery)}&maxResults=10`);
          if (searchResponse.data?.success && searchResponse.data?.data) {
            const searchData = searchResponse.data.data;
            
            // Try to find lease from search results
            if (searchData.leases && searchData.leases.length > 0) {
              // If property name was provided, match by property name
              if (propertyName) {
                const propertyNameLower = propertyName.toLowerCase();
                const matchingLease = searchData.leases.find(lease =>
                  lease.propertyName?.toLowerCase().includes(propertyNameLower) ||
                  propertyNameLower.includes(lease.propertyName?.toLowerCase() || '')
                );
                if (matchingLease?.id) {
                  leaseId = matchingLease.id;
                } else if (searchData.leases.length === 1) {
                  // If only one result, use it
                  leaseId = searchData.leases[0].id;
                }
              } else if (tenantName && searchData.leases.length > 0) {
                // If tenant name was provided, try to match by tenant names in lease
                const tenantNameLower = tenantName.toLowerCase();
                const matchingLease = searchData.leases.find(lease =>
                  lease.tenantNames?.some(name =>
                    name?.toLowerCase().includes(tenantNameLower) ||
                    tenantNameLower.includes(name?.toLowerCase() || '')
                  )
                );
                if (matchingLease?.id) {
                  leaseId = matchingLease.id;
                } else if (searchData.leases.length === 1) {
                  leaseId = searchData.leases[0].id;
                }
              }
            }
          }
        } catch (searchError) {
          console.warn('Error using global search for lease lookup:', searchError);
          // Continue without search results
        }
      }
    }

    if (!leaseId) {
      return {
        success: false,
        message: `Could not find a lease for "${propertyName || tenantName || 'the specified entity'}". Please be more specific (e.g., "send payment reminder to [property name]" or "send payment reminder to [tenant name]").`
      };
    }

    // Use the correct endpoint: /api/rent-collection/send-reminder/{leaseId}
    const response = await axiosServices.post(`/api/rent-collection/send-reminder/${leaseId}`);
    return {
      success: true,
      message: response.data?.message || 'Payment reminder sent successfully',
      data: response.data
    };
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    return {
      success: false,
      message: error?.response?.data?.message || 'Failed to send payment reminder',
      error: error
    };
  }
};

/**
 * Send rent reminder for a lease (same as rent collection page)
 * @param {number} leaseId - Lease ID
 * @returns {Promise<Object>} - Success/error response
 */
export const sendRentReminder = async (leaseId) => {
  try {
    const response = await axiosServices.post(`/api/rent-collection/send-reminder/${leaseId}`);
    return {
      success: true,
      message: response.data?.message || 'Rent reminder sent successfully',
      data: response.data
    };
  } catch (error) {
    console.error('Error sending rent reminder:', error);
    return {
      success: false,
      message: error?.response?.data?.message || 'Failed to send rent reminder',
      error: error
    };
  }
};

/**
 * Approve application
 * @param {number} applicationId - Application ID
 * @returns {Promise<Object>} - Success/error response
 */
export const approveApplication = async (applicationId) => {
  try {
    const response = await axiosServices.put(`/api/application/${applicationId}/approve`);
    return {
      success: true,
      message: 'Application approved successfully',
      data: response.data
    };
  } catch (error) {
    console.error('Error approving application:', error);
    return {
      success: false,
      message: error?.response?.data?.message || 'Failed to approve application',
      error: error
    };
  }
};

/**
 * Create work order from maintenance request
 * @param {number} maintenanceRequestId - Maintenance request ID
 * @returns {Promise<Object>} - Success/error response
 */
export const createWorkOrder = async (maintenanceRequestId) => {
  try {
    // Note: This endpoint may need to be created on the backend
    const response = await axiosServices.post(`/api/maintenance-request/${maintenanceRequestId}/create-work-order`);
    return {
      success: true,
      message: 'Work order created successfully',
      data: response.data
    };
  } catch (error) {
    console.error('Error creating work order:', error);
    return {
      success: false,
      message: error?.response?.data?.message || 'Failed to create work order',
      error: error
    };
  }
};

/**
 * Send lease renewal notice
 * @param {number} leaseId - Lease ID
 * @returns {Promise<Object>} - Success/error response
 */
export const sendLeaseRenewalNotice = async (leaseId) => {
  try {
    // Note: This endpoint may need to be created on the backend
    const response = await axiosServices.post(`/api/lease/${leaseId}/send-renewal-notice`);
    return {
      success: true,
      message: 'Lease renewal notice sent successfully',
      data: response.data
    };
  } catch (error) {
    console.error('Error sending lease renewal notice:', error);
    return {
      success: false,
      message: error?.response?.data?.message || 'Failed to send lease renewal notice',
      error: error
    };
  }
};

/**
 * View a specific maintenance request
 * @param {number} maintenanceRequestId - Maintenance request ID
 * @param {Function} navigate - React Router navigate function
 * @returns {Promise<Object>} - Success response
 */
export const viewMaintenanceRequest = async (maintenanceRequestId, navigate) => {
  try {
    if (navigate && typeof navigate === 'function') {
      navigate(`/landlord/maintenance/${maintenanceRequestId}`);
      return {
        success: true,
        message: 'Navigated to maintenance request',
        data: { maintenanceRequestId }
      };
    } else {
      window.location.href = `/landlord/maintenance/${maintenanceRequestId}`;
      return {
        success: true,
        message: 'Navigated to maintenance request',
        data: { maintenanceRequestId }
      };
    }
  } catch (error) {
    console.error('Error navigating to maintenance request:', error);
    return {
      success: false,
      message: 'Failed to navigate',
      error: error
    };
  }
};

/**
 * View a specific application
 * @param {number} applicationId - Application ID
 * @param {Function} navigate - React Router navigate function
 * @returns {Promise<Object>} - Success response
 */
export const viewApplication = async (applicationId, navigate) => {
  try {
    if (navigate && typeof navigate === 'function') {
      // Navigate to applications page - applications page should handle showing specific application
      navigate(`/landlord/applications?applicationId=${applicationId}`);
      return {
        success: true,
        message: 'Navigated to application',
        data: { applicationId }
      };
    } else {
      window.location.href = `/landlord/applications?applicationId=${applicationId}`;
      return {
        success: true,
        message: 'Navigated to application',
        data: { applicationId }
      };
    }
  } catch (error) {
    console.error('Error navigating to application:', error);
    return {
      success: false,
      message: 'Failed to navigate',
      error: error
    };
  }
};

/**
 * Navigate to a page
 * @param {string} route - Route path
 * @param {Function} navigate - React Router navigate function
 * @returns {Promise<Object>} - Success response
 */
export const navigateToPage = async (route, navigate) => {
  try {
    if (navigate && typeof navigate === 'function') {
      navigate(route);
      return {
        success: true,
        message: `Navigated to ${route}`,
        data: { route }
      };
    } else {
      // Fallback to window.location if navigate not available
      window.location.href = route;
      return {
        success: true,
        message: `Navigated to ${route}`,
        data: { route }
      };
    }
  } catch (error) {
    console.error('Error navigating:', error);
    return {
      success: false,
      message: 'Failed to navigate',
      error: error
    };
  }
};

/**
 * Show data query results
 * @param {string} dataType - Type of data to show
 * @param {Object} params - Additional parameters (propertyName, leaseId, reportType, summaryData)
 * @returns {Promise<Object>} - Success/error response with formatted data
 */
export const showData = async (dataType, params = {}) => {
  try {
    let response;
    let formattedData = null;

    switch (dataType) {
      case 'organizations':
      case 'teams':
        response = await axiosServices.get('/api/organization/user/list');
        if (response.data?.success && response.data?.data) {
          const orgs = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
          formattedData = {
            type: 'organizations',
            title: 'Your Organizations / Teams',
            items: orgs.map(org => ({
              id: org.id,
              name: org.name || 'Unnamed Organization',
              role: org.role || 'Member',
              memberCount: org.memberCount || 0
            }))
          };
        }
        break;

      case 'properties':
        response = await axiosServices.get('/api/property/list');
        if (response.data?.data) {
          const properties = Array.isArray(response.data.data) ? response.data.data : [];
          formattedData = {
            type: 'properties',
            title: 'Your Properties',
            items: properties.map(prop => ({
              id: prop.id,
              name: prop.name || 'Unnamed Property',
              address: prop.streetAddress || 'No address',
              unitCount: prop.units?.length || 0,
              occupancyRate: prop.units?.length > 0
                ? ((prop.units.filter(u => u.isOccupied).length / prop.units.length) * 100).toFixed(1) + '%'
                : '0%'
            }))
          };
        }
        break;

      case 'tenants':
        // Fetch tenants from leases
        response = await axiosServices.get('/api/rent-collection', { params: { lifetime: true } });
        if (response.data?.success && response.data?.data?.leases) {
          const leases = response.data.data.leases || [];
          const tenantsMap = new Map();
          leases.forEach(lease => {
            if (lease.tenants && Array.isArray(lease.tenants)) {
              lease.tenants.forEach(tenant => {
                if (!tenantsMap.has(tenant.id)) {
                  tenantsMap.set(tenant.id, {
                    id: tenant.id,
                    name: `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim() || 'Unknown',
                    email: tenant.email || 'No email',
                    propertyName: lease.propertyName || 'Unknown',
                    unitName: lease.unitName || '',
                    paymentStatus: lease.paymentStatus || 'Unknown'
                  });
                }
              });
            }
          });
          formattedData = {
            type: 'tenants',
            title: 'Your Tenants',
            items: Array.from(tenantsMap.values())
          };
        }
        break;

      case 'applications':
        // Get applications from organization summary if available, otherwise try to get from summaryData
        // Applications are already in the summary data from the AI Copilot
        if (params.summaryData?.applications) {
          const applications = params.summaryData.applications;
          formattedData = {
            type: 'applications',
            title: 'Your Applications',
            items: applications.map(app => ({
              id: app.id,
              applicantName: app.applicantName || 'Unknown',
              propertyName: app.propertyName || 'Unknown',
              unitName: app.unitName || '',
              status: app.status || 'Unknown',
              submittedAt: app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'Unknown',
              daysPending: app.daysPending || 0
            }))
          };
        } else {
          // Fallback: try to get from organization summary endpoint
          const summaryResponse = await axiosServices.get('/api/ai-copilot/organization-summary');
          if (summaryResponse.data?.success && summaryResponse.data?.data?.applications) {
            const applications = summaryResponse.data.data.applications;
            formattedData = {
              type: 'applications',
              title: 'Your Applications',
              items: applications.map(app => ({
                id: app.id,
                applicantName: app.applicantName || 'Unknown',
                propertyName: app.propertyName || 'Unknown',
                unitName: app.unitName || '',
                status: app.status || 'Unknown',
                submittedAt: app.submittedAt ? new Date(app.submittedAt).toLocaleDateString() : 'Unknown',
                daysPending: app.daysPending || 0
              }))
            };
          }
        }
        break;

      case 'leases':
        response = await axiosServices.get('/api/rent-collection', { params: { lifetime: true } });
        if (response.data?.success && response.data?.data?.leases) {
          const leases = response.data.data.leases || [];
          formattedData = {
            type: 'leases',
            title: 'Your Leases',
            items: leases.map(lease => ({
              id: lease.id,
              propertyName: lease.propertyName || 'Unknown',
              unitName: lease.unitName || '',
              tenantNames: lease.tenants?.map(t => `${t.firstname || ''} ${t.lastname || ''}`.trim()).filter(Boolean).join(', ') || 'No tenants',
              rentAmount: lease.rentAmount ? `$${lease.rentAmount.toFixed(2)}` : 'N/A',
              startDate: lease.startDate ? new Date(lease.startDate).toLocaleDateString() : 'Unknown',
              endDate: lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'Ongoing',
              isActive: lease.isActive ? 'Active' : 'Inactive'
            }))
          };
        }
        break;

      case 'rentCollection':
        response = await axiosServices.get('/api/rent-collection');
        if (response.data?.success && response.data?.data) {
          const data = response.data.data;
          formattedData = {
            type: 'rentCollection',
            title: 'Rent Collection Summary',
            summary: {
              totalExpected: data.totalExpected ? `$${data.totalExpected.toFixed(2)}` : '$0.00',
              totalCollected: data.totalCollected ? `$${data.totalCollected.toFixed(2)}` : '$0.00',
              overdueCount: data.overdue?.length || 0,
              dueSoonCount: data.dueSoon?.length || 0
            },
            overdue: data.overdue || [],
            dueSoon: data.dueSoon || []
          };
        }
        break;

      case 'payments':
        if (params.leaseId) {
          response = await axiosServices.get(`/api/payment/${params.leaseId}`);
          if (response.data?.data) {
            const payments = Array.isArray(response.data.data) ? response.data.data : [response.data.data];
            formattedData = {
              type: 'payments',
              title: `Payments for Lease ${params.leaseId}`,
              items: payments.map(payment => ({
                id: payment.id,
                amount: payment.amount ? `$${payment.amount.toFixed(2)}` : 'N/A',
                paymentDate: payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString() : 'Unknown',
                method: payment.paymentMethod || 'Unknown',
                status: payment.status || 'Unknown'
              }))
            };
          }
        } else {
          return {
            success: false,
            message: 'Please specify a lease ID or property name for payments query'
          };
        }
        break;

      case 'tenantLookup':
        if (params.propertyName) {
          // First get properties to find the property ID
          const propResponse = await axiosServices.get('/api/property/list');
          if (propResponse.data?.data) {
            const properties = Array.isArray(propResponse.data.data) ? propResponse.data.data : [];
            const property = properties.find(p => 
              p.name?.toLowerCase().includes(params.propertyName.toLowerCase()) ||
              p.streetAddress?.toLowerCase().includes(params.propertyName.toLowerCase())
            );
            
            if (property) {
              // Get rent collection for this property
              const rentResponse = await axiosServices.get('/api/rent-collection', {
                params: { propertyId: property.id, lifetime: true }
              });
              if (rentResponse.data?.success && rentResponse.data?.data?.leases) {
                const leases = rentResponse.data.data.leases || [];
                const tenants = [];
                leases.forEach(lease => {
                  if (lease.tenants && Array.isArray(lease.tenants)) {
                    lease.tenants.forEach(tenant => {
                      tenants.push({
                        id: tenant.id,
                        name: `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim() || 'Unknown',
                        email: tenant.email || 'No email',
                        unitName: lease.unitName || '',
                        leaseId: lease.id
                      });
                    });
                  }
                });
                formattedData = {
                  type: 'tenantLookup',
                  title: `Tenants for ${property.name || params.propertyName}`,
                  propertyName: property.name,
                  items: tenants
                };
              }
            } else {
              return {
                success: false,
                message: `Property "${params.propertyName}" not found`
              };
            }
          }
        } else {
          return {
            success: false,
            message: 'Please specify a property name for tenant lookup'
          };
        }
        break;

      case 'reports':
        // For reports, we'll provide a summary of available reports
        formattedData = {
          type: 'reports',
          title: 'Available Reports',
          items: [
            { name: 'Expense Reports', route: '/landlord/reports?type=expense' },
            { name: 'Tax Reports', route: '/landlord/reports?type=tax' },
            { name: 'Analytics', route: '/landlord/reports?type=analytics' },
            { name: 'Occupancy Reports', route: '/landlord/reports?type=occupancy' }
          ],
          message: 'You can view detailed reports by navigating to the Reports page.'
        };
        break;

      default:
        return {
          success: false,
          message: `Unknown data type: ${dataType}`
        };
    }

    if (formattedData) {
      return {
        success: true,
        message: `Retrieved ${formattedData.title}`,
        data: formattedData
      };
    } else {
      return {
        success: false,
        message: 'No data found or failed to fetch data'
      };
    }
  } catch (error) {
    console.error('Error fetching data:', error);
    return {
      success: false,
      message: error?.response?.data?.message || `Failed to fetch ${dataType} data`,
      error: error
    };
  }
};

/**
 * Navigate to a specific item (lease, property, etc.) by name
 * @param {Object} params - Parameters with dataType and propertyName/leaseId
 * @param {Function} navigate - React Router navigate function
 * @param {Object} summaryData - Organization summary data for context
 * @returns {Promise<Object>} - Success/error response
 */
export const navigateToSpecificItem = async (params, navigate, summaryData) => {
  try {
    const { dataType, propertyName, leaseId } = params;

    if (dataType === 'navigateToLease' && propertyName) {
      // Find lease by property name
      if (summaryData?.rentStatus) {
        const allLeases = [
          ...(summaryData.rentStatus.overdue || []),
          ...(summaryData.rentStatus.dueSoon || [])
        ];
        const matchingLease = allLeases.find(l => 
          l.propertyName?.toLowerCase().includes(propertyName.toLowerCase()) ||
          propertyName.toLowerCase().includes(l.propertyName?.toLowerCase())
        );
        if (matchingLease?.leaseId) {
          navigate(`/landlord/leases/${matchingLease.leaseId}`);
          return {
            success: true,
            message: `Navigated to lease for ${matchingLease.propertyName}`
          };
        }
      }
      
      // Fallback: try to get from rent collection API
      const rentResponse = await axiosServices.get('/api/rent-collection', { params: { lifetime: true } });
      if (rentResponse.data?.success && rentResponse.data?.data?.leases) {
        const leases = rentResponse.data.data.leases || [];
        const matchingLease = leases.find(l => 
          l.propertyName?.toLowerCase().includes(propertyName.toLowerCase()) ||
          propertyName.toLowerCase().includes(l.propertyName?.toLowerCase())
        );
        if (matchingLease?.id) {
          navigate(`/landlord/leases/${matchingLease.id}`);
          return {
            success: true,
            message: `Navigated to lease for ${matchingLease.propertyName}`
          };
        }
      }
      
      return {
        success: false,
        message: `Could not find lease for property "${propertyName}"`
      };
    }

    if (dataType === 'navigateToProperty' && propertyName) {
      // Find property by name
      const propResponse = await axiosServices.get('/api/property/list');
      if (propResponse.data?.data) {
        const properties = Array.isArray(propResponse.data.data) ? propResponse.data.data : [];
        const matchingProperty = properties.find(p => 
          p.name?.toLowerCase().includes(propertyName.toLowerCase()) ||
          p.streetAddress?.toLowerCase().includes(propertyName.toLowerCase()) ||
          propertyName.toLowerCase().includes(p.name?.toLowerCase())
        );
        if (matchingProperty?.id) {
          navigate(`/landlord/property/${matchingProperty.id}`);
          return {
            success: true,
            message: `Navigated to ${matchingProperty.name}`
          };
        }
      }
      
      return {
        success: false,
        message: `Could not find property "${propertyName}"`
      };
    }

    return {
      success: false,
      message: 'Invalid navigation parameters'
    };
  } catch (error) {
    console.error('Error navigating to specific item:', error);
    return {
      success: false,
      message: 'Failed to navigate',
      error: error
    };
  }
};

/**
 * Create maintenance request from urgent message
 * This returns a special result that the component should handle by opening the drawer
 * @param {Object} params - Parameters with urgent message data, optional refresh callback, and optional dashboard refresh callback
 * @returns {Promise<Object>} - Success response with drawer action
 */
export const createMaintenanceFromUrgent = async (params) => {
  try {
    const { urgentMessage, urgentItem } = params;
    
    // Map severity to priority
    const severityToPriority = {
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };
    
    // Map type to category
    const typeToCategory = {
      'maintenance': 'appliances',
      'safety': 'appliances',
      'lease_violation': 'appliances',
      'payment': 'appliances'
    };
    
    // Build initial values for the maintenance drawer
    const initialValues = {
      title: urgentItem?.description || urgentMessage?.title || 'Maintenance Request',
      description: urgentItem?.messageExcerpt || urgentMessage?.aiSummary || urgentItem?.description || '',
      priority: severityToPriority[urgentItem?.severity?.toLowerCase()] || 'medium',
      category: typeToCategory[urgentItem?.type?.toLowerCase()] || 'general_repair',
      status: 'open',
      propertyName: urgentMessage?.propertyName,
      propertyId: urgentMessage?.propertyId || null, // Use propertyId from urgent message if available
      unitName: urgentMessage?.unitName,
      unitId: urgentMessage?.unitId || null, // Will be resolved by the drawer if not provided
      conversationId: urgentMessage?.conversationId, // Store conversation ID to clear urgency after creation
      urgentItemId: urgentItem?.id, // Store urgent item ID to clear only this specific item
      messageId: urgentMessage?.messageId, // Store message ID to create suppression record
      onUrgencyCleared: params?.onUrgencyCleared, // Optional callback to refresh summary after clearing urgency
      onDashboardRefresh: params?.onDashboardRefresh, // Optional callback to refresh dashboard after creation
      images: []
    };
    
    return {
      success: true,
      message: 'Opening maintenance request form',
      data: {
        action: 'openMaintenanceDrawer',
        initialValues
      }
    };
  } catch (error) {
    console.error('Error creating maintenance from urgent:', error);
    return {
      success: false,
      message: 'Failed to prepare maintenance request',
      error: error
    };
  }
};

/**
 * Send AI follow-up message to tenant
 * @param {string} actionType - Type of follow-up action (e.g., 'sendAIFollowUp_OverdueRent')
 * @param {number} entityId - ID of the entity (leaseId, tenantId, etc.)
 * @param {Object} context - Optional context data
 * @returns {Promise<Object>} - Success/error response
 */
export const sendAIFollowUpAction = async (actionType, entityId, context = null, overrides = null) => {
  try {
    const response = await aiFollowUpAPI.sendAIFollowUp(actionType, entityId, context, overrides);
    if (response?.success) {
      return {
        success: true,
        message: response.message || 'AI follow-up sent successfully',
        data: response.data
      };
    }
    return {
      success: false,
      message: response?.message || 'Failed to send AI follow-up',
      error: response
    };
  } catch (error) {
    console.error('Error sending AI follow-up:', error);
    return {
      success: false,
      message: error?.response?.data?.message || 'Failed to send AI follow-up',
      error: error
    };
  }
};

/**
 * Execute an action based on action object
 * @param {Object} action - Action object with type and params
 * @param {Function} navigate - React Router navigate function
 * @param {Object} summaryData - Optional summary data for context
 * @param {Function} openDrawer - Optional drawer opener function
 * @param {Function} onUrgencyCleared - Optional callback to refresh summary after clearing urgency
 * @param {Function} onDashboardRefresh - Optional callback to refresh dashboard after maintenance creation
 * @returns {Promise<Object>} - Success/error response
 */
export const executeAction = async (action, navigate, summaryData = null, openDrawer = null, onUrgencyCleared = null, onDashboardRefresh = null) => {
  if (!action || !action.action) {
    return {
      success: false,
      message: 'Invalid action'
    };
  }

  const { action: actionType, params } = action;

  try {
    switch (actionType) {
      case 'resendInvite':
        return await resendTenantInvite(params?.inviteId || params?.applicationId);
      
      case 'sendPaymentReminder':
        return await sendPaymentReminder(
          params?.tenantId, 
          params?.leaseId, 
          params?.propertyName, 
          params?.tenantName
        );
      case 'sendRentReminder':
        return await sendRentReminder(params?.leaseId);
      
      case 'approveApplication':
        return await approveApplication(params?.applicationId);
      
      case 'createWorkOrder':
        return await createWorkOrder(params?.maintenanceRequestId);
      
      case 'sendLeaseRenewalNotice':
        return await sendLeaseRenewalNotice(params?.leaseId);
      
      case 'viewMaintenanceRequest':
        return await viewMaintenanceRequest(params?.maintenanceRequestId, navigate);
      
      case 'viewApplication':
        return await viewApplication(params?.applicationId, navigate);
      
      case 'navigateToPage':
        return await navigateToPage(params?.route, navigate);
      
      case 'navigateToSpecificItem':
        return await navigateToSpecificItem(params, navigate, summaryData || action.summaryData);
      
      case 'showData':
        return await showData(params?.dataType, params);
      
      case 'createMaintenanceFromUrgent':
        // Add refetch and dashboard refresh callbacks to params if provided
        const maintenanceParams = {
          ...params,
          ...(onUrgencyCleared && { onUrgencyCleared }),
          ...(onDashboardRefresh && { onDashboardRefresh })
        };
        const maintenanceResult = await createMaintenanceFromUrgent(maintenanceParams);
        // If we have a drawer opener and the result indicates to open drawer, do it
        if (maintenanceResult.success && maintenanceResult.data?.action === 'openMaintenanceDrawer' && openDrawer) {
          openDrawer(maintenanceResult.data.initialValues);
        }
        return maintenanceResult;
      
      case 'sendAIFollowUp':
        return await sendAIFollowUpAction(params?.actionType, params?.entityId, params?.context);
      
      default:
        return {
          success: false,
          message: `Unknown action: ${actionType}`
        };
    }
  } catch (error) {
    console.error(`Error executing action ${actionType}:`, error);
    return {
      success: false,
      message: `Failed to execute ${actionType}`,
      error: error
    };
  }
};

