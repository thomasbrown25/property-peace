export type ChecklistHomeParams = {
  propertyId: string;
  propertyName: string;
  propertyType?: string;
  unitId?: string;
  unitName?: string;
};

export type ChecklistsStackParamList = {
  ChecklistPropertySearch: { preselectedPropertyId?: string } | undefined;
  PropertyChecklists: ChecklistHomeParams;
  ChecklistEditor: ChecklistHomeParams & { checklistId: string };
};
