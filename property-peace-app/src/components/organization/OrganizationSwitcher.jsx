import { useState } from 'react';
import {
  Box,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  CircularProgress
} from '@mui/material';
import { useOrganization } from 'contexts/OrganizationContext';
import { organizationAPI } from 'api';

export default function OrganizationSwitcher() {
  const { currentOrganization, organizations, switchOrganization, loading } = useOrganization();
  const [switching, setSwitching] = useState(false);

  const handleSwitch = async (event) => {
    const newOrganizationId = event.target.value;
    if (newOrganizationId === currentOrganization?.id) return;

    setSwitching(true);
    try {
      await switchOrganization(newOrganizationId);
    } catch (error) {
      console.error('Error switching organization:', error);
    } finally {
      setSwitching(false);
    }
  };

  if (loading || switching) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (!organizations || organizations.length === 0) {
    return null;
  }

  if (organizations.length === 1) {
    return (
      <Chip
        label={currentOrganization?.name || organizations[0]?.name}
        color="primary"
        size="small"
      />
    );
  }

  return (
    <FormControl size="small" sx={{ minWidth: 200 }}>
      <InputLabel id="organization-select-label">Organization</InputLabel>
      <Select
        labelId="organization-select-label"
        id="organization-select"
        value={currentOrganization?.id || ''}
        label="Organization"
        onChange={handleSwitch}
        disabled={switching}
      >
        {organizations.map((org) => (
          <MenuItem key={org.id} value={org.id}>
            {org.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

