import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  alpha,
  useTheme,
  Alert,
  Checkbox,
  Divider,
  Autocomplete, 
  InputAdornment,
  Menu,
  MenuList,
  ListItemText
} from '@mui/material';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  UserOutlined,
  UploadOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  CloseOutlined,
  FilterOutlined
} from '@ant-design/icons';
import useFetchStaffMembers from 'hooks/useFetchStaffMembers';
import { staffMemberAPI, organizationAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import axios from 'utils/axios';
import useAuth from 'hooks/useAuth';
import { formatCurrency } from 'utils/formatters';
import FilterDeleteIcon from 'components/FilterDeleteIcon';
import MainCard from 'components/MainCard';
import { useOrganization } from 'contexts/OrganizationContext';

// Predefined staff member roles
const STAFF_ROLES = [
  'Maintenance Technician',
  'Maintenance Supervisor',
  'Handyman',
  'Plumber',
  'Electrician',
  'HVAC Technician',
  'Painter',
  'Carpenter',
  'Groundskeeper',
  'Other'
];

export default function StaffMembers() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const { staffMembers, loading, refetch } = useFetchStaffMembers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const fileInputRef = useRef(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [existingUser, setExistingUser] = useState(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [selectedOrganizationIds, setSelectedOrganizationIds] = useState([]);
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [clickedChipFilter, setClickedChipFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStaffMember, setSelectedStaffMember] = useState(null);
  const [staffInvites, setStaffInvites] = useState({}); // { staffMemberId: boolean } - true if invite was sent

  const [staffForm, setStaffForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: '',
    hourlyRate: '',
    sendInvite: true,
    isActive: true
  });

  const handleOpenDialog = (staff = null) => {
    setSelectedStaff(staff);
    if (staff) {
      // Edit mode - populate form with existing data
      setStaffForm({
        firstName: staff.userFirstName || '',
        lastName: staff.userLastName || '',
        email: staff.userEmail || '',
        role: staff.role || '',
        hourlyRate: staff.hourlyRate || '',
        sendInvite: false, // Don't send invite when editing
        isActive: staff.isActive ?? true
      });
      setExistingUser({ id: staff.userId, email: staff.userEmail });
    } else {
      // Add mode - reset form
      setStaffForm({
        firstName: '',
        lastName: '',
        email: '',
        role: '',
        hourlyRate: '',
        sendInvite: true,
        isActive: true
      });
      setExistingUser(null);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    if (!submitting && !checkingEmail) {
      setDialogOpen(false);
      setSelectedStaff(null);
      setStaffForm({
        firstName: '',
        lastName: '',
        email: '',
        role: '',
        hourlyRate: '',
        sendInvite: true,
        isActive: true
      });
      setExistingUser(null);
    }
  };

  const handleSubmit = async () => {
    // Validate form
    if (!staffForm.firstName || !staffForm.lastName) {
      openSnackbar({
        open: true,
        message: 'Please fill in First name and Last name',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    if (!staffForm.role) {
      openSnackbar({
        open: true,
        message: 'Please select a role',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    // Email is required if sending invite
    if (staffForm.sendInvite && !staffForm.email) {
      openSnackbar({
        open: true,
        message: 'Email is required when sending an invite',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    // Validate email format if provided
    if (staffForm.email && !staffForm.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      openSnackbar({
        open: true,
        message: 'Please enter a valid email address',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      setSubmitting(true);

      // If editing, update existing staff member
      if (selectedStaff?.id) {
        const payload = {
          userId: selectedStaff.userId,
          role: staffForm.role,
          hourlyRate: staffForm.hourlyRate ? parseFloat(staffForm.hourlyRate) : null,
          isActive: staffForm.isActive
        };
        const response = await staffMemberAPI.updateStaffMember(selectedStaff.id, payload);
        if (response?.data?.success) {
          openSnackbar({
            open: true,
            message: 'Staff member updated successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          handleCloseDialog();
          refetch();
        } else {
          throw new Error(response?.data?.message || 'Failed to update staff member');
        }
        return;
      }

      // Adding new staff member - create placeholder first
      const payload = {
        userId: null, // Placeholder - no user account yet
        firstName: staffForm.firstName,
        lastName: staffForm.lastName,
        email: staffForm.email,
        role: staffForm.role,
        hourlyRate: staffForm.hourlyRate ? parseFloat(staffForm.hourlyRate) : null,
        isActive: staffForm.isActive
      };

      // Create placeholder staff member
      const addResponse = await staffMemberAPI.addStaffMember(payload);
      if (!addResponse?.data?.success) {
        throw new Error(addResponse?.data?.message || 'Failed to create staff member');
      }

      const newStaffMemberId = addResponse.data.data.id;

      // If sendInvite is true, create an invite
      if (staffForm.sendInvite && staffForm.email) {
        try {
          const inviteResponse = await staffMemberAPI.createInvite(newStaffMemberId, staffForm.email);
          
          // Check if user exists (409 status code means USER_EXISTS)
          if (inviteResponse?.response?.status === 409 && inviteResponse?.response?.data?.message === 'USER_EXISTS') {
            // User exists - show confirmation dialog
            // Update invite status
            setStaffInvites(prev => ({ ...prev, [newStaffMemberId]: true }));
            setPendingInvite({ staffMemberId: newStaffMemberId, email: staffForm.email });
            setConfirmDialogOpen(true);
            setSubmitting(false);
            return;
          }

          if (!inviteResponse?.data?.success) {
            throw new Error(inviteResponse?.data?.message || 'Failed to create invite');
          }

          // Update invite status
          setStaffInvites(prev => ({ ...prev, [newStaffMemberId]: true }));

          openSnackbar({
            open: true,
            message: 'Staff member added and invitation sent successfully',
            variant: 'alert',
            alert: { color: 'success' }
          });
          handleCloseDialog();
          refetch();
        } catch (error) {
          // If invite creation fails, staff member is still created
          console.error('Error creating invite:', error);
          if (error?.response?.status === 409 && error?.response?.data?.message === 'USER_EXISTS') {
            setPendingInvite({ staffMemberId: newStaffMemberId, email: staffForm.email });
            setConfirmDialogOpen(true);
            setSubmitting(false);
            return;
          }
          // Show warning but still close dialog and refetch since staff member was created
          openSnackbar({
            open: true,
            message: 'Staff member added but failed to send invitation. You can resend it later.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          handleCloseDialog();
          refetch();
        }
      } else {
        openSnackbar({
          open: true,
          message: 'Staff member added successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        handleCloseDialog();
        refetch();
      }
    } catch (error) {
      console.error('Error saving staff member:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to save staff member',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmInvite = async () => {
    if (!pendingInvite) return;

    try {
      setSubmitting(true);
      const inviteResponse = await staffMemberAPI.createInvite(pendingInvite.staffMemberId, pendingInvite.email);
      
      if (inviteResponse?.data?.success) {
        // Update invite status
        setStaffInvites(prev => ({ ...prev, [pendingInvite.staffMemberId]: true }));
        
        openSnackbar({
          open: true,
          message: 'Invitation sent successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        throw new Error(inviteResponse?.data?.message || 'Failed to send invitation');
      }

      setConfirmDialogOpen(false);
      setPendingInvite(null);
      handleCloseDialog();
      refetch();
    } catch (error) {
      console.error('Error sending invite:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to send invitation',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStaff) return;
    try {
      const response = await staffMemberAPI.deleteStaffMember(selectedStaff.id);
      if (response?.data?.success) {
        openSnackbar({
          open: true,
          message: 'Staff member deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setDeleteDialogOpen(false);
        setSelectedStaff(null);
        refetch();
      } else {
        throw new Error(response?.data?.message || 'Failed to delete staff member');
      }
    } catch (error) {
      console.error('Error deleting staff member:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete staff member',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleViewTimeEntries = (staffId) => {
    navigate(`/landlord/time-tracking?staffMemberId=${staffId}`);
  };

  // CSV Import functions
  const parseCSV = (csvText) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const staffList = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      if (values.length < headers.length) continue;

      const staff = {};
      headers.forEach((header, index) => {
        staff[header] = values[index] || '';
      });
      staffList.push(staff);
    }

    return staffList;
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.csv')) {
        openSnackbar({
          open: true,
          message: 'Please select a CSV file',
          variant: 'alert',
          alert: { color: 'error' }
        });
        return;
      }
      setCsvFile(file);
    }
  };

  const handleImport = async () => {
    if (!csvFile) {
      openSnackbar({
        open: true,
        message: 'Please select a CSV file',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setImporting(true);
    try {
      const text = await csvFile.text();
      const staffList = parseCSV(text);
      
      if (staffList.length === 0) {
        throw new Error('No valid staff members found in CSV file');
      }

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (const staff of staffList) {
        try {
          // Get email, role, and hourly rate from CSV
          const email = (staff.email || staff['user email'] || '').trim();
          const role = (staff.role || '').trim();
          const hourlyRate = staff['hourly rate'] || staff.hourlyrate || '';

          if (!email || !role) {
            errors.push(`Row ${staffList.indexOf(staff) + 2}: Missing email or role`);
            errorCount++;
            continue;
          }

          // Find user by email
          const userResponse = await axios.post('/api/user/get-by-email', { email });
          if (!userResponse.data?.success || !userResponse.data?.data) {
            errors.push(`Row ${staffList.indexOf(staff) + 2}: User not found for email ${email}`);
            errorCount++;
            continue;
          }

          const userId = userResponse.data.data.id;

          // Check if staff member already exists
          const existingStaff = staffMembers.find(sm => sm.userId === userId);
          if (existingStaff) {
            errors.push(`Row ${staffList.indexOf(staff) + 2}: Staff member already exists for ${email}`);
            errorCount++;
            continue;
          }

          // Add staff member
          const payload = {
            userId,
            role,
            hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
            isActive: true
          };

          const response = await staffMemberAPI.addStaffMember(payload);
          if (response?.data?.success) {
            successCount++;
          } else {
            errors.push(`Row ${staffList.indexOf(staff) + 2}: ${response?.data?.message || 'Failed to add staff member'}`);
            errorCount++;
          }
        } catch (error) {
          const email = (staff.email || staff['user email'] || '').trim();
          errors.push(`Row ${staffList.indexOf(staff) + 2}: ${error?.response?.data?.message || error?.message || 'Error processing row'}`);
          errorCount++;
        }
      }

      // Show results
      if (successCount > 0) {
        openSnackbar({
          open: true,
          message: `Successfully imported ${successCount} staff member(s)${errorCount > 0 ? `. ${errorCount} error(s) occurred.` : ''}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      }

      if (errorCount > 0 && errors.length > 0) {
        console.error('Import errors:', errors);
        if (successCount === 0) {
          openSnackbar({
            open: true,
            message: `Failed to import staff members. ${errors[0]}`,
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      }

      if (successCount > 0) {
        refetch();
        handleCloseImportDialog();
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      openSnackbar({
        open: true,
        message: error?.message || 'Failed to import CSV file',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setImporting(false);
    }
  };

  const handleOpenImportDialog = () => {
    setImportDialogOpen(true);
    setCsvFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCloseImportDialog = () => {
    setImportDialogOpen(false);
    setCsvFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Load organizations for filter
  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoadingOrganizations(true);
        const response = await organizationAPI.getUserOrganizations();
        if (response.success && response.data) {
          setAvailableOrganizations(response.data);
        } else {
          setAvailableOrganizations([]);
        }
      } catch (error) {
        console.error('Error loading organizations:', error);
        setAvailableOrganizations([]);
      } finally {
        setLoadingOrganizations(false);
      }
    };

    loadOrganizations();
  }, []);

  // Default to current organization
  useEffect(() => {
    if (currentOrganization && selectedOrganizationIds.length === 0) {
      setSelectedOrganizationIds([currentOrganization.id]);
    }
  }, [currentOrganization, selectedOrganizationIds.length]);

  // Check for invites sent to staff members
  useEffect(() => {
    const checkStaffInvites = async () => {
      if (!staffMembers || staffMembers.length === 0) return;
      
      const inviteChecks = staffMembers
        .filter(sm => !sm.userId && (sm.email || sm.userEmail)) // No UserId but has email
        .map(async (staff) => {
          try {
            const response = await staffMemberAPI.getInvitesByStaffMemberId(staff.id);
            // Check if there are any invites (even if expired, we still show "Invite Sent")
            const hasInvite = response.success && response.data && response.data.length > 0;
            return {
              staffMemberId: staff.id,
              hasInviteSent: hasInvite
            };
          } catch (error) {
            console.error(`Error checking invites for staff member ${staff.id}:`, error);
            return {
              staffMemberId: staff.id,
              hasInviteSent: false
            };
          }
        });

      const results = await Promise.all(inviteChecks);
      const inviteMap = {};
      results.forEach(result => {
        if (result.hasInviteSent) {
          inviteMap[result.staffMemberId] = true;
        }
      });
      setStaffInvites(inviteMap);
    };

    checkStaffInvites();
  }, [staffMembers]);

  // Filter staff members by organization and search
  const filteredStaffMembers = useMemo(() => {
    let filtered = staffMembers;
    
    // Filter by organization
    if (selectedOrganizationIds.length > 0) {
      filtered = filtered.filter(sm => selectedOrganizationIds.includes(sm.organizationId));
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(sm => {
        const name = `${sm.firstName || sm.userFirstName || ''} ${sm.lastName || sm.userLastName || ''}`.trim().toLowerCase();
        const email = (sm.email || sm.userEmail || '').toLowerCase();
        const role = (sm.role || '').toLowerCase();
        return name.includes(query) || email.includes(query) || role.includes(query);
      });
    }
    
    return filtered;
  }, [staffMembers, selectedOrganizationIds, searchQuery]);

  const activeStaff = useMemo(() => filteredStaffMembers.filter(sm => sm.isActive), [filteredStaffMembers]);
  const inactiveStaff = useMemo(() => filteredStaffMembers.filter(sm => !sm.isActive), [filteredStaffMembers]);

  return (
    <>
      <Stack spacing={3}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h3" sx={{ mb: 0.5 }}>
              Staff Members
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 1, md: 0 } }}>
              Manage internal staff members who work on maintenance requests
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="text"
              startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
              onClick={() => handleOpenDialog()}
              sx={{
                color: 'primary.main',
                textTransform: 'none',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              Add Staff Member
            </Button>
            <Button
              size="small"
              variant="text"
              startIcon={<UploadOutlined style={{ fontSize: 16 }} />}
              onClick={handleOpenImportDialog}
              sx={{
                color: 'primary.main',
                textTransform: 'none',
                flexShrink: 0,
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              Import Staff Members
            </Button>
          </Stack>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <UserOutlined style={{ fontSize: 24, color: '#1877F2' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Total Staff
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {filteredStaffMembers.length}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <UserOutlined style={{ fontSize: 24, color: '#2e7d32' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Active Staff
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {activeStaff.length}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card
              variant="outlined"
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
              }}
            >
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <ClockCircleOutlined style={{ fontSize: 24, color: '#ed6c02' }} />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Inactive Staff
                    </Typography>
                    <Typography variant="h5" fontWeight="bold">
                      {inactiveStaff.length}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Filters */}
        <MainCard
          sx={{
            mb: 3,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2,
            overflow: 'hidden'
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 2,
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
              <Autocomplete
            freeSolo
            options={staffMembers}
            value={selectedStaffMember}
            onChange={(event, newValue) => {
              if (typeof newValue === 'string') {
                setSearchQuery(newValue);
                setSelectedStaffMember(null);
              } else if (newValue) {
                setSelectedStaffMember(newValue);
                const name = `${newValue.firstName || newValue.userFirstName || ''} ${newValue.lastName || newValue.userLastName || ''}`.trim();
                setSearchQuery(name || newValue.email || newValue.userEmail || '');
              } else {
                setSelectedStaffMember(null);
                setSearchQuery('');
              }
            }}
            onInputChange={(event, newInputValue) => {
              setSearchQuery(newInputValue);
              if (!newInputValue) {
                setSelectedStaffMember(null);
              }
            }}
            getOptionLabel={(option) => {
              if (typeof option === 'string') {
                return option;
              }
              const name = `${option.firstName || option.userFirstName || ''} ${option.lastName || option.userLastName || ''}`.trim();
              const email = option.email || option.userEmail || '';
              return name ? `${name}${email ? ` (${email})` : ''}` : email || 'Unknown';
            }}
            isOptionEqualToValue={(option, value) => {
              if (!option || !value) return false;
              if (typeof option === 'string' || typeof value === 'string') return false;
              return option.id === value.id;
            }}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue) return options;
              const query = inputValue.toLowerCase();
              return options.filter(option => {
                const name = `${option.firstName || option.userFirstName || ''} ${option.lastName || option.userLastName || ''}`.trim().toLowerCase();
                const email = (option.email || option.userEmail || '').toLowerCase();
                const role = (option.role || '').toLowerCase();
                return name.includes(query) || email.includes(query) || role.includes(query);
              });
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="Search staff members..."
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                    </InputAdornment>
                  )
                }}
                sx={{ minWidth: 300 }}
              />
            )}
                sx={{ flex: 1, minWidth: 300 }}
              />
              {selectedOrganizationIds.map((orgId) => {
                const org = availableOrganizations.find(o => o.id === orgId);
                if (!org) return null;
                return (
                  <Chip
                    key={orgId}
                    label={`Organization: ${org.name}`}
                    onDelete={() => {
                      setSelectedOrganizationIds(prev => prev.filter(id => id !== orgId));
                    }}
                    deleteIcon={<FilterDeleteIcon fontSize={10} />}
                    size="small"
                    variant="outlined"
                    sx={{
                      flexShrink: 0,
                      bgcolor: 'background.paper',
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      px: 0.75,
                      '& .MuiChip-label': {
                        color: 'primary.main',
                        px: 0.5
                      },
                      '& .MuiChip-deleteIcon': {
                        marginLeft: 0.5,
                        marginRight: -0.5
                      }
                    }}
                  />
                );
              })}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<FilterOutlined style={{ fontSize: 16 }} />}
                onClick={(e) => setFilterAnchorEl(e.currentTarget)}
                sx={{
                  color: 'primary.main',
                  borderColor: 'primary.main',
                  textTransform: 'none',
                  flexShrink: 0,
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08),
                    borderColor: 'primary.main'
                  }
                }}
              >
                Add filters
              </Button>
            </Box>
          </Box>
        </MainCard>

        {/* Filter Menu */}
        <Menu
          anchorEl={filterAnchorEl}
          open={Boolean(filterAnchorEl) && !clickedChipFilter}
          onClose={() => {
            setFilterAnchorEl(null);
            setSubMenuAnchorEl(null);
            setActiveSubMenu(null);
            setClickedChipFilter(null);
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left'
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left'
          }}
        >
          <MenuList>
            {/* Organization Filter */}
            <MenuItem
              onClick={(e) => {
                setActiveSubMenu('organization');
                setSubMenuAnchorEl(e.currentTarget);
              }}
            >
              <ListItemText primary="Organization" />
              {selectedOrganizationIds.length > 0 && (
                <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                  {selectedOrganizationIds.length} selected
                </Typography>
              )}
            </MenuItem>
          </MenuList>
        </Menu>

        {/* Submenu for Filter Options */}
        <Menu
          anchorEl={subMenuAnchorEl}
          open={Boolean(subMenuAnchorEl) && activeSubMenu === 'organization'}
          onClose={() => {
            setSubMenuAnchorEl(null);
            setActiveSubMenu(null);
            setFilterAnchorEl(null);
            setClickedChipFilter(null);
          }}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right'
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'left'
          }}
        >
          <MenuList>
            {activeSubMenu === 'organization' && (
              <>
                {availableOrganizations.map((org) => (
                  <MenuItem
                    key={org.id}
                    onClick={() => {
                      setSelectedOrganizationIds(prev => {
                        if (prev.includes(org.id)) {
                          return prev.filter(id => id !== org.id);
                        } else {
                          return [...prev, org.id];
                        }
                      });
                    }}
                  >
                    <Checkbox
                      checked={selectedOrganizationIds.includes(org.id)}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    <ListItemText primary={org.name} />
                  </MenuItem>
                ))}
              </>
            )}
          </MenuList>
        </Menu>

        {/* Staff Members Table */}
        {loading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
              boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2,
              overflow: 'hidden'
            }}
          >
            <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Hourly Rate</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="center">Account</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredStaffMembers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                        <UserOutlined style={{ fontSize: 48, opacity: 0.3 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          No staff members found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStaffMembers.map((staff) => {
                      // For placeholder staff members (no userId), use firstName/lastName/email
                      // For staff members with accounts, use userFirstName/userLastName/userEmail
                      const displayName = staff.userName || 
                        `${staff.firstName || staff.userFirstName || ''} ${staff.lastName || staff.userLastName || ''}`.trim() || 
                        'Unknown';
                      const displayEmail = staff.email || staff.userEmail || '-';
                      
                      return (
                      <TableRow 
                        key={staff.id} 
                        hover
                        onClick={() => navigate(`/landlord/staff-member/${staff.id}`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2">
                            {displayName}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {displayEmail}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {staff.role || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {staff.hourlyRate ? formatCurrency(staff.hourlyRate) : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={staff.isActive ? 'Active' : 'Inactive'}
                            color={staff.isActive ? 'success' : 'default'}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          {(() => {
                            const hasAccount = !!staff.userId || staff.hasAccount;
                            const email = staff.email || staff.userEmail;
                            const hasInviteSent = !hasAccount && email && staffInvites[staff.id];
                            return (
                              <Chip
                                label={
                                  hasAccount 
                                    ? 'Account Created' 
                                    : hasInviteSent 
                                      ? 'Invite Sent' 
                                      : 'No Account'
                                }
                                color={
                                  hasAccount 
                                    ? 'success' 
                                    : hasInviteSent 
                                      ? 'warning' 
                                      : 'default'
                                }
                                size="small"
                                sx={{ fontWeight: 600 }}
                              />
                            );
                          })()}
                        </TableCell>
                        <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              onClick={() => handleViewTimeEntries(staff.id)}
                              title="View Time Entries"
                            >
                              <ClockCircleOutlined />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDialog(staff)}
                              title="Edit"
                            >
                              <EditOutlined />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setSelectedStaff(staff);
                                setDeleteDialogOpen(true);
                              }}
                              title="Delete"
                            >
                              <DeleteOutlined />
                            </IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
      </Stack>

      {/* Add/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog} 
        maxWidth="sm" 
        fullWidth
        disableEscapeKeyDown={submitting || checkingEmail}
      >
        <DialogTitle>
          {selectedStaff ? 'Edit Staff Member' : 'Add Staff Member'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Enter the staff member's information. You can optionally send them an invitation email to create an account.
            </Typography>
            <TextField
              fullWidth
              label="First Name *"
              value={staffForm.firstName}
              onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })}
              required
              disabled={!!selectedStaff}
            />
            <TextField
              fullWidth
              label="Last Name *"
              value={staffForm.lastName}
              onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })}
              required
              disabled={!!selectedStaff}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              helperText={staffForm.sendInvite ? "Required if sending invite" : selectedStaff ? "Email cannot be changed" : "Required to add staff member"}
              disabled={!!selectedStaff}
            />
            <FormControl fullWidth required>
              <InputLabel>Role *</InputLabel>
              <Select
                value={staffForm.role}
                label="Role *"
                onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value })}
              >
                {STAFF_ROLES.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Hourly Rate (Optional)"
              type="number"
              value={staffForm.hourlyRate}
              onChange={(e) => setStaffForm({ ...staffForm, hourlyRate: e.target.value })}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>$</Typography>
              }}
            />
            {!selectedStaff && (
              <>
                <Divider />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={staffForm.sendInvite}
                      onChange={(e) => setStaffForm({ ...staffForm, sendInvite: e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2">
                        Send invitation email to create account
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        The staff member will receive an email with a link to create their account
                      </Typography>
                    </Box>
                  }
                />
              </>
            )}
            {selectedStaff && (
              <FormControlLabel
                control={
                  <Switch
                    checked={staffForm.isActive}
                    onChange={(e) => setStaffForm({ ...staffForm, isActive: e.target.checked })}
                  />
                }
                label="Active"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={submitting || checkingEmail}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={submitting || checkingEmail || !staffForm.firstName || !staffForm.lastName || !staffForm.role || (staffForm.sendInvite && !staffForm.email) || (!selectedStaff && !staffForm.email)}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {submitting ? 'Saving...' : selectedStaff ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Staff Member</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this staff member? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Invite for Existing User Dialog */}
      <Dialog open={confirmDialogOpen} onClose={() => { setConfirmDialogOpen(false); setPendingInvite(null); }}>
        <DialogTitle>User Already Exists</DialogTitle>
        <DialogContent>
          <Typography>
            A user with the email <strong>{pendingInvite?.email}</strong> already has an account. 
            Do you want to send them an invitation to join your team as a staff member?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setConfirmDialogOpen(false); setPendingInvite(null); }} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmInvite}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={16} /> : null}
          >
            {submitting ? 'Sending...' : 'Send Invitation'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Staff Members Dialog */}
      <Dialog open={importDialogOpen} onClose={handleCloseImportDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Import Staff Members</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              ref={fileInputRef}
              style={{ display: 'none' }}
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input">
              <Button
                variant="outlined"
                component="span"
                startIcon={<UploadOutlined />}
                fullWidth
                sx={{
                  py: 1.5,
                  borderStyle: 'dashed',
                  '&:hover': {
                    borderStyle: 'dashed',
                    bgcolor: alpha(theme.palette.primary.main, 0.04)
                  }
                }}
              >
                {csvFile ? csvFile.name : 'Select CSV File'}
              </Button>
            </label>
            
            <Alert
              severity="info"
              icon={<InfoCircleOutlined />}
              sx={{
                bgcolor: (t) => alpha(t.palette.info.main, 0.1),
                border: (t) => `1px solid ${alpha(t.palette.info.main, 0.3)}`,
                borderRadius: 1.5,
                '& .MuiAlert-icon': {
                  color: 'info.main'
                }
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                CSV format: Email, Role, Hourly Rate (optional)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                The first row should contain headers. Each row should have the user's email, their role, and optionally their hourly rate.
              </Typography>
            </Alert>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            variant="contained"
            disabled={!csvFile || importing}
            startIcon={importing ? <CircularProgress size={16} /> : <UploadOutlined />}
          >
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
