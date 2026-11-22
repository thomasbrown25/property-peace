import ActionsDrawer from 'components/drawers/shared/ActionsDrawer';
import { useDrawer } from 'contexts/DrawerContext';
import { isDetachedSingleUnitType } from 'utils/propertyType';
import { rentalMode } from 'utils/rentalMode';

export default function PropertyActions({ property, onEdit, onViewLeases, onUploadDocument, onDelete }) {
  const drawer = useDrawer();
  const propertyId = property?.id ?? property?.Id;
  const units = property?.units ?? property?.Units ?? [];
  const hasLongTermUnits = units.some((unit) => rentalMode(unit) !== 'shortTerm');
  const canCreateLease = hasLongTermUnits || (units.length === 0 && isDetachedSingleUnitType(property?.propertyType));

  const actions = [
    {
      label: 'Edit property',
      description: 'Update the name, address, and other property details.',
      icon: 'edit',
      onSelect: () => onEdit?.(property)
    },
    {
      label: 'Create a lease',
      description: 'Set up a new lease for a long-term rental.',
      icon: 'leaseAdd',
      disabled: !canCreateLease,
      onSelect: () => drawer.openLeaseAddDrawer(null, property)
    },
    {
      label: 'View leases',
      description: 'Browse current and past leases.',
      icon: 'leases',
      onSelect: onViewLeases
    },
    {
      label: 'Record a payment',
      description: 'Log a payment for a long-term rental.',
      icon: 'dollarCircle',
      disabled: !hasLongTermUnits,
      onSelect: () => drawer.openPaymentAddDrawer({ property: property || { id: propertyId } })
    },
    {
      label: 'Create a maintenance ticket',
      description: 'Report a repair or maintenance issue at this property.',
      icon: 'maintenance',
      onSelect: () => drawer.openMaintenanceAddDrawer({ propertyId, propertyName: property?.name })
    },
    {
      label: 'Upload a document',
      description: 'Attach a file to this property.',
      icon: 'uploadDocument',
      onSelect: onUploadDocument
    },
    {
      label: 'Delete property',
      description: 'Review what will be deleted before confirming.',
      icon: 'trash',
      destructive: true,
      onSelect: () => onDelete?.()
    }
  ];

  return <ActionsDrawer id="property-actions-drawer" title="Property actions" actions={actions} />;
}
