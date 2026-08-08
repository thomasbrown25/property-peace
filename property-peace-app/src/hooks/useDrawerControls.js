import { useState, useCallback } from 'react';

export default function useDrawerControls() {
  const [isOpenUnits, setIsOpenUnits] = useState(false);
  const [isOpenUnitAdd, setIsOpenUnitAdd] = useState(false);
  const [isOpenUnitEdit, setIsOpenUnitEdit] = useState(false);
  const [isOpenUnitDelete, setIsOpenUnitDelete] = useState(false);
  const [isOpenPropertyAdd, setIsOpenPropertyAdd] = useState(false);
  const [isOpenPropertyEdit, setIsOpenPropertyEdit] = useState(false);
  const [isOpenPropertyDelete, setIsOpenPropertyDelete] = useState(false);
  const [isOpenMaintenance, setIsOpenMaintenance] = useState(false);
  const [isOpenMaintenanceAdd, setIsOpenMaintenanceAdd] = useState(false);
  const [maintenanceAddInitialValues, setMaintenanceAddInitialValues] = useState(null);
  const [isOpenMaintenanceEdit, setIsOpenMaintenanceEdit] = useState(false);
  const [isOpenMaintenanceView, setIsOpenMaintenanceView] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState(null);
  const [isOpenTenantAdd, setIsOpenTenantAdd] = useState(false);
  const [isOpenTenantEdit, setIsOpenTenantEdit] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [isOpenLeaseEdit, setIsOpenLeaseEdit] = useState(false);
  const [isOpenLeaseAdd, setIsOpenLeaseAdd] = useState(false);
  const [leaseAddUnitId, setLeaseAddUnitId] = useState(null);
  const [leaseAddProperty, setLeaseAddProperty] = useState(null);
  const [leaseAddApplicationContext, setLeaseAddApplicationContext] = useState(null);
  const [isOpenLeaseView, setIsOpenLeaseView] = useState(false);
  const [isOpenRenewLease, setIsOpenRenewLease] = useState(false);
  const [isOpenPaymentAdd, setIsOpenPaymentAdd] = useState(false);
  const [paymentAddInitialSelection, setPaymentAddInitialSelection] = useState(null);
  const [isOpenExpenseAdd, setIsOpenExpenseAdd] = useState(false);
  const [expenseAddInitialSelection, setExpenseAddInitialSelection] = useState(null);
  const [isOpenHouseholdEdit, setIsOpenHouseholdEdit] = useState(false);
  const [isOpenApplicationAdd, setIsOpenApplicationAdd] = useState(false);
  const [isOpenApplicationInvite, setIsOpenApplicationInvite] = useState(false);
  const [isOpenPropertyAddWorkflow, setIsOpenPropertyAddWorkflow] = useState(false);
  const [isOpenListingAdd, setIsOpenListingAdd] = useState(false);
  const [selectedListingDraft, setSelectedListingDraft] = useState(null);
  const [isOpenVendorAssign, setIsOpenVendorAssign] = useState(false);
  const [selectedMaintenanceForVendor, setSelectedMaintenanceForVendor] = useState(null);
  const [onVendorAssignSuccess, setOnVendorAssignSuccess] = useState(null);
  const [isOpenScheduleInspection, setIsOpenScheduleInspection] = useState(false);
  const [scheduleInspectionPropertyId, setScheduleInspectionPropertyId] = useState(null);

  return {
    isOpenUnits,
    isOpenUnitAdd,
    isOpenUnitEdit,
    isOpenUnitDelete,
    isOpenPropertyAdd,
    isOpenPropertyEdit,
    isOpenPropertyDelete,
    isOpenMaintenance,
    isOpenMaintenanceAdd,
    isOpenMaintenanceEdit,
    isOpenMaintenanceView,
    selectedMaintenance,
    isOpenTenantAdd,
    isOpenTenantEdit,
    selectedTenant,
    selectedUnit,
    isOpenLeaseEdit,
    isOpenLeaseAdd,
    leaseAddUnitId,
    leaseAddProperty,
    leaseAddApplicationContext,
    isOpenLeaseView,
    isOpenRenewLease,
    isOpenPaymentAdd,
    paymentAddInitialSelection,
    isOpenExpenseAdd,
    expenseAddInitialSelection,
    isOpenHouseholdEdit,
    isOpenApplicationAdd,
    isOpenApplicationInvite,
    isOpenPropertyAddWorkflow,
    isOpenListingAdd,
    selectedListingDraft,
    isOpenVendorAssign,
    selectedMaintenanceForVendor,
    openUnitsDrawer: useCallback(() => setIsOpenUnits(true), []),
    closeUnitsDrawer: useCallback(() => setIsOpenUnits(false), []),
    openUnitAddDrawer: useCallback(() => setIsOpenUnitAdd(true), []),
    closeUnitAddDrawer: useCallback(() => setIsOpenUnitAdd(false), []),
    openUnitEditDrawer: useCallback((unit) => {
      setSelectedUnit(unit);
      setIsOpenUnitEdit(true);
    }, []),
    closeUnitEditDrawer: useCallback(() => {
      setIsOpenUnitEdit(false);
      setSelectedUnit(null);
    }, []),
    openUnitDeleteDrawer: useCallback(() => setIsOpenUnitDelete(true), []),
    closeUnitDeleteDrawer: useCallback(() => setIsOpenUnitDelete(false), []),
    openPropertyAddDrawer: useCallback(() => setIsOpenPropertyAdd(true), []),
    closePropertyAddDrawer: useCallback(() => setIsOpenPropertyAdd(false), []),
    openPropertyEditDrawer: useCallback(() => setIsOpenPropertyEdit(true), []),
    closePropertyEditDrawer: useCallback(() => setIsOpenPropertyEdit(false), []),
    openPropertyDeleteDrawer: useCallback(() => setIsOpenPropertyDelete(true), []),
    closePropertyDeleteDrawer: useCallback(() => setIsOpenPropertyDelete(false), []),
    openMaintenanceDrawer: useCallback(() => setIsOpenMaintenance(true), []),
    closeMaintenanceDrawer: useCallback(() => setIsOpenMaintenance(false), []),
    openMaintenanceAddDrawer: useCallback((initialValues = null) => {
      setMaintenanceAddInitialValues(initialValues);
      setIsOpenMaintenanceAdd(true);
    }, []),
    closeMaintenanceAddDrawer: useCallback(() => {
      setIsOpenMaintenanceAdd(false);
      setMaintenanceAddInitialValues(null);
    }, []),
    maintenanceAddInitialValues,
    openMaintenanceEditDrawer: useCallback((maintenance) => {
      setSelectedMaintenance(maintenance);
      setIsOpenMaintenanceEdit(true);
    }, []),
    closeMaintenanceEditDrawer: useCallback(() => {
      setIsOpenMaintenanceEdit(false);
      setSelectedMaintenance(null);
    }, []),
    openMaintenanceViewDrawer: useCallback(() => setIsOpenMaintenanceView(true), []),
    closeMaintenanceViewDrawer: useCallback(() => setIsOpenMaintenanceView(false), []),
    openTenantAddDrawer: useCallback(() => setIsOpenTenantAdd(true), []),
    closeTenantAddDrawer: useCallback(() => setIsOpenTenantAdd(false), []),
    openTenantEditDrawer: useCallback((tenant) => {
      setSelectedTenant(tenant);
      setIsOpenTenantEdit(true);
    }, []),
    closeTenantEditDrawer: useCallback(() => {
      setIsOpenTenantEdit(false);
      setSelectedTenant(null);
    }, []),
    openLeaseEditDrawer: useCallback(() => setIsOpenLeaseEdit(true), []),
    closeLeaseEditDrawer: useCallback(() => setIsOpenLeaseEdit(false), []),
    openLeaseAddDrawer: useCallback((unitId = null, property = null, applicationContext = null) => {
      setLeaseAddUnitId(unitId);
      setLeaseAddProperty(property);
      setLeaseAddApplicationContext(applicationContext);
      setIsOpenLeaseAdd(true);
    }, []),
    closeLeaseAddDrawer: useCallback(() => {
      setIsOpenLeaseAdd(false);
      setLeaseAddUnitId(null);
      setLeaseAddProperty(null);
      setLeaseAddApplicationContext(null);
    }, []),
    openLeaseViewDrawer: useCallback(() => setIsOpenLeaseView(true), []),
    closeLeaseViewDrawer: useCallback(() => setIsOpenLeaseView(false), []),
    openRenewLeaseDrawer: useCallback(() => setIsOpenRenewLease(true), []),
    closeRenewLeaseDrawer: useCallback(() => setIsOpenRenewLease(false), []),
    openPaymentAddDrawer: useCallback((initialSelection = null) => {
      setPaymentAddInitialSelection(initialSelection);
      setIsOpenPaymentAdd(true);
    }, []),
    closePaymentAddDrawer: useCallback(() => {
      setIsOpenPaymentAdd(false);
      setPaymentAddInitialSelection(null);
    }, []),
    openExpenseAddDrawer: useCallback((initialSelection = null) => {
      setExpenseAddInitialSelection(initialSelection);
      setIsOpenExpenseAdd(true);
    }, []),
    closeExpenseAddDrawer: useCallback(() => {
      setIsOpenExpenseAdd(false);
      setExpenseAddInitialSelection(null);
    }, []),
    openHouseholdEditDrawer: useCallback(() => setIsOpenHouseholdEdit(true), []),
    closeHouseholdEditDrawer: useCallback(() => setIsOpenHouseholdEdit(false), []),
    openApplicationAddDrawer: useCallback(() => setIsOpenApplicationAdd(true), []),
    closeApplicationAddDrawer: useCallback(() => setIsOpenApplicationAdd(false), []),
    openApplicationInviteDrawer: useCallback(() => setIsOpenApplicationInvite(true), []),
    closeApplicationInviteDrawer: useCallback(() => setIsOpenApplicationInvite(false), []),
    openPropertyAddWorkflowDrawer: useCallback(() => setIsOpenPropertyAddWorkflow(true), []),
    closePropertyAddWorkflowDrawer: useCallback(() => setIsOpenPropertyAddWorkflow(false), []),
    openListingAddDrawer: useCallback((draft = null) => {
      setSelectedListingDraft(draft);
      setIsOpenListingAdd(true);
    }, []),
    closeListingAddDrawer: useCallback(() => {
      setIsOpenListingAdd(false);
      setSelectedListingDraft(null);
    }, []),
    openVendorAssignDrawer: useCallback((maintenance, onSuccess = null) => {
      setSelectedMaintenanceForVendor(maintenance);
      setOnVendorAssignSuccess(() => onSuccess);
      setIsOpenVendorAssign(true);
    }, []),
    closeVendorAssignDrawer: useCallback(() => {
      setIsOpenVendorAssign(false);
      setSelectedMaintenanceForVendor(null);
      setOnVendorAssignSuccess(null);
    }, []),
    onVendorAssignSuccess,
    isOpenScheduleInspection,
    scheduleInspectionPropertyId,
    openScheduleInspectionDrawer: useCallback((propertyId) => {
      setScheduleInspectionPropertyId(propertyId);
      setIsOpenScheduleInspection(true);
    }, []),
    closeScheduleInspectionDrawer: useCallback(() => {
      setIsOpenScheduleInspection(false);
      setScheduleInspectionPropertyId(null);
    }, [])
  };
}
