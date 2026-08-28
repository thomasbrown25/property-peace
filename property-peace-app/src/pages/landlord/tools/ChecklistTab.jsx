import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Grid,
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  Alert,
  Menu,
  MenuList,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Card,
  CardContent
} from '@mui/material';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  HomeOutlined,
  FileTextOutlined,
  FilterOutlined,
  CloseOutlined,
  ExclamationCircleOutlined,
  CheckSquareOutlined,
  AlertOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainCard from 'components/MainCard';
import FilterDeleteIcon from 'components/FilterDeleteIcon';
import useAuth from 'hooks/useAuth';
import { formatDate } from 'utils/formatters';
import { checklistAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import PropertySelect from 'components/PropertySelect';
import { useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';

// Checklist type constants
const CHECKLIST_TYPES = {
  MOVE_IN: 40,
  MOVE_OUT: 41
};

const CHECKLIST_TYPE_LABELS = {
  [CHECKLIST_TYPES.MOVE_IN]: 'Move-In',
  [CHECKLIST_TYPES.MOVE_OUT]: 'Move-Out',
  40: 'Move-In',
  41: 'Move-Out'
};

function TabPanel({ value, index, children }) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ mt: 3 }}>
      {value === index && children}
    </Box>
  );
}

export default function ChecklistTab() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const { properties } = useFetchProperties();
  const selectedProperty = useSelector(selectProperty);

  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState(0);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [clickedChipFilter, setClickedChipFilter] = useState(null);

  // Load checklists
  useEffect(() => {
    if (user?.id || user?.Id) {
      loadChecklists();
    }
  }, [user]);

  const loadChecklists = async () => {
    try {
      setLoading(true);
      const userId = user?.id || user?.Id;
      if (!userId) {
        openSnackbar({
          open: true,
          message: 'User not found',
          variant: 'alert',
          alert: { color: 'error' }
        });
        return;
      }

      const response = await checklistAPI.getChecklistsByLandlord(userId);
      if (response?.success) {
        setChecklists(response.data || []);
      } else {
        openSnackbar({
          open: true,
          message: response?.message || 'Failed to load checklists',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error loading checklists:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to load checklists',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const active = checklists.filter(c => !c.isCompleted && c.items?.some(item => !item.isChecked));
    const completed = checklists.filter(c => c.isCompleted);
    const completedThisMonth = completed.filter(c => {
      if (!c.completedAt) return false;
      const completedDate = new Date(c.completedAt);
      return completedDate >= startOfMonth;
    });
    const overdue = active.filter(c => {
      // Check lease start date first
      const leaseStartDate = c.lease?.startDate || c.leaseStartDate;
      if (leaseStartDate) {
        const startDate = new Date(leaseStartDate);
        startDate.setHours(0, 0, 0, 0);
        // Only overdue if current date is after lease start date
        return now >= startDate;
      }
      // Fallback to inspection date
      if (c.inspectionDate) {
        const inspectionDate = new Date(c.inspectionDate);
        inspectionDate.setHours(0, 0, 0, 0);
        return inspectionDate < now;
      }
      return false;
    });

    return {
      active: active.length,
      overdue: overdue.length,
      completedThisMonth: completedThisMonth.length,
      total: checklists.length
    };
  }, [checklists]);

  // Filter checklists
  const filteredChecklists = useMemo(() => {
    let filtered = [...checklists];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => {
        const propertyName = c.property?.name || '';
        const unitName = c.unit?.name || '';
        const title = c.title || '';
        return (
          propertyName.toLowerCase().includes(query) ||
          unitName.toLowerCase().includes(query) ||
          title.toLowerCase().includes(query)
        );
      });
    }

    // Filter by type
    if (typeFilter !== 'all') {
      const typeValue = parseInt(typeFilter);
      filtered = filtered.filter(c => c.checklistType === typeValue);
    }

    // Filter by property (from Redux selector)
    if (selectedProperty) {
      filtered = filtered.filter(c => c.propertyId === selectedProperty.id);
    }

    // Filter by status
    if (statusFilter !== 'all') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (statusFilter === 'active') {
        filtered = filtered.filter(c => !c.isCompleted && c.items?.some(item => !item.isChecked));
      } else if (statusFilter === 'completed') {
        filtered = filtered.filter(c => c.isCompleted);
      } else if (statusFilter === 'overdue') {
        filtered = filtered.filter(c => {
          if (c.isCompleted) return false;
          // Check lease start date first
          const leaseStartDate = c.lease?.startDate || c.leaseStartDate;
          if (leaseStartDate) {
            const startDate = new Date(leaseStartDate);
            startDate.setHours(0, 0, 0, 0);
            // Only overdue if current date is after lease start date
            return now >= startDate;
          }
          // Fallback to inspection date
          if (c.inspectionDate) {
            const inspectionDate = new Date(c.inspectionDate);
            inspectionDate.setHours(0, 0, 0, 0);
            return inspectionDate < now;
          }
          return false;
        });
      }
    }

    // Filter by tab
    const tabTypes = ['all', 'move-in', 'move-out'];
    if (activeTab > 0) {
      const tabType = tabTypes[activeTab];
      if (tabType === 'move-in') {
        filtered = filtered.filter(c => c.checklistType === CHECKLIST_TYPES.MOVE_IN);
      } else if (tabType === 'move-out') {
        filtered = filtered.filter(c => c.checklistType === CHECKLIST_TYPES.MOVE_OUT);
      }
    }

    return filtered;
  }, [checklists, searchQuery, typeFilter, selectedProperty, statusFilter, activeTab]);

  const handleViewChecklist = (checklistId) => {
    navigate(`/landlord/checklist/${checklistId}`);
  };

  const handleCreateChecklist = () => {
    // Navigate to property selection or open dialog
    navigate('/landlord/properties');
  };

  const getChecklistProgress = (checklist) => {
    if (!checklist.items || checklist.items.length === 0) return { completed: 0, total: 0 };
    const completed = checklist.items.filter(item => item.isChecked).length;
    return { completed, total: checklist.items.length };
  };

  const getStatusChip = (checklist) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time for date comparison
    
    if (checklist.isCompleted) {
      return <Chip label="Completed" color="success" size="small" icon={<CheckCircleOutlined />} />;
    }
    
    // Check if checklist has a lease with start date
    const leaseStartDate = checklist.lease?.startDate || checklist.leaseStartDate;
    
    if (leaseStartDate) {
      const startDate = new Date(leaseStartDate);
      startDate.setHours(0, 0, 0, 0); // Reset time for date comparison
      
      // If current date is before lease start date, show "Incomplete" with warning
      if (now < startDate) {
        return <Chip label="Incomplete" color="warning" size="small" icon={<ExclamationCircleOutlined />} />;
      }
      
      // If current date is after lease start date and checklist is not completed, show "Overdue"
      if (now >= startDate) {
        return <Chip label="Overdue" color="error" size="small" icon={<ClockCircleOutlined />} />;
      }
    }
    
    // Fallback: check inspection date if no lease start date
    if (checklist.inspectionDate) {
      const inspectionDate = new Date(checklist.inspectionDate);
      inspectionDate.setHours(0, 0, 0, 0);
      if (inspectionDate < now) {
        return <Chip label="Overdue" color="error" size="small" icon={<ClockCircleOutlined />} />;
      }
    }
    
    return <Chip label="Active" color="primary" size="small" icon={<ClockCircleOutlined />} />;
  };

  return (
    <Box>
      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckSquareOutlined style={{ fontSize: 24, color: theme.palette.primary.main }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Active Checklists
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {stats.active}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <AlertOutlined style={{ fontSize: 24, color: theme.palette.error.main }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Overdue Checklists
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {stats.overdue}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Card
            variant="outlined"
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleOutlined style={{ fontSize: 24, color: theme.palette.success.main }} />
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    Completed This Month
                  </Typography>
                  <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
                    {stats.completedThisMonth}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Bar */}
      <MainCard
        sx={{
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          overflow: 'visible'
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
            alignItems: 'center',
            justifyContent: 'space-between',
            '@media (max-width: 912px)': {
              flexDirection: 'column',
              alignItems: 'stretch'
            }
          }}
        >
          {/* Left side - Create Checklist Button */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
              onClick={handleCreateChecklist}
              sx={{
                px: 2.5,
                py: 0.75,
                textTransform: 'none',
                flexShrink: 0,
                boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': {
                  boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`
                }
              }}
            >
              Create Checklist
            </Button>
          </Box>

          {/* Right side - Filter Chips, Checklist Button, PropertySelect */}
          <Box
            sx={{
              display: 'flex',
              gap: { xs: 1, sm: 2 },
              alignItems: 'center',
              flexWrap: 'wrap',
              flexShrink: 0,
              width: { xs: '100%', sm: 'auto' },
              justifyContent: { xs: 'flex-start', sm: 'flex-end' },
              '@media (max-width: 912px)': {
                width: '100%',
                justifyContent: 'flex-start'
              }
            }}
          >
            {/* Filter Chips */}
            {statusFilter !== 'all' && (
              <Chip
                label={`Status: ${statusFilter === 'active' ? 'Active' : statusFilter === 'completed' ? 'Completed' : 'Overdue'}`}
                onClick={(e) => {
                  setClickedChipFilter('status');
                  setActiveSubMenu('status');
                  setFilterAnchorEl(e.currentTarget);
                  setSubMenuAnchorEl(e.currentTarget);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  setStatusFilter('all');
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
            )}
            {typeFilter !== 'all' && (
              <Chip
                label={`Type: ${typeFilter === String(CHECKLIST_TYPES.MOVE_IN) ? 'Move-In' : 'Move-Out'}`}
                onClick={(e) => {
                  setClickedChipFilter('type');
                  setActiveSubMenu('type');
                  setFilterAnchorEl(e.currentTarget);
                  setSubMenuAnchorEl(e.currentTarget);
                }}
                onDelete={(e) => {
                  e.stopPropagation();
                  setTypeFilter('all');
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
            )}

            {/* Checklist Button */}
            <Button
              size="small"
              variant="outlined"
              startIcon={<CheckSquareOutlined style={{ fontSize: 16 }} />}
              sx={{
                color: 'primary.main',
                borderColor: 'primary.main',
                textTransform: 'none',
                flexShrink: 0,
                alignSelf: 'center',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  borderColor: 'primary.main'
                }
              }}
            >
              Checklist
            </Button>

            {/* PropertySelect on the right */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <PropertySelect width={300} />
            </Box>
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
          <MenuItem
            onClick={(e) => {
              setActiveSubMenu('status');
              setSubMenuAnchorEl(e.currentTarget);
            }}
          >
            <ListItemText primary="Status" />
          </MenuItem>
          <MenuItem
            onClick={(e) => {
              setActiveSubMenu('type');
              setSubMenuAnchorEl(e.currentTarget);
            }}
          >
            <ListItemText primary="Type" />
          </MenuItem>
        </MenuList>
      </Menu>

      {/* Submenu for Status */}
      <Menu
        anchorEl={subMenuAnchorEl}
        open={Boolean(subMenuAnchorEl) && activeSubMenu === 'status'}
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
          <MenuItem
            onClick={() => {
              setStatusFilter('all');
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
              setFilterAnchorEl(null);
              setClickedChipFilter(null);
            }}
            selected={statusFilter === 'all'}
          >
            <ListItemText primary="All Status" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              setStatusFilter('active');
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
              setFilterAnchorEl(null);
              setClickedChipFilter(null);
            }}
            selected={statusFilter === 'active'}
          >
            <ListItemText primary="Active" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              setStatusFilter('completed');
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
              setFilterAnchorEl(null);
              setClickedChipFilter(null);
            }}
            selected={statusFilter === 'completed'}
          >
            <ListItemText primary="Completed" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              setStatusFilter('overdue');
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
              setFilterAnchorEl(null);
              setClickedChipFilter(null);
            }}
            selected={statusFilter === 'overdue'}
          >
            <ListItemText primary="Overdue" />
          </MenuItem>
        </MenuList>
      </Menu>

      {/* Submenu for Type */}
      <Menu
        anchorEl={subMenuAnchorEl}
        open={Boolean(subMenuAnchorEl) && activeSubMenu === 'type'}
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
          <MenuItem
            onClick={() => {
              setTypeFilter('all');
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
              setFilterAnchorEl(null);
              setClickedChipFilter(null);
            }}
            selected={typeFilter === 'all'}
          >
            <ListItemText primary="All Types" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              setTypeFilter(String(CHECKLIST_TYPES.MOVE_IN));
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
              setFilterAnchorEl(null);
              setClickedChipFilter(null);
            }}
            selected={typeFilter === String(CHECKLIST_TYPES.MOVE_IN)}
          >
            <ListItemText primary="Move-In" />
          </MenuItem>
          <MenuItem
            onClick={() => {
              setTypeFilter(String(CHECKLIST_TYPES.MOVE_OUT));
              setSubMenuAnchorEl(null);
              setActiveSubMenu(null);
              setFilterAnchorEl(null);
              setClickedChipFilter(null);
            }}
            selected={typeFilter === String(CHECKLIST_TYPES.MOVE_OUT)}
          >
            <ListItemText primary="Move-Out" />
          </MenuItem>
        </MenuList>
      </Menu>

      {/* Tabs */}
      <MainCard>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
        >
          <Tab label="All" />
          <Tab label="Move-In" />
          <Tab label="Move-Out" />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress />
          </Box>
        ) : filteredChecklists.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <FileTextOutlined style={{ fontSize: 64, color: theme.palette.text.secondary, marginBottom: 16 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No checklists found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {checklists.length === 0
                ? 'Get started by creating your first checklist'
                : 'Try adjusting your filters to see more results'}
            </Typography>
            {checklists.length === 0 && (
              <Button variant="contained" startIcon={<PlusOutlined />} onClick={handleCreateChecklist}>
                Create Checklist
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer component={Paper} sx={{ boxShadow: 'none', border: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Property / Unit</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Progress</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredChecklists.map((checklist) => {
                  const progress = getChecklistProgress(checklist);
                  const propertyName = checklist.property?.name || checklist.propertyName || '';
                  
                  // Try to get unit name from multiple sources
                  let unitName = checklist.unit?.name || checklist.unitName;
                  
                  // Fallback: Extract unit name from title if unitName is null/undefined
                  // Title format: "Unit 10 - Move-In Checklist" or "Unit 10 - Move-Out Checklist"
                  if (!unitName && checklist.title) {
                    const unitMatch = checklist.title.match(/Unit\s+(\d+[A-Z]?)/i);
                    if (unitMatch) {
                      unitName = unitMatch[1] ? `Unit ${unitMatch[1]}` : null;
                    }
                  }
                  
                  // Get property type from properties list to determine if multi-unit
                  const property = properties?.find(p => p.id === checklist.propertyId);
                  const propertyType = property?.propertyType;
                  const isMultiUnit = propertyType?.toLowerCase() !== 'singlefamily' && !!unitName;

                  return (
                    <TableRow
                      key={checklist.id}
                      hover
                      onClick={() => handleViewChecklist(checklist.id)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04)
                        }
                      }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <HomeOutlined style={{ fontSize: 16, color: '#1877F2' }} />
                          <Typography variant="body2" fontWeight={500}>
                            {propertyName}
                          </Typography>
                          {isMultiUnit && (
                            <Chip
                              label={unitName}
                              variant="outlined"
                              color="primary"
                              size="small"
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {checklist.checklistTypeName || 
                           (checklist.checklistType === CHECKLIST_TYPES.MOVE_IN ? 'Move-In Checklist' : 
                            checklist.checklistType === CHECKLIST_TYPES.MOVE_OUT ? 'Move-Out Checklist' : 
                            'Checklist')}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {getStatusChip(checklist)}
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2">
                            {progress.completed} / {progress.total}
                          </Typography>
                          <Box
                            sx={{
                              width: '100%',
                              height: 6,
                              bgcolor: alpha(theme.palette.primary.main, 0.1),
                              borderRadius: 1,
                              overflow: 'hidden'
                            }}
                          >
                            <Box
                              sx={{
                                width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                                height: '100%',
                                bgcolor: checklist.isCompleted ? 'success.main' : 'primary.main',
                                transition: 'width 0.3s'
                              }}
                            />
                          </Box>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>
    </Box>
  );
}
