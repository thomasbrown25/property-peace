import { useState, useEffect, useMemo, useRef } from 'react';
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
  Tooltip,
  TextField,
  InputAdornment,
  CircularProgress,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Menu,
  Checkbox,
  FormControlLabel,
  Chip,
  MenuList,
  ListItemText
} from '@mui/material';
import MainCard from 'components/MainCard';
import FilterDeleteIcon from 'components/FilterDeleteIcon';
import {
  UploadOutlined,
  SearchOutlined,
  MoreOutlined,
  FileTextOutlined,
  CalendarOutlined,
  DownOutlined,
  PlusOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  CheckOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { openSnackbar } from 'api/snackbar';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { selectUnit } from 'store/unit/unit.selector';
import { setUnit } from 'store/unit/unit.action';
import useFetchProperties from 'hooks/useFetchProperties';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { formatDate } from 'utils/formatters';
import { fileAPI, fileCategoryAPI } from 'api';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

export default function Documents() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const { properties } = useFetchProperties();

  const [files, setFiles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [sortField, setSortField] = useState('lastModified');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  
  // Timespan filter - default to Last 60 days
  const getDefaultTimespan = () => {
    const now = new Date();
    const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    return {
      timespan: '60days',
      dateFrom: last60Days,
      dateTo: now
    };
  };
  const [timespanFilter, setTimespanFilter] = useState(getDefaultTimespan());
  const timespanChipRef = useRef(null);
  
  // Filter menu states
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [clickedChipFilter, setClickedChipFilter] = useState(null); // Track which chip filter was clicked

  // Modals
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [categoriesDialogOpen, setCategoriesDialogOpen] = useState(false);
  const [fileMenuAnchor, setFileMenuAnchor] = useState(null);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [selectedCategoryForUpload, setSelectedCategoryForUpload] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Category management
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  // Auto-select first unit when property changes
  useEffect(() => {
    if (selectedProperty?.units && selectedProperty.units.length > 0) {
      // Only auto-select if no unit is currently selected or if the selected unit is not part of the current property
      if (!selectedUnit || !selectedProperty.units.find(u => u.id === selectedUnit.id)) {
        const firstUnit = selectedProperty.units[0];
        dispatch(setUnit(firstUnit));
      }
    } else if (!selectedProperty) {
      // Clear unit selection when property is cleared
      dispatch(setUnit(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty, dispatch]); // selectedUnit intentionally omitted to prevent infinite loops

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const filters = {
        propertyId: selectedProperty?.id || null,
        unitId: selectedUnit?.id || null,
        categoryId: categoryFilter !== 'all' ? parseInt(categoryFilter) : null
      };

      // Use timespan filter dates
      if (timespanFilter?.dateFrom && timespanFilter?.dateTo) {
        filters.startDate = timespanFilter.dateFrom.toISOString().split('T')[0];
        filters.endDate = timespanFilter.dateTo.toISOString().split('T')[0];
      }

      const response = await fileAPI.getFiles(filters);
      if (response.success) {
        setFiles(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
      openSnackbar({
        open: true,
        message: 'Failed to load documents',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fileCategoryAPI.getFileCategories();
      if (response.success) {
        setCategories(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  // Initial load - fetch files and categories on mount
  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      try {
        await Promise.all([fetchFiles(), fetchCategories()]);
      } finally {
        setInitialLoading(false);
      }
    };
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subsequent loads - refetch when filters change (but not on initial mount)
  useEffect(() => {
    if (!initialLoading) {
      fetchFiles();
      fetchCategories();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, timespanFilter, selectedProperty, selectedUnit]);

  const handleUpload = async (fileList) => {
    if (!selectedCategoryForUpload || selectedCategoryForUpload === '') {
      openSnackbar({
        open: true,
        message: 'Please select a category for the file(s)',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    try {
      setUploading(true);
      const filesArray = Array.from(fileList);
      const response = await fileAPI.uploadFiles(filesArray, {
        categoryId: selectedCategoryForUpload !== 'all' ? parseInt(selectedCategoryForUpload) : null,
        propertyId: selectedProperty?.id || null,
        unitId: selectedUnit?.id || null
      });

      if (response.success) {
        openSnackbar({
          open: true,
          message: `Successfully uploaded ${response.data.length} file(s)`,
          variant: 'alert',
          alert: { color: 'success' }
        });
        setUploadDialogOpen(false);
        setSelectedCategoryForUpload('');
        fetchFiles();
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to upload files',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (id) => {
    try {
      const response = await fileAPI.deleteFile(id);
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Document deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setSelectedFiles([]);
        fetchFiles();
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      openSnackbar({
        open: true,
        message: 'Failed to delete document',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
    setFileMenuAnchor(null);
  };

  const handleBulkDelete = async () => {
    if (selectedFiles.length === 0) return;

    setDeleting(true);
    try {
      // Delete all selected files
      const deletePromises = selectedFiles.map((id) => fileAPI.deleteFile(id));
      const results = await Promise.allSettled(deletePromises);

      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
      const failCount = results.length - successCount;

      if (successCount > 0) {
        openSnackbar({
          open: true,
          message: `Successfully deleted ${successCount} document(s)${failCount > 0 ? `. ${failCount} failed.` : ''}`,
          variant: 'alert',
          alert: { color: successCount === selectedFiles.length ? 'success' : 'warning' }
        });
        setSelectedFiles([]);
        fetchFiles();
      } else {
        openSnackbar({
          open: true,
          message: 'Failed to delete documents',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error deleting files:', error);
      openSnackbar({
        open: true,
        message: 'Failed to delete documents',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    try {
      const response = await fileCategoryAPI.addFileCategory({ name: newCategoryName.trim() });
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Category added successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setNewCategoryName('');
        fetchCategories();
      }
    } catch (error) {
      console.error('Error adding category:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to add category',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleUpdateCategory = async (id) => {
    if (!editingCategoryName.trim()) return;

    try {
      const response = await fileCategoryAPI.updateFileCategory(id, { name: editingCategoryName.trim() });
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Category updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setEditingCategoryId(null);
        setEditingCategoryName('');
        fetchCategories();
      }
    } catch (error) {
      console.error('Error updating category:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to update category',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      const response = await fileCategoryAPI.deleteFileCategory(id);
      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Category deleted successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        fetchCategories();
      }
    } catch (error) {
      console.error('Error deleting category:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete category',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    sorted.sort((a, b) => {
      let aValue, bValue;
      if (sortField === 'lastModified') {
        aValue = a.updatedAt || a.createdAt;
        bValue = b.updatedAt || b.createdAt;
      } else if (sortField === 'title') {
        aValue = a.title?.toLowerCase() || '';
        bValue = b.title?.toLowerCase() || '';
      } else {
        return 0;
      }

      if (sortField === 'lastModified') {
        return sortOrder === 'asc'
          ? new Date(aValue) - new Date(bValue)
          : new Date(bValue) - new Date(aValue);
      } else {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }
    });
    return sorted;
  }, [files, sortField, sortOrder]);

  const filteredFiles = useMemo(() => {
    return sortedFiles;
  }, [sortedFiles]);

  const matchCount = filteredFiles.length;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Documents' }
          ]}
        />

        {initialLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight={700}>
            Documents
          </Typography>
          <Button
            variant="text"
            startIcon={<UploadOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />}
            onClick={() => setUploadDialogOpen(true)}
            sx={{
              color: 'primary.main',
              textTransform: 'none',
              minWidth: 'auto',
              px: 1,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            Upload account file
          </Button>
        </Stack>

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
              <PropertySelect width={250} />
              <UnitSelect width={250} />

              <FormControl size="small" sx={{ minWidth: 200 }}>
                <InputLabel>CATEGORY</InputLabel>
                <Select
                  value={categoryFilter}
                  label="CATEGORY"
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <MenuItem value="all">All Categories</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Timespan Filter Chip */}
              {timespanFilter && (
                <Box ref={timespanChipRef}>
                  <Chip
                    label={`Timespan: ${timespanFilter?.timespan === '60days' ? 'Last 60 days' : 'Custom'}`}
                    onClick={(e) => {
                      setClickedChipFilter('timespan');
                      setActiveSubMenu('timespan');
                      setFilterAnchorEl(e.currentTarget);
                      setSubMenuAnchorEl(e.currentTarget);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      setTimespanFilter(null);
                      setStartDate(null);
                      setEndDate(null);
                    }}
                    deleteIcon={<FilterDeleteIcon fontSize={10} />}
                    size="small"
                    variant="outlined"
                    sx={{
                      flexShrink: 0,
                      cursor: 'pointer',
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
                </Box>
              )}
            </Box>
            {/* Add Filters Button Box */}
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
            {/* Timespan Filter */}
            <MenuItem
              onClick={(e) => {
                setActiveSubMenu('timespan');
                setSubMenuAnchorEl(e.currentTarget);
              }}
            >
              <ListItemText primary="Timespan" />
              {timespanFilter && (
                <Typography variant="caption" color="primary" sx={{ ml: 1 }}>
                  {timespanFilter?.timespan === '60days' ? 'Last 60 days' : 'Custom'}
                </Typography>
              )}
            </MenuItem>
          </MenuList>
        </Menu>

        {/* Submenu for Filter Options */}
        <Menu
          anchorEl={subMenuAnchorEl}
          open={Boolean(subMenuAnchorEl) && activeSubMenu === 'timespan'}
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
            {activeSubMenu === 'timespan' && (
              <>
                <MenuItem
                  onClick={() => {
                    const now = new Date();
                    const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
                    setTimespanFilter({
                      timespan: '60days',
                      dateFrom: last60Days,
                      dateTo: now
                    });
                    setSubMenuAnchorEl(null);
                    setActiveSubMenu(null);
                    setFilterAnchorEl(null);
                    setClickedChipFilter(null);
                  }}
                  selected={timespanFilter?.timespan === '60days'}
              >
                <ListItemText primary="Last 60 days" />
              </MenuItem>
                <MenuItem
                  onClick={() => {
                    const now = new Date();
                    const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
                    setTimespanFilter({
                      timespan: 'custom',
                      dateFrom: last60Days,
                      dateTo: now,
                      customStartDate: last60Days,
                      customEndDate: now
                    });
                    setStartDate(last60Days);
                    setEndDate(now);
                    // Keep submenu open for custom date pickers
                  }}
                  selected={timespanFilter?.timespan === 'custom'}
                >
                  <ListItemText primary="Custom" />
                </MenuItem>
              </>
            )}
          </MenuList>
        </Menu>

        {/* Custom date pickers submenu for timespan */}
        {timespanFilter?.timespan === 'custom' && activeSubMenu === 'timespan' && (
          <Menu
            anchorEl={subMenuAnchorEl}
            open={Boolean(subMenuAnchorEl) && activeSubMenu === 'timespan'}
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
            <Paper sx={{ p: 2, minWidth: 320 }}>
              <Stack spacing={2}>
                <DatePicker
                  label="From Date"
                  value={startDate}
                  onChange={(newDate) => {
                    setStartDate(newDate);
                    setTimespanFilter(prev => ({
                      ...prev,
                      dateFrom: newDate,
                      customStartDate: newDate
                    }));
                  }}
                  slotProps={{ textField: { size: 'small', fullWidth: true, InputLabelProps: { shrink: true } } }}
                />
                <DatePicker
                  label="To Date"
                  value={endDate}
                  onChange={(newDate) => {
                    setEndDate(newDate);
                    setTimespanFilter(prev => ({
                      ...prev,
                      dateTo: newDate,
                      customEndDate: newDate
                    }));
                  }}
                  slotProps={{ textField: { size: 'small', fullWidth: true, InputLabelProps: { shrink: true } } }}
                />
              </Stack>
            </Paper>
          </Menu>
        )}

        {/* Results Summary and Bulk Actions */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            {matchCount} matches
          </Typography>
          {selectedFiles.length > 0 && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">
                {selectedFiles.length} selected
              </Typography>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlined />}
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleting}
                size="small"
              >
                Delete Selected
              </Button>
            </Stack>
          )}
        </Stack>

        {/* Files Table */}
        <MainCard
          sx={{
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            borderRadius: 2
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selectedFiles.length > 0 && selectedFiles.length < filteredFiles.length}
                      checked={filteredFiles.length > 0 && selectedFiles.length === filteredFiles.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedFiles(filteredFiles.map((f) => f.id));
                        } else {
                          setSelectedFiles([]);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>TITLE</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>SHARING</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>CATEGORY</TableCell>
                  <TableCell
                    sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => handleSort('lastModified')}
                  >
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <span>LAST MODIFIED BY</span>
                      {sortField === 'lastModified' && (
                        sortOrder === 'asc' ? <DownOutlined style={{ fontSize: 12 }} /> : <DownOutlined style={{ fontSize: 12, transform: 'rotate(180deg)' }} />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : filteredFiles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">No documents found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFiles.map((file) => (
                    <TableRow key={file.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedFiles.includes(file.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedFiles([...selectedFiles, file.id]);
                            } else {
                              setSelectedFiles(selectedFiles.filter((id) => id !== file.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <FileTextOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                          <Typography>{file.title || 'Lease document'}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        {/* Sharing info would go here */}
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={file.categoryName || 'Uncategorized'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {file.updatedAt
                          ? `${formatDate(file.updatedAt)} by ${file.updatedByName || file.createdByName || 'Unknown'}`
                          : file.createdAt
                          ? `${formatDate(file.createdAt)} by ${file.createdByName || 'Unknown'}`
                          : '—'}
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setFileMenuAnchor(e.currentTarget);
                            setSelectedFileId(file.id);
                          }}
                        >
                          <MoreOutlined />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </MainCard>

        {/* File Menu */}
        <Menu
          anchorEl={fileMenuAnchor}
          open={Boolean(fileMenuAnchor)}
          onClose={() => setFileMenuAnchor(null)}
        >
          <MenuItem
            onClick={() => {
              if (selectedFileId) {
                const file = files.find((f) => f.id === selectedFileId);
                if (file?.blobUrl) {
                  window.open(file.blobUrl, '_blank');
                }
              }
              setFileMenuAnchor(null);
            }}
          >
            View
          </MenuItem>
          <MenuItem
            onClick={() => {
              if (selectedFileId) {
                handleDeleteFile(selectedFileId);
              }
            }}
          >
            Delete
          </MenuItem>
        </Menu>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Upload Account File</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ mt: 1 }}>
              <FormControl fullWidth required>
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategoryForUpload}
                  label="Category"
                  onChange={(e) => setSelectedCategoryForUpload(e.target.value)}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id.toString()}>
                      {cat.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <input
                type="file"
                multiple
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleUpload(e.target.files);
                  }
                }}
                style={{ display: 'none' }}
                id="file-upload-input"
              />
              <label htmlFor="file-upload-input">
                <Button
                  variant="outlined"
                  component="span"
                  fullWidth
                  startIcon={<UploadOutlined />}
                  sx={{ py: 2 }}
                >
                  Select Files
                </Button>
              </label>
              {uploading && (
                <Box sx={{ textAlign: 'center' }}>
                  <CircularProgress />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Uploading...
                  </Typography>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setUploadDialogOpen(false);
              setSelectedCategoryForUpload('');
            }}>Cancel</Button>
          </DialogActions>
        </Dialog>

        {/* Bulk Delete Confirmation Dialog */}
        <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
          <DialogTitle>Delete Selected Documents</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete {selectedFiles.length} selected document(s)? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button onClick={handleBulkDelete} color="error" variant="contained" disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Manage Categories Dialog */}
        <Dialog open={categoriesDialogOpen} onClose={() => setCategoriesDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Manage file categories</DialogTitle>
          <DialogContent>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, textTransform: 'uppercase', fontFamily: "'Poppins', sans-serif" }}>CATEGORY NAME</TableCell>
                    <TableCell sx={{ fontWeight: 600, textTransform: 'uppercase', fontFamily: "'Poppins', sans-serif" }}>DETAILS</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>
                        {editingCategoryId === category.id ? (
                          <TextField
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            size="small"
                            autoFocus
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateCategory(category.id);
                              }
                            }}
                          />
                        ) : (
                          <Typography>{category.name}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {category.fileCount === 0
                            ? 'No files are assigned to this category'
                            : `${category.fileCount} file${category.fileCount !== 1 ? 's' : ''} are assigned to this category`}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {editingCategoryId === category.id ? (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              onClick={() => handleUpdateCategory(category.id)}
                              color="primary"
                            >
                              <CheckOutlined />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingCategoryId(null);
                                setEditingCategoryName('');
                              }}
                            >
                              <CloseOutlined />
                            </IconButton>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditingCategoryId(category.id);
                                setEditingCategoryName(category.name);
                              }}
                            >
                              <EditOutlined />
                            </IconButton>
                            {category.fileCount === 0 && (
                              <IconButton
                                size="small"
                                onClick={() => handleDeleteCategory(category.id)}
                                color="error"
                              >
                                <DeleteOutlined />
                              </IconButton>
                            )}
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Divider sx={{ my: 2 }} />

            <Stack direction="row" spacing={1} alignItems="center">
              <PlusOutlined />
              <TextField
                placeholder="Add a new category"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                size="small"
                fullWidth
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleAddCategory();
                  }
                }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCategoriesDialogOpen(false)} variant="outlined">
              Cancel
            </Button>
            <Button onClick={() => setCategoriesDialogOpen(false)} variant="contained" color="primary">
              Save
            </Button>
          </DialogActions>
        </Dialog>
          </>
        )}
      </Box>
    </LocalizationProvider>
  );
}
