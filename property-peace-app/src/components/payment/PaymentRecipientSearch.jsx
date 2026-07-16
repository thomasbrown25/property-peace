import { useState, useEffect, useRef, useMemo } from 'react';
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
  alpha,
  Popper
} from '@mui/material';
import SearchOutlined from '@ant-design/icons/SearchOutlined';
import HomeOutlined from '@ant-design/icons/HomeOutlined';
import UserOutlined from '@ant-design/icons/UserOutlined';
import { useGlobalSearch } from 'api/search';
import { useDebounce } from 'hooks/useDebounce';
import { useSelector } from 'react-redux';
import { selectProperties } from 'store/property/property.selector';
import { selectTenants } from 'store/tenant/tenant.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchAllTenants from 'hooks/useFetchAllTenants';

export default function PaymentRecipientSearch({ onSelect, selectedItem }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef(null);
  const popperRef = useRef(null);
  const debouncedQuery = useDebounce(searchQuery, 300);
  
  // Fetch all properties and tenants for preview
  useFetchProperties();
  useFetchAllTenants();
  const properties = useSelector(selectProperties);
  const tenants = useSelector(selectTenants);
  
  const { searchResults, searchLoading } = useGlobalSearch(debouncedQuery, 50);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current && 
        !searchRef.current.contains(event.target) &&
        popperRef.current &&
        !popperRef.current.contains(event.target)
      ) {
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
    setIsOpen(true); // Keep open when typing
  };

  const handleResultClick = (type, item, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setIsOpen(false);
    setSearchQuery('');
    onSelect(type, item);
  };

  // Format properties for display
  const formattedProperties = useMemo(() => {
    if (!properties) return [];
    return properties.map(p => ({
      id: p.id,
      name: p.name,
      address: p.streetAddress || '',
      propertyType: p.propertyType
    }));
  }, [properties]);

  // Format tenants for display
  const formattedTenants = useMemo(() => {
    if (!tenants) return [];
    return tenants.map(t => ({
      id: t.id,
      firstname: t.firstname || '',
      lastname: t.lastname || '',
      email: t.email || '',
      propertyName: t.propertyName || '',
      unitName: t.unitName || '',
      propertyId: t.propertyId,
      userId: t.userId
    }));
  }, [tenants]);

  // Filter properties and tenants based on search query
  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return formattedProperties.slice(0, 20); // Limit preview to 20
    const query = searchQuery.toLowerCase();
    return formattedProperties.filter(p => 
      p.name.toLowerCase().includes(query) ||
      (p.address && p.address.toLowerCase().includes(query))
    );
  }, [formattedProperties, searchQuery]);

  const filteredTenants = useMemo(() => {
    if (!searchQuery.trim()) return formattedTenants.slice(0, 20); // Limit preview to 20
    const query = searchQuery.toLowerCase();
    return formattedTenants.filter(t => 
      (t.firstname && t.firstname.toLowerCase().includes(query)) ||
      (t.lastname && t.lastname.toLowerCase().includes(query)) ||
      (t.email && t.email.toLowerCase().includes(query)) ||
      (t.propertyName && t.propertyName.toLowerCase().includes(query))
    );
  }, [formattedTenants, searchQuery]);

  // Use search results if query exists, otherwise use filtered local data
  const displayProperties = debouncedQuery.trim() && searchResults?.properties 
    ? searchResults.properties 
    : filteredProperties;
  const displayTenants = debouncedQuery.trim() && searchResults?.tenants 
    ? searchResults.tenants 
    : filteredTenants;

  const hasResults = (displayProperties && displayProperties.length > 0) ||
    (displayTenants && displayTenants.length > 0);

  const [anchorEl, setAnchorEl] = useState(null);

  useEffect(() => {
    if (searchRef.current) {
      setAnchorEl(searchRef.current);
    }
  }, []);

  return (
    <Box
      ref={searchRef}
      sx={{ position: 'relative', width: '100%' }}
    >
      <FormControl sx={{ width: '100%' }}>
        <OutlinedInput
          fullWidth
          size="medium"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => {
            setIsOpen(true); // Always show dropdown on focus
          }}
          startAdornment={
            <InputAdornment position="start" sx={{ mr: -0.5 }}>
              {searchLoading ? <CircularProgress size={20} /> : <SearchOutlined />}
            </InputAdornment>
          }
          placeholder="Search for tenant or property..."
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              fontSize: '1rem'
            }
          }}
        />
      </FormControl>

      {/* Dropdown Content using Popper to avoid overflow clipping */}
      <Popper
        open={isOpen}
        anchorEl={anchorEl}
        placement="bottom-start"
        disablePortal={false}
        sx={{ 
          zIndex: 1300,
          width: anchorEl ? `${anchorEl.offsetWidth}px` : 'auto'
        }}
        modifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 4]
            }
          }
        ]}
      >
        <Paper
          ref={popperRef}
          sx={{
            maxHeight: 400,
            overflow: 'auto',
            boxShadow: (theme) => theme.customShadows.z1,
            width: '100%',
            mt: 0.5
          }}
        >
          {searchLoading && debouncedQuery.trim() ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : hasResults ? (
            <List sx={{ p: 0 }}>
              {/* Properties */}
              {displayProperties && displayProperties.length > 0 && (
                <>
                  <ListItem sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), py: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="primary">
                      Properties ({displayProperties.length})
                    </Typography>
                  </ListItem>
                  {displayProperties.map((property) => (
                    <ListItem key={property.id} disablePadding>
                      <ListItemButton 
                        onMouseDown={(e) => handleResultClick('property', property, e)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
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
                  {displayTenants?.length > 0 && <Divider />}
                </>
              )}

              {/* Tenants */}
              {displayTenants && displayTenants.length > 0 && (
                <>
                  <ListItem sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), py: 0.5 }}>
                    <Typography variant="subtitle2" fontWeight={600} color="primary">
                      Tenants ({displayTenants.length})
                    </Typography>
                  </ListItem>
                  {displayTenants.map((tenant) => (
                    <ListItem key={tenant.id} disablePadding>
                      <ListItemButton 
                        onMouseDown={(e) => handleResultClick('tenant', tenant, e)}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <ListItemIcon>
                          <UserOutlined style={{ fontSize: 18, color: '#52c41a' }} />
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
                </>
              )}
            </List>
          ) : debouncedQuery.length > 0 ? (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No results found
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Start typing to search...
              </Typography>
            </Box>
          )}
        </Paper>
      </Popper>
    </Box>
  );
}
