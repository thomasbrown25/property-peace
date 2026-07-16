import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Stack,
  Typography,
  alpha,
  useTheme,
  Menu,
  MenuItem,
  Fade,
  FormControl,
  Select,
  Button
} from '@mui/material';
import {
  HomeOutlined,
  MoreOutlined,
  EnvironmentOutlined,
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { getPropertyTypeLabel } from 'utils/formatters';
import PropertyEditDrawer from 'components/drawers/PropertyEditDrawer';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { deleteProperty, setProperty } from 'store/property/property.action';
import { useDrawer } from 'contexts/DrawerContext';
import SortableTableHeader from 'components/table/SortableTableHeader';
import { sortByString, sortByDate, sortByArrayLength } from 'utils/table-sort';

export default function PropertiesTableView({ 
  properties, 
  onRefresh,
  defaultSortField = 'name',
  defaultSortOrder = 'asc'
}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [sortField, setSortField] = useState(defaultSortField);
  const [sortOrder, setSortOrder] = useState(defaultSortOrder);
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const handleMenuClick = (e, property) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
    setSelectedProperty(property);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProperty(null);
  };

  const handleView = () => {
    if (selectedProperty) {
      navigate(`/landlord/property/${selectedProperty.id}`);
    }
    handleMenuClose();
  };

  const handleEdit = () => {
    if (selectedProperty) {
      dispatch(setProperty(selectedProperty));
      drawer.openPropertyEditDrawer();
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    setOpenConfirm(true);
    handleMenuClose();
  };

  const handleConfirmDelete = async () => {
    if (selectedProperty) {
      await dispatch(deleteProperty(selectedProperty.id));
      dispatch(setProperty(null));
      if (onRefresh) {
        onRefresh();
      }
    }
    setOpenConfirm(false);
    setSelectedProperty(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return isNaN(d.getTime()) ? String(dateString) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Handle sort column click
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field and default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Sort properties based on sortField and sortOrder
  const sortedProperties = useMemo(() => {
    if (!properties || properties.length === 0) return [];
    
    return [...properties].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = sortByString(a, b, 'name');
          break;
        case 'address':
          comparison = sortByString(a, b, 'streetAddress');
          break;
        case 'type':
          const aType = getPropertyTypeLabel(a.propertyType) || '';
          const bType = getPropertyTypeLabel(b.propertyType) || '';
          comparison = aType.toLowerCase().localeCompare(bType.toLowerCase());
          break;
        case 'units':
          comparison = sortByArrayLength(a, b, 'units');
          break;
        case 'status':
          // Sort by occupied status: occupied (true) comes before vacant (false)
          const aOccupied = a.isOccupied ? 0 : 1;
          const bOccupied = b.isOccupied ? 0 : 1;
          comparison = aOccupied - bOccupied;
          break;
        case 'dateListed':
          comparison = sortByDate(a, b, 'dateListed');
          break;
        default:
          return 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [properties, sortField, sortOrder]);

  // Pagination calculations
  const totalPages = Math.ceil(sortedProperties.length / itemsPerPage);
  const paginatedProperties = useMemo(() => {
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedProperties.slice(startIndex, endIndex);
  }, [sortedProperties, page, itemsPerPage]);

  // Reset to first page when items per page changes
  useEffect(() => {
    setPage(0);
  }, [itemsPerPage]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  return (
    <>
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <SortableTableHeader
                field="name"
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={() => handleSort('name')}
              >
                Property Name
              </SortableTableHeader>
              <SortableTableHeader
                field="address"
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={() => handleSort('address')}
              >
                Address
              </SortableTableHeader>
              <SortableTableHeader
                field="type"
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={() => handleSort('type')}
              >
                Type
              </SortableTableHeader>
              <SortableTableHeader
                field="units"
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={() => handleSort('units')}
              >
                Units
              </SortableTableHeader>
              <SortableTableHeader
                field="status"
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={() => handleSort('status')}
              >
                Status
              </SortableTableHeader>
              <SortableTableHeader
                field="dateListed"
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={() => handleSort('dateListed')}
              >
                Date Listed
              </SortableTableHeader>
              <TableCell sx={{ fontWeight: 600 }} align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedProperties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No properties found.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedProperties.map((property) => (
                <TableRow
                  key={property.id}
                  hover
                  sx={{
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04)
                    }
                  }}
                  onClick={() => navigate(`/landlord/property/${property.id}`)}
                >
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <HomeOutlined style={{ fontSize: 16, color: '#722ed1' }} />
                      <Typography variant="body2" fontWeight={500}>
                        {property.name?.trim() || property.streetAddress?.trim() || 'Untitled Property'}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <EnvironmentOutlined style={{ fontSize: 14, opacity: 0.7 }} />
                      <Typography variant="body2" color="text.secondary">
                        {(() => {
                          if (!property.streetAddress) return 'No address';
                          
                          // Split street address to get only the street part (remove zip code if present)
                          let streetOnly = property.streetAddress;
                          if (property.streetAddress.includes(',')) {
                            // If there's a comma, take the part before it (the actual street address)
                            const parts = property.streetAddress.split(',');
                            streetOnly = parts[0].trim();
                          } else {
                            // If no comma, check if it ends with a zip code pattern (5 digits)
                            const zipCodePattern = /\s+\d{5}(-\d{4})?$/;
                            if (zipCodePattern.test(property.streetAddress)) {
                              streetOnly = property.streetAddress.replace(zipCodePattern, '').trim();
                            }
                          }
                          
                          const addressParts = [streetOnly];
                          if (property.city) addressParts.push(property.city);
                          if (property.state) addressParts.push(property.state);
                          return addressParts.join(', ');
                        })()}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={getPropertyTypeLabel(property.propertyType)} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {property.units?.length || 0}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Chip
                        size="small"
                        label={property.isOccupied ? 'Occupied' : 'Vacant'}
                        color={property.isOccupied ? 'success' : 'default'}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={property.isActive ? 'Active' : 'Inactive'}
                        color={property.isActive ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(property.dateListed)}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={(e) => handleMenuClick(e, property)}>
                      <MoreOutlined />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {sortedProperties.length > 0 && (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 3,
            pt: 2,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
          }}
        >
          {/* Items per page dropdown */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Items per page:
            </Typography>
            <FormControl size="small" sx={{ minWidth: 80 }}>
              <Select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                sx={{ height: 32 }}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={20}>20</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Page navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Page {page + 1} of {totalPages}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<LeftOutlined />}
                onClick={() => handlePageChange(Math.max(0, page - 1))}
                disabled={page === 0}
                sx={{ minWidth: 100 }}
              >
                Previous
              </Button>
              <Button
                size="small"
                variant="outlined"
                endIcon={<RightOutlined />}
                onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                sx={{ minWidth: 100 }}
              >
                Next
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        slots={{ transition: Fade }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleView}>
          <EyeOutlined style={{ marginRight: 8 }} />
          View
        </MenuItem>
        <MenuItem onClick={handleEdit}>
          <EditOutlined style={{ marginRight: 8 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <DeleteOutlined style={{ marginRight: 8, color: '#d32f2f' }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={openConfirm}
        onClose={() => {
          setOpenConfirm(false);
          setSelectedProperty(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Confirm Property Deletion"
        message={selectedProperty ? `Are you sure you want to delete property ${selectedProperty.name?.trim() || selectedProperty.streetAddress?.trim() || 'Property'}? This will also delete the associated lease, units, and tenant records.` : 'Are you sure you want to delete this property?'}
        confirmText="Delete Property"
      />

      <PropertyEditDrawer />
    </>
  );
}

