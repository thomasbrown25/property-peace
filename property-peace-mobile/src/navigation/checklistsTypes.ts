export type ChecklistHomeParams = {
  propertyId: string;
  propertyName: string;
  propertyType?: string;
  unitId?: string;
  unitName?: string;
  leaseId?: string;
};

export type ChecklistsStackParamList = {
  ChecklistPropertySearch: { preselectedPropertyId?: string } | undefined;
  PropertyChecklists: ChecklistHomeParams & { propertyWide?: boolean };
  ChecklistEditor: ChecklistHomeParams & { checklistId: string };
  LeaseTransitionChecklist: ChecklistHomeParams & { transitionChecklistId: string };
};
