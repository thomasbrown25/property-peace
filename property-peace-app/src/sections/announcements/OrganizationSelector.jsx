import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Chip,
  Stack
} from '@mui/material';
import { CircularProgress } from '@mui/material';

// project imports
import { useOrganization } from 'contexts/OrganizationContext';
import { organizationAPI } from 'api';

// ==============================|| ORGANIZATION SELECTOR ||============================== //

export default function OrganizationSelector({ selectedOrganizations, onSelectionChange }) {
  const { organizations: contextOrganizations } = useOrganization();
  const [availableOrganizations, setAvailableOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganizations = async () => {
      try {
        setLoading(true);
        const response = await organizationAPI.getUserOrganizations();
        if (response.success && response.data) {
          // Filter to only show organizations where user has Owner or Manager role
          const orgsWithAccess = response.data.filter(org => {
            const role = org.userRole || org.role;
            return role === 'Owner' || role === 'Manager';
          });
          setAvailableOrganizations(orgsWithAccess);
        } else {
          setAvailableOrganizations([]);
        }
      } catch (error) {
        console.error('Error loading organizations:', error);
        setAvailableOrganizations([]);
      } finally {
        setLoading(false);
      }
    };

    loadOrganizations();
  }, []);

  const handleChange = (event) => {
    const value = event.target.value;
    // Handle "All" option
    if (value.includes('all')) {
      const allIds = availableOrganizations.map(org => org.id);
      onSelectionChange(allIds);
      return;
    }
    onSelectionChange(value);
  };

  const getRoleChip = (role) => {
    if (role === 'Owner') {
      return <Chip label="Owner" size="small" color="primary" sx={{ ml: 1, height: 20 }} />;
    } else if (role === 'Manager') {
      return <Chip label="Manager" size="small" color="secondary" sx={{ ml: 1, height: 20 }} />;
    }
    return null;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (availableOrganizations.length === 0) {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary">
          No organizations available. You need Owner or Manager role to send announcements.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Select Organizations
      </Typography>
      <FormControl fullWidth>
        <InputLabel>Organizations</InputLabel>
        <Select
          multiple
          value={Array.from(selectedOrganizations)}
          onChange={handleChange}
          label="Organizations"
          renderValue={(selected) => {
            if (selected.length === 0) {
              return <Typography variant="body2" color="text.secondary">Select organizations...</Typography>;
            }
            if (selected.length === availableOrganizations.length) {
              return <Chip label="All Organizations" size="small" />;
            }
            return (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((orgId) => {
                  const org = availableOrganizations.find(o => o.id === orgId);
                  return org ? (
                    <Chip key={orgId} label={org.name} size="small" />
                  ) : null;
                })}
              </Box>
            );
          }}
        >
          {availableOrganizations.length > 1 && (
            <MenuItem value="all">
              <Checkbox checked={selectedOrganizations.size === availableOrganizations.length} />
              <ListItemText primary="All Organizations" />
            </MenuItem>
          )}
          {availableOrganizations.map((org) => {
            const role = org.userRole || org.role;
            return (
              <MenuItem key={org.id} value={org.id}>
                <Checkbox checked={selectedOrganizations.has(org.id)} />
                <Stack direction="row" alignItems="center" spacing={1} sx={{ flex: 1 }}>
                  <ListItemText primary={org.name} />
                  {getRoleChip(role)}
                </Stack>
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>
    </Box>
  );
}

OrganizationSelector.propTypes = {
  selectedOrganizations: PropTypes.instanceOf(Set).isRequired,
  onSelectionChange: PropTypes.func.isRequired
};
