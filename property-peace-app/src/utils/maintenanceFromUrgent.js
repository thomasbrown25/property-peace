export function prepareMaintenanceFromUrgent(params) {
  const { urgentMessage, urgentItem } = params;
  const severityToPriority = { high: 'high', medium: 'medium', low: 'low' };
  const typeToCategory = {
    maintenance: 'appliances',
    safety: 'appliances',
    lease_violation: 'appliances',
    payment: 'appliances'
  };

  return {
    success: true,
    message: 'Opening maintenance request form',
    data: {
      action: 'openMaintenanceDrawer',
      initialValues: {
        title: urgentItem?.description || urgentMessage?.title || 'Maintenance Request',
        description: urgentItem?.messageExcerpt || urgentMessage?.aiSummary || urgentItem?.description || '',
        priority: severityToPriority[urgentItem?.severity?.toLowerCase()] || 'medium',
        category: typeToCategory[urgentItem?.type?.toLowerCase()] || 'general_repair',
        status: 'open',
        propertyName: urgentMessage?.propertyName,
        propertyId: urgentMessage?.propertyId || null,
        unitName: urgentMessage?.unitName,
        unitId: urgentMessage?.unitId || null,
        conversationId: urgentMessage?.conversationId,
        urgentItemId: urgentItem?.id,
        messageId: urgentMessage?.messageId,
        onUrgencyCleared: params?.onUrgencyCleared,
        onDashboardRefresh: params?.onDashboardRefresh,
        images: []
      }
    }
  };
}
