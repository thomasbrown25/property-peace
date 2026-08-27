import { useState, useEffect, useRef } from 'react';
// material-ui
import {
  Box,
  FormControl,
  InputAdornment,
  OutlinedInput,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Typography,
  Divider,
  CircularProgress,
  alpha
} from '@mui/material';

// assets
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';

// hooks
import { useGlobalSearch } from 'api/search';
import { useNavigate } from 'react-router-dom';
import { useDebounce } from 'hooks/useDebounce';

// ==============================|| HEADER CONTENT - SEARCH ||============================== //

export default function Search({ shrink = false }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);
  const debouncedQuery = useDebounce(searchQuery, 300);
  
  const { searchResults, searchLoading } = useGlobalSearch(debouncedQuery, 10);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setIsOpen(value.length > 0);
  };

  const handleResultClick = (type, id) => {
    setIsOpen(false);
    setSearchQuery('');
    
    switch (type) {
      case 'property':
        navigate(`/landlord/property/${id}`);
        break;
      case 'tenant':
        navigate(`/landlord/tenants/${id}`);
        break;
      case 'lease':
        navigate(`/landlord/leases/${id}`);
        break;
      default:
        break;
    }
  };


  const hasResults = searchResults && (
    (searchResults.properties && searchResults.properties.length > 0) ||
    (searchResults.tenants && searchResults.tenants.length > 0) ||
    (searchResults.leases && searchResults.leases.length > 0)
  );

  return (
    <Box
      ref={searchRef}
      display="flex"
      justifyContent="center"
      alignItems="center"
      sx={{ width: '100%', ml: { xs: 0, md: 1 }, position: 'relative' }}
    >
      <Box sx={{ position: 'relative', width: { xs: '100%', sm: shrink ? 460 : 500, md: shrink ? 620 : 700 }, transition: 'width 160ms ease' }}>
        <FormControl sx={{ width: '100%' }}>
          <OutlinedInput
            size="small"
            id="header-search"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={() => {
              if (searchQuery.length > 0) {
                setIsOpen(true);
              }
            }}
            startAdornment={
              <InputAdornment position="start" sx={{ mr: -0.5 }}>
                {searchLoading ? <CircularProgress size={16} /> : <SearchOutlined style={{ fontSize: 16 }} />}
              </InputAdornment>
            }
            aria-describedby="header-search-text"
            slotProps={{
              input: {
                'aria-label': 'Search properties, tenants, and leases'
              }
            }}
            placeholder="Search properties, tenants, leases..."
            sx={{
              bgcolor: 'background.paper',
              borderRadius: 1.5,
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.3),
                borderWidth: '1.5px'
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: (theme) => alpha(theme.palette.primary.main, 0.5)
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: 'primary.main',
                borderWidth: '2px'
              },
              boxShadow: (theme) => `0 1px 4px ${alpha(theme.palette.primary.main, 0.08)}`
            }}
          />
        </FormControl>

        {/* Dropdown Content */}
        {isOpen && (
          <Paper
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              mt: 0.5,
              maxHeight: 500,
              overflow: 'auto',
              zIndex: 1300,
              boxShadow: (theme) => theme.customShadows.z1,
              width: '100%'
            }}
          >
            {searchLoading ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <CircularProgress size={24} />
              </Box>
            ) : hasResults ? (
              <List sx={{ p: 0 }}>
                {/* Properties */}
                {searchResults.properties && searchResults.properties.length > 0 && (
                  <>
                    <ListItem sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), py: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={600} color="primary">
                        Properties ({searchResults.properties.length})
                      </Typography>
                    </ListItem>
                    {searchResults.properties.map((property) => (
                      <ListItem key={property.id} disablePadding>
                        <ListItemButton onClick={() => handleResultClick('property', property.id)}>
                          <ListItemIcon>
                            <HomeOutlined style={{ fontSize: 18, color: '#1877F2' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={property.name}
                            secondary={property.address || property.propertyType}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                    {(searchResults.tenants?.length > 0 || searchResults.leases?.length > 0) && <Divider />}
                  </>
                )}

                {/* Tenants */}
                {searchResults.tenants && searchResults.tenants.length > 0 && (
                  <>
                    <ListItem sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), py: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={600} color="primary">
                        Tenants ({searchResults.tenants.length})
                      </Typography>
                    </ListItem>
                    {searchResults.tenants.map((tenant) => (
                      <ListItem key={tenant.id} disablePadding>
                        <ListItemButton onClick={() => handleResultClick('tenant', tenant.id)}>
                          <ListItemIcon>
                            <UserOutlined style={{ fontSize: 18, color: '#41a541' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${tenant.firstname} ${tenant.lastname}`}
                            secondary={
                              tenant.propertyName && tenant.unitName
                                ? `${tenant.propertyName} - ${tenant.unitName}`
                                : tenant.propertyName || tenant.email
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                    {searchResults.leases?.length > 0 && <Divider />}
                  </>
                )}

                {/* Leases */}
                {searchResults.leases && searchResults.leases.length > 0 && (
                  <>
                    <ListItem sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), py: 0.5 }}>
                      <Typography variant="subtitle2" fontWeight={600} color="primary">
                        Leases ({searchResults.leases.length})
                      </Typography>
                    </ListItem>
                    {searchResults.leases.map((lease) => (
                      <ListItem key={lease.id} disablePadding>
                        <ListItemButton onClick={() => handleResultClick('lease', lease.id)}>
                          <ListItemIcon>
                            <FileTextOutlined style={{ fontSize: 18, color: '#faad14' }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={`${lease.propertyName}${lease.unitName ? ` - ${lease.unitName}` : ''}`}
                            secondary={
                              lease.tenantNames && lease.tenantNames.length > 0
                                ? `Tenants: ${lease.tenantNames.join(', ')}`
                                : `Rent: $${lease.rentAmount.toFixed(2)}`
                            }
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </>
                )}
              </List>
            ) : debouncedQuery.length > 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No results found
                </Typography>
              </Box>
            ) : null}
          </Paper>
        )}
      </Box>
    </Box>
  );
}
