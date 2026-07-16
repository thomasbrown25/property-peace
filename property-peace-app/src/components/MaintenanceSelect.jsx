import { useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/system';
import Autocomplete from 'components/@extended/AutoComplete';
import axiosServices from 'utils/axios';
import { useDebounce } from 'hooks/useDebounce';

const MaintenanceSelect = ({ 
  width = '100%', 
  value, 
  onChange, 
  label = 'Maintenance Request (Optional)',
  propertyId = null 
}) => {
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Fetch all maintenance requests (current + history) for search
  useEffect(() => {
    const fetchMaintenances = async () => {
      setLoading(true);
      try {
        // Fetch both current and history maintenance requests
        const [currentResponse, historyResponse] = await Promise.all([
          axiosServices.get('/api/maintenance-request/organization/current'),
          axiosServices.get('/api/maintenance-request/organization/history')
        ]);

        const current = currentResponse?.data?.success ? (currentResponse.data.data || []) : [];
        const history = historyResponse?.data?.success ? (historyResponse.data.data || []) : [];
        
        // Combine and deduplicate by id
        const allMaintenances = [...current, ...history];
        const uniqueMaintenances = allMaintenances.reduce((acc, curr) => {
          if (!acc.find(m => m.id === curr.id)) {
            acc.push(curr);
          }
          return acc;
        }, []);

        setMaintenances(uniqueMaintenances);
      } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        setMaintenances([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMaintenances();
  }, []);

  // Filter maintenances based on search query
  const filteredMaintenances = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return maintenances;
    }

    const query = debouncedQuery.toLowerCase();
    return maintenances.filter((maintenance) => {
      const title = (maintenance.title || '').toLowerCase();
      const orderNumber = (maintenance.orderNumber || '').toLowerCase();
      const propertyName = (maintenance.propertyName || '').toLowerCase();
      
      return (
        title.includes(query) ||
        orderNumber.includes(query) ||
        propertyName.includes(query)
      );
    });
  }, [maintenances, debouncedQuery]);

  // Format options for Autocomplete
  const options = useMemo(() => {
    return filteredMaintenances.map((maintenance) => {
      const propertyName = maintenance.propertyName || 'Unknown Property';
      const orderNumber = maintenance.orderNumber || `MR-${maintenance.id}`;
      const status = maintenance.status || 'Unknown';
      
      // Format: "MR-2026-0001 - Burst Pipe Under House (Edgemont Property) - Open"
      const label = `${orderNumber} - ${maintenance.title || 'Untitled'} (${propertyName}) - ${status}`;
      
      return {
        label,
        id: maintenance.id,
        maintenance
      };
    });
  }, [filteredMaintenances]);

  // Find selected option — search all maintenances, not filtered options,
  // so the selection isn't lost when the filter narrows the list
  const selectedOption = useMemo(() => {
    if (!value) return null;
    const maintenance = maintenances.find(m => String(m.id) === String(value));
    if (!maintenance) return null;
    const propertyName = maintenance.propertyName || 'Unknown Property';
    const orderNumber = maintenance.orderNumber || `MR-${maintenance.id}`;
    const status = maintenance.status || 'Unknown';
    return {
      label: `${orderNumber} - ${maintenance.title || 'Untitled'} (${propertyName}) - ${status}`,
      id: maintenance.id,
      maintenance
    };
  }, [maintenances, value]);

  const handleChange = (event, newValue) => {
    if (onChange) {
      onChange(newValue?.id || null);
    }
  };

  return (
    <Box 
      width={width} 
      display="flex" 
      flexDirection="column" 
      justifyContent="space-between" 
      alignItems="start" 
      gap={2}
      sx={{ position: 'relative', zIndex: 1 }}
    >
      <Autocomplete
        options={options}
        width={width}
        label={label}
        value={selectedOption}
        onChange={handleChange}
        onInputChange={(event, newInputValue, reason) => {
          // Only update search when the user is typing, not on selection/reset —
          // otherwise the full label string becomes the query and filters everything out
          if (reason === 'input') {
            setSearchQuery(newInputValue);
          } else if (reason === 'clear') {
            setSearchQuery('');
          }
        }}
        isOptionEqualToValue={(opt, val) => String(opt?.id) === String(val?.id)}
        getOptionLabel={(option) => option?.label ?? ''}
        loading={loading}
        disablePortal={false}
      />
    </Box>
  );
};

export default MaintenanceSelect;
