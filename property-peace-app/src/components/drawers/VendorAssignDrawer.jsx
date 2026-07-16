import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
  alpha,
  useTheme
} from '@mui/material';
import { CloseOutlined, UserOutlined, MailOutlined, PhoneOutlined, TagOutlined, TeamOutlined } from '@ant-design/icons';
import { useDrawer } from 'contexts/DrawerContext';
import { useOrganization } from 'contexts/OrganizationContext';
import { updateMaintenance } from 'store/maintenance/maintenance.action';
import { openSnackbar } from 'api/snackbar';
import { getPriorityColor, getStatusColor } from 'utils/helper-methods';
import { Chip } from '@mui/material';
import { selectVendors } from 'store/vendor/vendor.selector';
import { getVendors } from 'store/vendor/vendor.action';
import { organizationMemberAPI } from 'api';
import useAuth from 'hooks/useAuth';

const ASSIGNED_TYPE = { Unassigned: 0, Self: 1, Vendor: 2, OneTimeContact: 3, OrganizationMember: 4 };

export default function VendorAssignDrawer() {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const vendors = useSelector(selectVendors);

  const maintenance = drawer.selectedMaintenanceForVendor;
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selected, setSelected] = useState(null); // { type: 'vendor'|'member', data }
  const [saving, setSaving] = useState(false);

  // Fetch vendors + members when drawer opens
  useEffect(() => {
    if (!drawer.isOpenVendorAssign) return;

    if (currentOrganization?.id) {
      dispatch(getVendors(user?.id));
      setLoadingMembers(true);
      organizationMemberAPI.getMembers(currentOrganization.id)
        .then((res) => setMembers(res?.data || []))
        .catch(() => setMembers([]))
        .finally(() => setLoadingMembers(false));
    }
  }, [drawer.isOpenVendorAssign, currentOrganization?.id]);

  // Initialize selection from existing maintenance assignment
  useEffect(() => {
    if (!drawer.isOpenVendorAssign || !maintenance) return;

    const type = maintenance.assignedToType;
    if (maintenance.vendorId && type !== ASSIGNED_TYPE.OrganizationMember) {
      const vendor = vendors?.find((v) => String(v.id) === String(maintenance.vendorId));
      setSelected(vendor ? { type: 'vendor', data: vendor } : null);
    } else if (type === ASSIGNED_TYPE.OrganizationMember && maintenance.assignedToUserId) {
      const member = members.find((m) => String(m.userId) === String(maintenance.assignedToUserId));
      setSelected(member ? { type: 'member', data: member } : null);
    } else {
      setSelected(null);
    }
  }, [drawer.isOpenVendorAssign, maintenance, vendors, members]);

  // Unified options list: team members first, then vendors
  const options = useMemo(() => {
    const memberOptions = members
      .filter((m) => m.userId != null)
      .map((m) => ({
        type: 'member',
        id: `member-${m.userId}`,
        label: m.userName || m.userEmail || `User ${m.userId}`,
        data: m,
        group: 'Team & Staff'
      }));

    const vendorOptions = (vendors || []).map((v) => ({
      type: 'vendor',
      id: `vendor-${v.id}`,
      label: v.name,
      data: v,
      group: 'Vendors'
    }));

    return [...memberOptions, ...vendorOptions];
  }, [members, vendors]);

  const selectedOption = useMemo(() => {
    if (!selected) return null;
    if (selected.type === 'vendor') {
      return options.find((o) => o.type === 'vendor' && String(o.data.id) === String(selected.data.id)) || null;
    }
    if (selected.type === 'member') {
      return options.find((o) => o.type === 'member' && String(o.data.userId) === String(selected.data.userId)) || null;
    }
    return null;
  }, [selected, options]);

  // "Assign to self" — find current user in members list
  const selfMember = useMemo(() => {
    if (!members.length || !user) return null;
    const uid = user?.Id || user?.id;
    return members.find((m) => String(m.userId) === String(uid)) || null;
  }, [members, user]);

  const isSelfSelected = selected?.type === 'member' && selfMember &&
    String(selected.data.userId) === String(selfMember.userId);

  const handleChange = (_, opt) => {
    if (!opt) { setSelected(null); return; }
    setSelected({ type: opt.type, data: opt.data });
  };

  const handleAssignSelf = () => {
    if (!selfMember) return;
    setSelected({ type: 'member', data: selfMember });
  };

  const handleRemove = () => setSelected(null);

  const handleSave = async () => {
    if (!maintenance) return;
    setSaving(true);
    try {
      const isVendor = selected?.type === 'vendor';
      const isMember = selected?.type === 'member';

      await dispatch(updateMaintenance({
        id: maintenance.id,
        title: maintenance.title,
        unitName: maintenance.unitName || '',
        priority: maintenance.priority,
        status: maintenance.status,
        description: maintenance.description || '',
        categoryId: maintenance.categoryId || 0,
        imageUrl: maintenance.imageUrl || '',
        completedAt: maintenance.completedAt || null,
        vendorId: isVendor ? selected.data.id : null,
        assignedToType: isVendor ? ASSIGNED_TYPE.Vendor
          : isMember ? ASSIGNED_TYPE.OrganizationMember
          : ASSIGNED_TYPE.Unassigned,
        assignedToUserId: isMember ? selected.data.userId : null,
        assignedContactName: isMember ? (selected.data.userName || selected.data.userEmail) : null,
        assignedContactEmail: isMember ? selected.data.userEmail : null,
        assignedContactPhone: null,
        assignedAt: selected ? new Date().toISOString() : null
      }));

      openSnackbar({
        open: true,
        message: selected ? 'Assigned successfully' : 'Assignment removed',
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
      });

      drawer.closeVendorAssignDrawer();
      if (drawer.onVendorAssignSuccess) drawer.onVendorAssignSuccess();
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to update assignment',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' }
      });
    } finally {
      setSaving(false);
    }
  };

  if (!maintenance) return null;

  const statusDisplay = (() => {
    if (!maintenance.status) return 'N/A';
    const s = maintenance.status.toLowerCase();
    if (s === 'in-progress' || s === 'inprogress') return 'In Progress';
    return maintenance.status.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  })();

  // Info card color depends on type
  const cardColor = selected?.type === 'vendor'
    ? theme.palette.success.main
    : selected?.type === 'member'
    ? theme.palette.primary.main
    : theme.palette.text.disabled;

  return (
    <Drawer
      anchor="right"
      open={drawer.isOpenVendorAssign}
      onClose={drawer.closeVendorAssignDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 460 },
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: 'background.paper',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          gap: 1.5
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <UserOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
            <Typography variant="h6">Assign</Typography>
          </Stack>
          <IconButton onClick={drawer.closeVendorAssignDrawer} size="small">
            <CloseOutlined />
          </IconButton>
        </Stack>

        {/* Request summary */}
        <Box
          sx={{
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            border: `1px solid ${alpha(theme.palette.divider, 0.8)}`
          }}
        >
          <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ mb: 0.75 }}>
            {maintenance.title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip
              label={statusDisplay}
              color={getStatusColor(maintenance.status)}
              size="small"
              sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
            />
            {maintenance.priority && (
              <Chip
                label={maintenance.priority.charAt(0).toUpperCase() + maintenance.priority.slice(1)}
                color={getPriorityColor(maintenance.priority)}
                variant="outlined"
                size="small"
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
              />
            )}
            {maintenance.propertyName && (
              <Typography variant="caption" color="text.secondary">{maintenance.propertyName}</Typography>
            )}
          </Stack>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3, bgcolor: 'background.paper' }}>
        <Stack spacing={2.5}>
          {/* Assignee search */}
          <Stack spacing={0.75}>
            <Typography variant="subtitle2" fontWeight={600}>Assign to</Typography>
            <Autocomplete
              options={options}
              groupBy={(opt) => opt.group}
              getOptionLabel={(opt) => opt.label}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              value={selectedOption}
              onChange={handleChange}
              loading={loadingMembers}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Search team members or vendors..."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingMembers && <CircularProgress color="inherit" size={16} />}
                        {params.InputProps.endAdornment}
                      </>
                    )
                  }}
                />
              )}
              renderOption={(props, opt) => (
                <li {...props} key={opt.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {opt.type === 'member'
                      ? <TeamOutlined style={{ fontSize: 13, color: theme.palette.primary.main }} />
                      : <UserOutlined style={{ fontSize: 13, color: theme.palette.success.main }} />
                    }
                    <Typography variant="body2">{opt.label}</Typography>
                  </Stack>
                </li>
              )}
            />
          </Stack>

          {/* Assignment info card — always visible */}
          {selected ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: alpha(cardColor, 0.04),
                border: `1px solid ${alpha(cardColor, 0.2)}`
              }}
            >
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {selected.type === 'vendor' ? selected.data.name : (selected.data.userName || selected.data.userEmail)}
                    </Typography>
                    {selected.type === 'vendor' && selected.data.businessName && (
                      <Typography variant="caption" color="text.secondary">{selected.data.businessName}</Typography>
                    )}
                  </Box>
                  <Chip
                    label={selected.type === 'member' ? 'Team Member' : (selected.data.category || 'Vendor')}
                    size="small"
                    sx={{
                      height: 20,
                      fontSize: '0.7rem',
                      bgcolor: alpha(cardColor, 0.1),
                      color: cardColor,
                      border: `1px solid ${alpha(cardColor, 0.2)}`
                    }}
                  />
                </Stack>

                {(selected.data.email || selected.data.userEmail || selected.data.phone || selected.data.specialties) && (
                  <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.5) }} />
                )}

                <Stack spacing={0.75}>
                  {(selected.type === 'vendor' ? selected.data.email : selected.data.userEmail) && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MailOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
                      <Typography variant="caption" color="text.secondary">
                        {selected.type === 'vendor' ? selected.data.email : selected.data.userEmail}
                      </Typography>
                    </Stack>
                  )}
                  {selected.type === 'vendor' && selected.data.phone && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PhoneOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
                      <Typography variant="caption" color="text.secondary">{selected.data.phone}</Typography>
                    </Stack>
                  )}
                  {selected.type === 'vendor' && selected.data.specialties && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TagOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
                      <Typography variant="caption" color="text.secondary">{selected.data.specialties}</Typography>
                    </Stack>
                  )}
                </Stack>
              </Stack>
            </Box>
          ) : (
            <Box
              sx={{
                p: 2,
                borderRadius: 1.5,
                bgcolor: alpha(theme.palette.text.disabled, 0.04),
                border: `1px solid ${alpha(theme.palette.divider, 0.6)}`
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.text.disabled, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <UserOutlined style={{ fontSize: 15, color: theme.palette.text.disabled }} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" color="text.disabled" fontWeight={600}>Unassigned</Typography>
                  <Typography variant="caption" color="text.disabled">No one assigned to this request</Typography>
                </Box>
              </Stack>
            </Box>
          )}

          {/* Assign to self / Remove */}
          <Stack direction="row" spacing={2} alignItems="center">
            {selfMember && !isSelfSelected && (
              <Typography
                variant="caption"
                onClick={handleAssignSelf}
                sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              >
                Assign to self
              </Typography>
            )}
            {selected && (
              <Typography
                variant="caption"
                onClick={handleRemove}
                sx={{ color: 'error.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
              >
                Remove assignment
              </Typography>
            )}
          </Stack>
        </Stack>
      </Box>

      {/* Footer */}
      <Box
        sx={{
          px: 3,
          py: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: 'background.paper',
          flexShrink: 0
        }}
      >
        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button variant="outlined" color="inherit" onClick={drawer.closeVendorAssignDrawer}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Box>
    </Drawer>
  );
}
