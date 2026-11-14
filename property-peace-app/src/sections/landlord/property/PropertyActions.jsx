import { useState } from 'react';
import { Button, Divider, Menu, MenuItem } from '@mui/material';

import {
  ThunderboltOutlined, EditOutlined, FileAddOutlined, FileTextOutlined,
  DollarOutlined, ToolOutlined, UploadOutlined, DeleteOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDrawer } from 'contexts/DrawerContext';
import { isDetachedSingleUnitType } from 'utils/propertyType';
import { rentalMode } from 'utils/rentalMode';

const actionButtonSx = {
  textTransform: 'none',
  whiteSpace: 'nowrap'
};

export default function PropertyActions({ property, onEdit, onDelete }) {
  const navigate = useNavigate();
  const drawer = useDrawer();
  const [actionsAnchor, setActionsAnchor] = useState(null);
  const propertyId = property?.id ?? property?.Id;
  const units = property?.units ?? property?.Units ?? [];
  const hasLongTermUnits = units.some((unit) => rentalMode(unit) !== 'shortTerm');
  const canCreateLease = hasLongTermUnits || (units.length === 0 && isDetachedSingleUnitType(property?.propertyType));
  const runAction = (action) => {
    setActionsAnchor(null);
    action();
  };

  return (
    <>
      <Button
        variant="contained"
        startIcon={<ThunderboltOutlined />}
        onClick={(event) => setActionsAnchor(event.currentTarget)}
        aria-haspopup="menu"
        aria-controls={actionsAnchor ? 'property-actions-menu' : undefined}
        aria-expanded={Boolean(actionsAnchor)}
        sx={actionButtonSx}
      >
        Actions
      </Button>
      <Menu
        id="property-actions-menu"
        anchorEl={actionsAnchor}
        open={Boolean(actionsAnchor)}
        onClose={() => setActionsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={() => runAction(() => onEdit?.(property))}>
          <EditOutlined style={{ marginRight: 12 }} /> Edit property
        </MenuItem>
        <MenuItem disabled={!canCreateLease} onClick={() => runAction(() => drawer.openLeaseAddDrawer(null, property))}>
          <FileAddOutlined style={{ marginRight: 12 }} /> Create a lease
        </MenuItem>
        <MenuItem onClick={() => runAction(() => navigate('/landlord/leases'))}>
          <FileTextOutlined style={{ marginRight: 12 }} /> View leases
        </MenuItem>
        <MenuItem disabled={!hasLongTermUnits} onClick={() => runAction(() => drawer.openPaymentAddDrawer({ property: property || { id: propertyId } }))}>
          <DollarOutlined style={{ marginRight: 12 }} /> Record a payment
        </MenuItem>
        <MenuItem onClick={() => runAction(() => drawer.openMaintenanceAddDrawer({ propertyId, propertyName: property?.name }))}>
          <ToolOutlined style={{ marginRight: 12 }} /> Create maintenance ticket
        </MenuItem>
        <MenuItem onClick={() => runAction(() => navigate('/landlord/documents'))}>
          <UploadOutlined style={{ marginRight: 12 }} /> Upload document
        </MenuItem>
        <Divider />
        <MenuItem sx={{ color: 'error.main' }} onClick={() => runAction(() => onDelete?.())}>
          <DeleteOutlined style={{ marginRight: 12 }} /> Delete property
        </MenuItem>
      </Menu>
    </>
  );
}
