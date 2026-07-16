import { useMemo, useState, useEffect, useRef } from 'react';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
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
  Chip,
  IconButton as MuiIconButton,
  Tooltip,
  OutlinedInput,
  InputAdornment,
  CircularProgress,
  Menu,
  MenuItem,
  MenuList,
  ListItemText,
  Fade,
  alpha,
  useTheme,
  useMediaQuery,
  Grid,
  Select,
  FormControl,
  Divider,
  Avatar
} from '@mui/material';
import MainCard from 'components/MainCard';
import FilterDeleteIcon from 'components/FilterDeleteIcon';
import AnimateIn from 'components/AnimateIn';
import {
  HomeOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  SearchOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  PlusOutlined,
  ToolOutlined,
  CalendarOutlined,
  LeftOutlined,
  RightOutlined,
  FilterOutlined,
  UserOutlined,
  TeamOutlined,
  RobotOutlined,
  PauseOutlined,
  PlaySquareOutlined,
  SettingOutlined,
  ShopOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { formatDateAndTime } from 'utils/formatters';
import { openSnackbar } from 'api/snackbar';
import useFetchMaintenances from 'hooks/useFetchMaintenances';
import { selectMaintenanceRequests } from 'store/maintenance/maintenance.selector';
import { selectHistoryMaintenances } from 'store/maintenance/maintenance.selector';
import { selectMaintenanceLoading } from 'store/maintenance/maintenance.selector';
import { setProperty } from 'store/property/property.action';
import { deleteMaintenance, updateMaintenance, reopenMaintenanceRequest } from 'store/maintenance/maintenance.action';
import { useDrawer } from 'contexts/DrawerContext';
import LandlordMaintenanceDrawer from 'components/drawers/LandlordMaintenanceDrawer';
import MaintenanceEditDrawer from 'components/drawers/MaintenanceEditDrawer';
import VendorAssignDrawer from 'components/drawers/VendorAssignDrawer';
import { selectProperty, selectProperties } from 'store/property/property.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import MaintenanceCard from 'components/cards/MaintenanceCard';
import IconButton from 'components/@extended/IconButton';
import { DndContext, DragOverlay, useDraggable, useDroppable, closestCenter, pointerWithin } from '@dnd-kit/core';

// ─── Board column config ──────────────────────────────────────────────────────
const BOARD_COLUMNS = [
  { key: 'reported',     label: 'Reported',     color: 'error' },
  { key: 'acknowledged', label: 'Acknowledged', color: 'warning' },
  { key: 'scheduled',    label: 'Scheduled',    color: 'info' },
  { key: 'inprogress',   label: 'In Progress',  color: 'warning' },
  { key: 'resolved',     label: 'Resolved',     color: 'success' },
];

const COLUMN_BG = {
  reported:     (t) => alpha(t.palette.info.main, 0.04),
  acknowledged: (t) => alpha(t.palette.info.main, 0.04),
  scheduled:    (t) => alpha(t.palette.info.main, 0.04),
  inprogress:   (t) => alpha(t.palette.info.main, 0.04),
  resolved:     (t) => alpha(t.palette.info.main, 0.04),
};

const COLUMN_BORDER_COLOR = {
  reported:     (t) => alpha(t.palette.info.main, 0.25),
  acknowledged: (t) => alpha(t.palette.info.main, 0.25),
  scheduled:    (t) => alpha(t.palette.info.main, 0.25),
  inprogress:   (t) => alpha(t.palette.info.main, 0.25),
  resolved:     (t) => alpha(t.palette.info.main, 0.25),
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeStatus = (s) => (s || '').toString().toLowerCase().replace(/[-_ ]/g, '');

const statusToColumn = (status) => {
  const n = normalizeStatus(status);
  if (n === 'reported' || n === 'open' || n === 'notstarted') return 'reported';
  if (n === 'acknowledged' || n === 'triaged' || n === 'pending') return 'acknowledged';
  if (n === 'scheduled') return 'scheduled';
  if (n === 'inprogress') return 'inprogress';
  if (n === 'resolved' || n === 'completed' || n === 'cancelled') return 'resolved';
  return 'reported';
};

const getDaysAgo = (dateStr) => {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
};

const PRIORITY_COLOR = { high: 'error', medium: 'warning', low: 'success' };
const BOARD_VISIBLE_CARD_LIMIT = 4;
const BOARD_REVEAL_INCREMENT = 5;
const BOARD_PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

const getBoardPriorityRank = (priority) => BOARD_PRIORITY_ORDER[(priority || '').toString().toLowerCase()] ?? 999;

const getCreatedTime = (request) => {
  if (!request?.createdAt) return 0;
  const time = new Date(request.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const sortBoardCards = (cards) => [...cards].sort((a, b) => {
  const priorityComparison = getBoardPriorityRank(a.priority) - getBoardPriorityRank(b.priority);
  if (priorityComparison !== 0) return priorityComparison;

  const createdComparison = getCreatedTime(b) - getCreatedTime(a);
  if (createdComparison !== 0) return createdComparison;

  return (b.id || 0) - (a.id || 0);
});

// Modifier: keeps the DragOverlay centered under the cursor
const snapCenterToCursor = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (draggingNodeRect && activatorEvent) {
    const offsetX = activatorEvent.clientX - (draggingNodeRect.left + draggingNodeRect.width / 2);
    const offsetY = activatorEvent.clientY - (draggingNodeRect.top + draggingNodeRect.height / 2);
    return { ...transform, x: transform.x + offsetX, y: transform.y + offsetY };
  }
  return transform;
};

// ─── Draggable card ───────────────────────────────────────────────────────────
function CardContent({ request, properties, onCardClick, onMoveClick, theme, isOverlay = false }) {
  const prop = properties?.find((p) => p.id === request.propertyId);
  const propName = prop?.name?.trim() || prop?.streetAddress?.trim() || request.propertyName || '—';
  const priority = (request.priority || '').toLowerCase();
  const age = getDaysAgo(request.createdAt);
  const isResolved = statusToColumn(request.status) === 'resolved';

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 0.5 }}>
        {isResolved ? (
          <Chip
            label="COMPLETED"
            size="small"
            sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, borderRadius: 1, px: 0.5, '& .MuiChip-label': { px: 0.5 }, bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main' }}
          />
        ) : (
          <Chip
            label={(priority || 'low').toUpperCase()}
            color={PRIORITY_COLOR[priority] || 'default'}
            size="small"
            sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, borderRadius: 1, px: 0.5, '& .MuiChip-label': { px: 0.5 } }}
          />
        )}
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Typography variant="caption" color="text.disabled">{age}</Typography>
          {!isOverlay && onMoveClick && (
            <Tooltip title="Move to status">
              <MuiIconButton
                size="small"
                aria-label={`Move ${request.orderNumber || request.title || 'maintenance request'} to another status`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onMoveClick(e, request);
                }}
                sx={{ width: 24, height: 24, ml: 0.25 }}
              >
                <MoreOutlined style={{ fontSize: 14 }} />
              </MuiIconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      {request.orderNumber && (
        <Typography
          variant="caption"
          color="primary.main"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (!isOverlay) onCardClick(request.id); }}
          sx={{ display: 'block', fontWeight: 600, mb: 0.25, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
        >
          {request.orderNumber}
        </Typography>
      )}

      <Typography
        variant="subtitle2"
        fontWeight={600}
        sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', mb: 0.5, lineHeight: 1.3 }}
      >
        {request.title || 'Untitled'}
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {propName}
      </Typography>

      {(request.vendorName || request.assignedContactName) && (
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Avatar sx={{ width: 18, height: 18, fontSize: '0.6rem', bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.main' }}>
            {(request.vendorName || request.assignedContactName || '?')[0].toUpperCase()}
          </Avatar>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 120 }}>
            {request.vendorName || request.assignedContactName}
          </Typography>
        </Stack>
      )}
    </>
  );
}

function DraggableCard({ request, properties, onCardClick, onMoveClick, theme }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(request.id) });

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onCardClick(request.id)}
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`,
        borderRadius: 2,
        p: 1.5,
        opacity: isDragging ? 0.25 : 1,
        transition: 'box-shadow 0.15s, opacity 0.15s',
        '&:hover': { boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.12)}` },
        userSelect: 'none',
        cursor: isDragging ? 'grabbing' : 'grab',
        position: 'relative',
        touchAction: 'none'
      }}
    >
      <CardContent request={request} properties={properties} onCardClick={onCardClick} onMoveClick={onMoveClick} theme={theme} />
    </Box>
  );
}

// ─── Droppable column ─────────────────────────────────────────────────────────
function DroppableColumn({ columnKey, label, color, cards, properties, onCardClick, onMoveClick, theme }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnKey });
  const [visibleCardLimit, setVisibleCardLimit] = useState(BOARD_VISIBLE_CARD_LIMIT);
  const colorMain = theme.palette.info.main;
  const visibleCards = cards.slice(0, visibleCardLimit);
  const hiddenCount = Math.max(cards.length - visibleCards.length, 0);
  const canShowFewer = hiddenCount === 0 && visibleCardLimit > BOARD_VISIBLE_CARD_LIMIT && cards.length > BOARD_VISIBLE_CARD_LIMIT;
  const shouldShowMoreControl = hiddenCount > 0 || canShowFewer;
  const nextRevealCount = Math.min(BOARD_REVEAL_INCREMENT, hiddenCount);

  return (
    <Box
      ref={setNodeRef}
      sx={{
        flex: '0 0 240px',
        minWidth: 220,
        bgcolor: isOver ? alpha(colorMain, 0.1) : COLUMN_BG[columnKey](theme),
        border: `1px dashed ${COLUMN_BORDER_COLOR[columnKey](theme)}`,
        borderRadius: 2,
        p: 1.5,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minHeight: 400,
        transition: 'background-color 0.15s'
      }}
    >
      {/* Column header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, color: colorMain }}>
          {label}
        </Typography>
        <Chip
          label={cards.length}
          size="small"
          sx={{ height: 18, fontSize: '0.65rem', bgcolor: alpha(colorMain, 0.12), color: colorMain, fontWeight: 700, '& .MuiChip-label': { px: 0.75 } }}
        />
      </Stack>

      {/* Cards */}
      {visibleCards.map((req) => (
        <DraggableCard
          key={req.id}
          request={req}
          properties={properties}
          onCardClick={onCardClick}
          onMoveClick={onMoveClick}
          theme={theme}
        />
      ))}

      {shouldShowMoreControl && (
        <Box
          component="button"
          type="button"
          onClick={() => {
            if (hiddenCount > 0) {
              setVisibleCardLimit((prev) => Math.min(prev + BOARD_REVEAL_INCREMENT, cards.length));
            } else {
              setVisibleCardLimit(BOARD_VISIBLE_CARD_LIMIT);
            }
          }}
          aria-label={hiddenCount > 0 ? `Show next ${nextRevealCount} hidden ${label} items` : `Collapse ${label} column`}
          sx={{
            width: '100%',
            border: `1px dashed ${alpha(colorMain, canShowFewer ? 0.38 : 0.28)}`,
            borderRadius: 1.5,
            py: 0.85,
            px: 1,
            bgcolor: canShowFewer ? alpha(colorMain, 0.08) : alpha(colorMain, 0.045),
            color: 'text.secondary',
            textAlign: 'center',
            cursor: 'pointer',
            transition: 'background-color 0.15s, border-color 0.15s, color 0.15s',
            '&:hover': {
              bgcolor: alpha(colorMain, 0.12),
              borderColor: alpha(colorMain, 0.5),
              color: colorMain
            },
            '&:focus-visible': {
              outline: `2px solid ${alpha(colorMain, 0.5)}`,
              outlineOffset: 2
            }
          }}
        >
          <Typography component="span" variant="caption" fontWeight={700}>
            {hiddenCount > 0 ? `+${hiddenCount} more hidden` : 'Show fewer'}
          </Typography>
        </Box>
      )}

      {cards.length === 0 && (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.35 }}>
          <Typography variant="caption" color="text.secondary">drop here</Typography>
        </Box>
      )}
    </Box>
  );
}

// ─── Status / priority chip helpers ──────────────────────────────────────────
function StatusChip({ status }) {
  const n = normalizeStatus(status);
  let label = status || '—';
  let color = 'default';
  if (n === 'reported' || n === 'open' || n === 'notstarted') { label = 'Reported'; color = 'error'; }
  else if (n === 'acknowledged') { label = 'Acknowledged'; color = 'warning'; }
  else if (n === 'scheduled') { label = 'Scheduled'; color = 'info'; }
  else if (n === 'inprogress') { label = 'In Progress'; color = 'info'; }
  else if (n === 'resolved' || n === 'completed') { label = 'Resolved'; color = 'success'; }
  return <Chip label={label} color={color} size="small" sx={{ fontWeight: 600 }} />;
}

function PriorityChipDisplay({ priority }) {
  const p = (priority || '').toLowerCase();
  const color = PRIORITY_COLOR[p] || 'default';
  return <Chip label={p ? p.charAt(0).toUpperCase() + p.slice(1) : '—'} color={color} size="small" sx={{ fontWeight: 600 }} />;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Maintenances() {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requests = useSelector(selectMaintenanceRequests);
  const historyRequests = useSelector(selectHistoryMaintenances);
  const selectedProperty = useSelector(selectProperty);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { propertiesRefetch, isLoading: propertiesLoading } = useFetchProperties();
  const properties = useSelector(selectProperties);
  const maintenanceLoading = useSelector(selectMaintenanceLoading);

  // Get context to update maintenances page loading state
  const { setMaintenancesLoading } = useDashboardLoading();

  // Clear any inherited property selection when arriving at this page (unless URL specifies one)
  useEffect(() => {
    if (!searchParams.get('propertyId')) {
      dispatch(setProperty(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for propertyId in URL query params and set property if present
  useEffect(() => {
    const propertyIdParam = searchParams.get('propertyId');
    if (propertyIdParam && properties && properties.length > 0) {
      const propertyId = parseInt(propertyIdParam);
      const property = properties.find(p => p.id === propertyId);
      if (property) {
        dispatch(setProperty(property));
      }
    }
  }, [searchParams, dispatch, properties]);

  // Reset property selection when leaving this page
  const location = useLocation();
  const previousPathname = useRef(null);
  useEffect(() => {
    const isOnThisPage = location.pathname === '/landlord/maintenances';
    const justNavigatedAway = previousPathname.current === '/landlord/maintenances' && !isOnThisPage;
    if (justNavigatedAway && selectedProperty) {
      dispatch(setProperty(null));
    }
    previousPathname.current = location.pathname;
  }, [location.pathname, dispatch, selectedProperty]);

  // Update filters when URL parameters change
  useEffect(() => {
    const statusParam = searchParams.get('status');
    const priorityParam = searchParams.get('priority');
    if (statusParam) {
      const normalizedStatus = statusParam.toLowerCase() === 'inprogress' ? 'in-progress' : statusParam.toLowerCase();
      const metricKey = (normalizedStatus === 'completed' || normalizedStatus === 'cancelled') ? 'resolved' : normalizedStatus;
      setActiveMetricFilter(metricKey);
    }
    if (priorityParam) {
      setFilters(prev => ({ ...prev, priority: [priorityParam.toLowerCase()] }));
    }
  }, [searchParams]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('current');
  const [activeMetricFilter, setActiveMetricFilter] = useState('total');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [requestToDelete, setRequestToDelete] = useState(null);
  const [statusMenuAnchor, setStatusMenuAnchor] = useState(null);
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedRequestForStatus, setSelectedRequestForStatus] = useState(null);
  const [priorityMenuAnchor, setPriorityMenuAnchor] = useState(null);
  const [selectedRequestForPriority, setSelectedRequestForPriority] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [clickedChipFilter, setClickedChipFilter] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);
  // New state
  const [viewMode, setViewMode] = useState('board');
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [dragActive, setDragActive] = useState(null);
  const [optimisticOverrides, setOptimisticOverrides] = useState({});
  const [boardMoveMenuAnchor, setBoardMoveMenuAnchor] = useState(null);
  const [selectedRequestForBoardMove, setSelectedRequestForBoardMove] = useState(null);

  // Set viewMode based on mobile on first render
  useEffect(() => {
    if (isMobile) setViewMode('queue');
  }, []); // intentionally only on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps

  // Initialize filters from URL parameters if present
  const getInitialFilters = () => {
    const priorityParam = searchParams.get('priority');
    return {
      priority: priorityParam ? [priorityParam.toLowerCase()] : [],
      category: []
    };
  };
  const [filters, setFilters] = useState(getInitialFilters());

  const { refetch } = useFetchMaintenances();

  // Fade-in on mount
  useEffect(() => { setFadeIn(true); }, []);

  // Comprehensive loading state
  const isMaintenancesPageLoading = useMemo(() => {
    return propertiesLoading || maintenanceLoading || loading;
  }, [propertiesLoading, maintenanceLoading, loading]);

  useEffect(() => {
    setMaintenancesLoading(isMaintenancesPageLoading);
  }, [isMaintenancesPageLoading, setMaintenancesLoading]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    Promise.all([propertiesRefetch(), refetch()]).finally(() => { setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertiesRefetch]);

  // ── Data computations ──────────────────────────────────────────────────────
  const currentRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter((r) => {
      const status = (r.status || '').toLowerCase();
      return status !== 'completed' && status !== 'cancelled';
    });
  }, [requests]);

  const historyMaintenanceRequests = useMemo(() => historyRequests || [], [historyRequests]);

  const source = useMemo(() => {
    const current = currentRequests || [];
    const history = historyMaintenanceRequests || [];
    if (tab === 'history') return history;
    if (tab === 'current' && (activeMetricFilter === 'resolved' || activeMetricFilter === 'total')) {
      return [...current, ...history];
    }
    return current;
  }, [tab, currentRequests, historyMaintenanceRequests, activeMetricFilter]);

  const filteredByProperty = useMemo(() => {
    if (!selectedProperty?.id) return source;
    return source.filter((r) => r.propertyId === selectedProperty.id);
  }, [source, selectedProperty]);

  const convertBackendStatusToFrontend = (backendStatus) => {
    if (!backendStatus) return '';
    const status = backendStatus.toString();
    const statusLower = status.toLowerCase();
    if (statusLower === 'inprogress' || statusLower === 'in-progress' || status === 'InProgress' || status === 'In Progress') return 'in-progress';
    if (statusLower === 'onhold' || statusLower === 'on-hold' || status === 'OnHold' || status === 'On Hold') return 'on-hold';
    const statusMap = { 'Open': 'open', 'InProgress': 'in-progress', 'Pending': 'pending', 'OnHold': 'on-hold', 'Completed': 'completed', 'Cancelled': 'cancelled' };
    return statusMap[status] || statusLower;
  };

  const convertBackendPriorityToFrontend = (backendPriority) => {
    if (!backendPriority) return '';
    const priority = backendPriority.toString();
    const priorityMap = { 'Low': 'low', 'Medium': 'medium', 'High': 'high' };
    return priorityMap[priority] || priority.toLowerCase();
  };

  const filteredRequests = useMemo(() => {
    if (!filteredByProperty) return [];
    const searchLower = search.toLowerCase();
    return filteredByProperty.filter((r) => {
      if (activeMetricFilter === 'open') {
        if (convertBackendStatusToFrontend(r.status) !== 'open') return false;
      } else if (activeMetricFilter === 'in-progress') {
        if (convertBackendStatusToFrontend(r.status) !== 'in-progress') return false;
      } else if (activeMetricFilter === 'resolved') {
        const s = convertBackendStatusToFrontend(r.status);
        if (s !== 'completed' && s !== 'cancelled' && s !== 'resolved') return false;
      } else if (activeMetricFilter === 'triaging') {
        if (normalizeStatus(r.status) !== 'reported') return false;
      } else if (activeMetricFilter === 'awaitingApproval') {
        if (normalizeStatus(r.status) !== 'acknowledged') return false;
      }
      const matchesSearch =
        search.trim() === '' ||
        r.orderNumber?.toLowerCase().includes(searchLower) ||
        r.title?.toLowerCase().includes(searchLower) ||
        r.propertyName?.toLowerCase().includes(searchLower) ||
        r.unitName?.toLowerCase().includes(searchLower) ||
        r.category?.toLowerCase().includes(searchLower) ||
        r.description?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
      if (filters.priority && filters.priority.length > 0) {
        const requestPriority = convertBackendPriorityToFrontend(r.priority);
        if (!filters.priority.includes(requestPriority)) return false;
      }
      if (filters.category && filters.category.length > 0) {
        const categoryValue = typeof r.category === 'string' ? r.category : r.category?.Value || r.category?.value || '';
        const requestCategory = categoryValue.toLowerCase();
        const matchesCategory = filters.category.some(filterCategory => requestCategory === filterCategory.toLowerCase());
        if (!matchesCategory) return false;
      }
      return true;
    });
  }, [filteredByProperty, search, activeMetricFilter, filters]);

  const getPropertyDisplayLabel = (request, propsList) => {
    const prop = propsList?.find((p) => p.id === request.propertyId);
    if (prop) return prop.name?.trim() || prop.streetAddress?.trim() || 'Property';
    const raw = request.propertyName || request.PropertyName || '';
    if (!raw) return '—';
    const trimmed = raw.trim();
    if (trimmed.includes(', ')) {
      const firstPart = trimmed.split(', ')[0];
      return firstPart || trimmed;
    }
    return trimmed;
  };

  const handleMetricFilterChange = (filter) => {
    setActiveMetricFilter(filter);
    setPage(0);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedRequests = useMemo(() => {
    if (!filteredRequests || filteredRequests.length === 0) return [];
    return [...filteredRequests].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'orderNumber': {
          const aOrderNumber = a.orderNumber || '';
          const bOrderNumber = b.orderNumber || '';
          if (!aOrderNumber && !bOrderNumber) comparison = 0;
          else if (!aOrderNumber) comparison = 1;
          else if (!bOrderNumber) comparison = -1;
          else comparison = aOrderNumber.localeCompare(bOrderNumber);
          break;
        }
        case 'property': {
          const aPropName = a.propertyName || '';
          const bPropName = b.propertyName || '';
          comparison = aPropName.toLowerCase().localeCompare(bPropName.toLowerCase());
          if (comparison === 0) {
            const aUnitName = a.unitName || '';
            const bUnitName = b.unitName || '';
            comparison = aUnitName.toLowerCase().localeCompare(bUnitName.toLowerCase());
          }
          break;
        }
        case 'title':
          comparison = (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase());
          break;
        case 'category':
          comparison = (a.category || '').toLowerCase().localeCompare((b.category || '').toLowerCase());
          break;
        case 'priority': {
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          const aPriority = priorityOrder[(a.priority || '').toLowerCase()] ?? 999;
          const bPriority = priorityOrder[(b.priority || '').toLowerCase()] ?? 999;
          comparison = aPriority - bPriority;
          break;
        }
        case 'status': {
          const statusOrder = { open: 0, 'in-progress': 1, pending: 2, 'on-hold': 3, completed: 4, cancelled: 5 };
          const aStatus = statusOrder[convertBackendStatusToFrontend(a.status)] ?? 999;
          const bStatus = statusOrder[convertBackendStatusToFrontend(b.status)] ?? 999;
          comparison = aStatus - bStatus;
          break;
        }
        case 'createdAt': {
          const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          comparison = aDate - bDate;
          break;
        }
        default:
          return 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredRequests, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedRequests.length / itemsPerPage);
  const paginatedRequests = useMemo(() => {
    const startIndex = page * itemsPerPage;
    return sortedRequests.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedRequests, page, itemsPerPage]);

  useEffect(() => { setPage(0); }, [itemsPerPage]);

  const handlePageChange = (newPage) => { setPage(newPage); };

  // KPI computation — applies optimistic overrides so counts update immediately on drag
  const kpis = useMemo(() => {
    const raw = [...(currentRequests || []), ...(historyMaintenanceRequests || [])];
    const all = Object.keys(optimisticOverrides).length
      ? raw.map(r => optimisticOverrides[r.id] ? { ...r, status: optimisticOverrides[r.id] } : r)
      : raw;
    const total = all.length;
    const open = all.filter(r => {
      const n = normalizeStatus(r.status);
      return n !== 'resolved' && n !== 'completed' && n !== 'cancelled';
    }).length;
    const triaging = all.filter(r => normalizeStatus(r.status) === 'reported').length;
    const awaitingApproval = all.filter(r => normalizeStatus(r.status) === 'acknowledged').length;
    return { total, open, triaging, awaitingApproval };
  }, [currentRequests, historyMaintenanceRequests, optimisticOverrides]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDeleteClick = (request) => {
    setRequestToDelete(request);
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!requestToDelete) return;
    setDeleteConfirmOpen(false);
    try {
      await dispatch(deleteMaintenance(requestToDelete.id));
      await refetch();
      openSnackbar({
        open: true,
        message: `Maintenance request "${requestToDelete.title}" has been deleted successfully`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
        close: true,
        actionButton: false,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
      setRequestToDelete(null);
    } catch (error) {
      console.error('Error deleting maintenance request:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to delete maintenance request',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        close: true,
        actionButton: false,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
    }
  };

  const handleStatusClick = (event, request) => {
    event.stopPropagation();
    setStatusMenuAnchor(event.currentTarget);
    setSelectedRequestForStatus(request);
  };

  const handleStatusMenuClose = () => {
    setStatusMenuAnchor(null);
    setSelectedRequestForStatus(null);
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedRequestForStatus) return;
    const statusMap = { 'open': 'Open', 'in-progress': 'InProgress', 'pending': 'Pending', 'on-hold': 'OnHold', 'completed': 'Completed', 'cancelled': 'Cancelled' };
    const backendStatus = statusMap[newStatus] || newStatus;
    try {
      const convertLocal = (bs) => {
        if (!bs) return 'open';
        const s = bs.toString();
        const m = { 'Open': 'open', 'InProgress': 'in-progress', 'Pending': 'pending', 'OnHold': 'on-hold', 'Completed': 'completed', 'Cancelled': 'cancelled' };
        return m[s] || s.toLowerCase();
      };
      const convertPriorityLocal = (bp) => {
        if (!bp) return 'medium';
        const p = bp.toString();
        const m = { 'Low': 'low', 'Medium': 'medium', 'High': 'high' };
        return m[p] || p.toLowerCase();
      };
      const priorityMap = { 'low': 'Low', 'medium': 'Medium', 'high': 'High' };
      const currentPriority = convertPriorityLocal(selectedRequestForStatus.priority);
      const backendPriority = priorityMap[currentPriority] || currentPriority;
      const updatePayload = {
        id: selectedRequestForStatus.id,
        title: selectedRequestForStatus.title || '',
        unitName: selectedRequestForStatus.unitName || '',
        status: backendStatus,
        priority: backendPriority,
        description: selectedRequestForStatus.description || '',
        categoryId: selectedRequestForStatus.categoryId || 0,
        imageUrl: selectedRequestForStatus.imageUrl || '',
        completedAt: newStatus === 'completed' ? new Date().toISOString() : null
      };
      await dispatch(updateMaintenance(updatePayload));
      await refetch();
      openSnackbar({
        open: true,
        message: `Maintenance request status updated to ${newStatus === 'in-progress' ? 'In Progress' : newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
        close: true,
        actionButton: false,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
      handleStatusMenuClose();
    } catch (error) {
      console.error('Error updating maintenance status:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to update maintenance status',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        close: true,
        actionButton: false,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
    }
  };

  const handlePriorityClick = (event, request) => {
    event.stopPropagation();
    setPriorityMenuAnchor(event.currentTarget);
    setSelectedRequestForPriority(request);
  };

  const handlePriorityMenuClose = () => {
    setPriorityMenuAnchor(null);
    setSelectedRequestForPriority(null);
  };

  const handlePriorityChange = async (newPriority) => {
    if (!selectedRequestForPriority) return;
    const priorityMap = { 'low': 'Low', 'medium': 'Medium', 'high': 'High' };
    const backendPriority = priorityMap[newPriority] || newPriority;
    try {
      const convertStatusLocal = (bs) => {
        if (!bs) return 'open';
        const s = bs.toString();
        const m = { 'Open': 'open', 'InProgress': 'in-progress', 'Pending': 'pending', 'OnHold': 'on-hold', 'Completed': 'completed', 'Cancelled': 'cancelled' };
        return m[s] || s.toLowerCase();
      };
      const currentStatus = convertStatusLocal(selectedRequestForPriority.status);
      const statusMap = { 'open': 'Open', 'in-progress': 'InProgress', 'pending': 'Pending', 'on-hold': 'OnHold', 'completed': 'Completed', 'cancelled': 'Cancelled' };
      const backendStatus = statusMap[currentStatus] || currentStatus;
      const updatePayload = {
        id: selectedRequestForPriority.id,
        title: selectedRequestForPriority.title || '',
        unitName: selectedRequestForPriority.unitName || '',
        status: backendStatus,
        priority: backendPriority,
        description: selectedRequestForPriority.description || '',
        categoryId: selectedRequestForPriority.categoryId || 0,
        imageUrl: selectedRequestForPriority.imageUrl || '',
        completedAt: currentStatus === 'completed' ? new Date().toISOString() : null
      };
      await dispatch(updateMaintenance(updatePayload));
      await refetch();
      openSnackbar({
        open: true,
        message: `Maintenance request priority updated to ${newPriority.charAt(0).toUpperCase() + newPriority.slice(1)}`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
        close: true,
        actionButton: false,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
      handlePriorityMenuClose();
    } catch (error) {
      console.error('Error updating maintenance priority:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to update maintenance priority',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        close: true,
        actionButton: false,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
    }
  };

  const handleBoardMoveClick = (event, request) => {
    event.stopPropagation();
    setBoardMoveMenuAnchor(event.currentTarget);
    setSelectedRequestForBoardMove(request);
  };

  const handleBoardMoveMenuClose = () => {
    setBoardMoveMenuAnchor(null);
    setSelectedRequestForBoardMove(null);
  };

  const handleBoardMoveChange = async (newColumnKey) => {
    const req = selectedRequestForBoardMove;
    if (!req || statusToColumn(req.status) === newColumnKey) {
      handleBoardMoveMenuClose();
      return;
    }

    const statusMap = { reported: 'Reported', acknowledged: 'Acknowledged', scheduled: 'Scheduled', inprogress: 'InProgress', resolved: 'Resolved' };
    const backendStatus = statusMap[newColumnKey] || newColumnKey;
    setOptimisticOverrides(prev => ({ ...prev, [req.id]: backendStatus }));

    try {
      if (statusToColumn(req.status) === 'resolved') {
        await dispatch(reopenMaintenanceRequest(req.id));
        if (newColumnKey !== 'reported') {
          await dispatch(updateMaintenance({
            id: req.id,
            title: req.title,
            unitName: req.unitName || '',
            status: backendStatus,
            priority: req.priority,
            description: req.description || '',
            categoryId: req.categoryId || 0,
            imageUrl: req.imageUrl || '',
            completedAt: null
          }));
        }
      } else {
        await dispatch(updateMaintenance({
          id: req.id,
          title: req.title,
          unitName: req.unitName || '',
          status: backendStatus,
          priority: req.priority,
          description: req.description || '',
          categoryId: req.categoryId || 0,
          imageUrl: req.imageUrl || '',
          completedAt: newColumnKey === 'resolved' ? new Date().toISOString() : null
        }));
      }
      await refetch();
      openSnackbar({
        open: true,
        message: `Maintenance request moved to ${BOARD_COLUMNS.find((col) => col.key === newColumnKey)?.label || backendStatus}`,
        variant: 'alert',
        alert: { color: 'success', variant: 'filled' },
        close: true,
        actionButton: false,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
    } catch (error) {
      console.error('Error moving maintenance request:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to update status',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        close: true,
        actionButton: false,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
    } finally {
      setOptimisticOverrides(prev => {
        const next = { ...prev };
        delete next[req.id];
        return next;
      });
      handleBoardMoveMenuClose();
    }
  };

  // Drag and drop handler
  const handleDragEnd = async ({ active, over }) => {
    setDragActive(null);
    if (!over || active.id === over.id) return;
    const req = boardAllRequests.find(r => String(r.id) === String(active.id));
    if (!req) return;
    const newColumnKey = over.id;
    if (statusToColumn(req.status) === newColumnKey) return;
    const statusMap = { reported: 'Reported', acknowledged: 'Acknowledged', scheduled: 'Scheduled', inprogress: 'InProgress', resolved: 'Resolved' };
    const backendStatus = statusMap[newColumnKey] || newColumnKey;

    // Move the card immediately, before the network round-trip
    setOptimisticOverrides(prev => ({ ...prev, [req.id]: backendStatus }));

    try {
      if (statusToColumn(req.status) === 'resolved') {
        // Resolved/completed items need the dedicated reopen endpoint
        await dispatch(reopenMaintenanceRequest(req.id));
        // If target isn't 'reported' (the default state after reopen), set the specific status
        if (newColumnKey !== 'reported') {
          await dispatch(updateMaintenance({
            id: req.id,
            title: req.title,
            unitName: req.unitName || '',
            status: backendStatus,
            priority: req.priority,
            description: req.description || '',
            categoryId: req.categoryId || 0,
            imageUrl: req.imageUrl || '',
            completedAt: null
          }));
        }
      } else {
        await dispatch(updateMaintenance({
          id: req.id,
          title: req.title,
          unitName: req.unitName || '',
          status: backendStatus,
          priority: req.priority,
          description: req.description || '',
          categoryId: req.categoryId || 0,
          imageUrl: req.imageUrl || '',
          completedAt: newColumnKey === 'resolved' ? new Date().toISOString() : null
        }));
      }
      await refetch();
    } catch {
      openSnackbar({
        open: true,
        message: 'Failed to update status',
        variant: 'alert',
        alert: { color: 'error', variant: 'filled' },
        close: true,
        actionButton: false,
        anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
        transition: 'SlideUp',
        autoHideDuration: 5000
      });
    } finally {
      setOptimisticOverrides(prev => {
        const next = { ...prev };
        delete next[req.id];
        return next;
      });
    }
  };

  // Status options
  const statusOptions = [
    { value: 'open', label: 'Not Started', color: 'default' },
    { value: 'in-progress', label: 'In Progress', color: 'info' },
    { value: 'pending', label: 'Pending', color: 'info' },
    { value: 'on-hold', label: 'On Hold', color: 'info' },
    { value: 'completed', label: 'Completed', color: 'primary' },
    { value: 'cancelled', label: 'Cancelled', color: 'default' }
  ];

  // Priority options
  const priorityOptions = [
    { value: 'low', label: 'Low', color: 'success' },
    { value: 'medium', label: 'Medium', color: 'warning' },
    { value: 'high', label: 'High', color: 'error' }
  ];

  // High priority count — resolved/completed/cancelled requests should not contribute
  const highPriorityCount = sortedRequests.filter(r =>
    (r.priority || '').toLowerCase() === 'high' && statusToColumn(r.status) !== 'resolved'
  ).length;

  // Property options for filter dropdown
  const propertyOptions = useMemo(() => {
    if (!properties) return [];
    return properties.map(p => ({ id: p.id, label: p.name?.trim() || p.streetAddress?.trim() || `Property ${p.id}` }));
  }, [properties]);

  // ── Board view — use all property-filtered requests, ignore status/metric filters
  const boardAllRequests = useMemo(() => {
    const all = [...(currentRequests || []), ...(historyMaintenanceRequests || [])];
    const base = selectedProperty?.id ? all.filter(r => r.propertyId === selectedProperty.id) : all;
    const withOverrides = Object.keys(optimisticOverrides).length
      ? base.map(r => optimisticOverrides[r.id] ? { ...r, status: optimisticOverrides[r.id] } : r)
      : base;
    if (!search.trim()) return withOverrides;
    const s = search.toLowerCase();
    return withOverrides.filter(r =>
      r.title?.toLowerCase().includes(s) ||
      r.orderNumber?.toLowerCase().includes(s) ||
      r.propertyName?.toLowerCase().includes(s)
    );
  }, [currentRequests, historyMaintenanceRequests, selectedProperty, search, optimisticOverrides]);

  const boardColumns = useMemo(() => {
    return BOARD_COLUMNS.map(col => ({
      ...col,
      cards: sortBoardCards(boardAllRequests.filter(r => statusToColumn(r.status) === col.key))
    }));
  }, [boardAllRequests]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Fade in={fadeIn} timeout={600}>
      <Box sx={{ overflow: 'visible' }}>

        {/* ── Page header ── */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <Box>
              <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                Maintenance
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tickets, repairs, vendors — the AI agent triages and routes — you approve &amp; track
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                size="small"
                variant="outlined"
                startIcon={<ShopOutlined />}
                onClick={() => navigate('/landlord/vendors')}
                sx={{ textTransform: 'none', borderRadius: 1.5 }}
              >
                Manage Vendors
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<SettingOutlined />}
                onClick={() => navigate('/landlord/ai-center/maintenance-agent')}
                sx={{ textTransform: 'none', borderRadius: 1.5 }}
              >
                Agent Settings
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<PlusOutlined style={{ fontSize: 11 }} />}
                onClick={() => drawer.openMaintenanceAddDrawer()}
                sx={{
                  textTransform: 'none',
                  borderRadius: 1.5,
                  boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
                  '&:hover': { boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}` }
                }}
              >
                New Ticket
              </Button>
            </Stack>
          </Box>
        </AnimateIn>

        {/* ── KPI cards row ── */}
        <AnimateIn delay={150} direction="bottom" distance={120}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            {[
              { key: 'total', label: 'TOTAL', value: kpis.total },
              { key: 'open', label: 'OPEN', value: kpis.open },
              { key: 'triaging', label: 'TRIAGING NOW', value: kpis.triaging },
              { key: 'awaitingApproval', label: 'AWAITING APPROVAL', value: kpis.awaitingApproval }
            ].map((kpi) => {
              const isActive = activeMetricFilter === kpi.key;
              return (
                <Box
                  key={kpi.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleMetricFilterChange(kpi.key)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleMetricFilterChange(kpi.key); } }}
                  sx={(t) => {
                    const isDark = t.palette.mode === 'dark';
                    return {
                      flex: '1 1 160px',
                      border: '1px solid',
                      borderColor: isActive ? 'primary.main' : isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(0,0,0,0.15)',
                      borderRadius: 2,
                      p: 2,
                      bgcolor: isActive ? (isDark ? 'rgba(59, 130, 246, 0.12)' : 'primary.lighter') : 'background.paper',
                      backgroundImage: isDark ? 'linear-gradient(180deg, rgba(30, 41, 59, 0.78) 0%, rgba(15, 23, 42, 0.9) 100%)' : 'none',
                      boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                      '&:hover': {
                        borderColor: isDark ? 'rgba(96, 165, 250, 0.65)' : 'primary.main',
                        transform: 'translateY(-1px)',
                        boxShadow: isDark ? '0 18px 40px rgba(2, 8, 23, 0.34), inset 0 1px 0 rgba(255,255,255,0.07)' : 'none'
                      }
                    };
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.7, display: 'block', mb: 0.5 }}>
                    {kpi.label}
                  </Typography>
                  <Typography variant="h4" fontWeight={800} sx={{ color: 'text.primary' }}>
                    {kpi.value}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </AnimateIn>

        {/* ── Agent banner ── */}
        <AnimateIn delay={200} direction="bottom" distance={120}>
          <Box
            sx={{
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              borderRadius: 2,
              p: 1.5,
              mb: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1
            }}
          >
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                <RobotOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
                <Typography variant="body2" fontWeight={700}>Peace · maintenance agent</Typography>
                <Chip
                  label="• working"
                  size="small"
                  sx={{
                    height: 20,
                    bgcolor: alpha(theme.palette.success.main, 0.1),
                    color: 'success.main',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                    '& .MuiChip-label': { px: 1 }
                  }}
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                reviewing open tickets and routing to vendors
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="text"
                startIcon={<PlaySquareOutlined />}
                sx={{ textTransform: 'none', fontSize: '0.75rem' }}
              >
                watch live
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PauseOutlined />}
                sx={{ textTransform: 'none', fontSize: '0.75rem', borderRadius: 1.5 }}
              >
                pause agent
              </Button>
            </Stack>
          </Box>
        </AnimateIn>

        {/* ── Toolbar ── */}
        <AnimateIn delay={250} direction="bottom" distance={120}>
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              alignItems: 'center',
              mb: 2
            }}
          >
            {/* Board / Queue toggle */}
            <Box
              sx={{
                display: 'flex',
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1.5,
                overflow: 'hidden'
              }}
            >
              {['board', 'queue'].map((mode) => (
                <Box
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  sx={{
                    px: 1.5,
                    py: 0.6,
                    cursor: 'pointer',
                    bgcolor: viewMode === mode ? 'primary.main' : 'transparent',
                    color: viewMode === mode ? 'primary.contrastText' : 'text.secondary',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    textTransform: 'capitalize',
                    transition: 'all 0.15s',
                    '&:hover': {
                      bgcolor: viewMode === mode ? 'primary.main' : alpha(theme.palette.primary.main, 0.06)
                    }
                  }}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Box>
              ))}
            </Box>

            {/* Property filter */}
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                displayEmpty
                value={selectedProperty?.id || ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    dispatch(setProperty(null));
                  } else {
                    const prop = properties?.find(p => p.id === e.target.value);
                    if (prop) dispatch(setProperty(prop));
                  }
                }}
                sx={{ fontSize: '0.75rem', height: 34 }}
              >
                <MenuItem value=""><em>All properties</em></MenuItem>
                {propertyOptions.map(p => (
                  <MenuItem key={p.id} value={p.id}>{p.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* High priority chip filter */}
            {highPriorityCount > 0 && (
              <Chip
                label={`• high priority (${highPriorityCount})`}
                size="small"
                onClick={() => {
                  if (filters.priority.includes('high')) {
                    setFilters(prev => ({ ...prev, priority: prev.priority.filter(p => p !== 'high') }));
                  } else {
                    setFilters(prev => ({ ...prev, priority: [...prev.priority, 'high'] }));
                  }
                }}
                sx={{
                  fontWeight: 600,
                  fontSize: '0.7rem',
                  bgcolor: filters.priority.includes('high') ? alpha(theme.palette.error.main, 0.12) : 'transparent',
                  color: 'error.main',
                  border: `1px solid ${alpha(theme.palette.error.main, 0.4)}`,
                  cursor: 'pointer'
                }}
              />
            )}

            {/* Active filter chips */}
            {filters.priority.filter(p => p !== 'high').map((priority) => (
              <Chip
                key={priority}
                label={`Priority: ${priority.charAt(0).toUpperCase() + priority.slice(1)}`}
                onDelete={() => setFilters(prev => ({ ...prev, priority: prev.priority.filter(p => p !== priority) }))}
                deleteIcon={<FilterDeleteIcon fontSize={10} />}
                size="small"
                variant="outlined"
                sx={{ color: 'primary.main', borderColor: 'primary.main', '& .MuiChip-label': { color: 'primary.main' } }}
              />
            ))}
            {filters.category.map((category) => (
              <Chip
                key={category}
                label={`Category: ${category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`}
                onDelete={() => setFilters(prev => ({ ...prev, category: prev.category.filter(c => c !== category) }))}
                deleteIcon={<FilterDeleteIcon fontSize={10} />}
                size="small"
                variant="outlined"
                sx={{ color: 'primary.main', borderColor: 'primary.main', '& .MuiChip-label': { color: 'primary.main' } }}
              />
            ))}

            {/* Spacer */}
            <Box sx={{ flex: 1 }} />

            {/* Search */}
            <OutlinedInput
              size="small"
              placeholder="search tickets..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              startAdornment={
                <InputAdornment position="start">
                  <SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} />
                </InputAdornment>
              }
              sx={{ width: { xs: '100%', sm: 220 }, bgcolor: 'background.paper', height: 34, fontSize: '0.8rem' }}
            />

            {/* Filter icon */}
            <Tooltip title="More filters">
              <IconButton
                size="small"
                onClick={(e) => { setClickedChipFilter(null); setFilterAnchorEl(e.currentTarget); }}
              >
                <FilterOutlined />
              </IconButton>
            </Tooltip>
          </Box>
        </AnimateIn>

        {/* ── Filter menus ── */}
        <Menu
          anchorEl={filterAnchorEl}
          open={Boolean(filterAnchorEl) && !clickedChipFilter}
          onClose={() => { setFilterAnchorEl(null); setSubMenuAnchorEl(null); setActiveSubMenu(null); setClickedChipFilter(null); }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <MenuList>
            <MenuItem onClick={(e) => { setActiveSubMenu('priority'); setSubMenuAnchorEl(e.currentTarget); }}>
              <ListItemText primary="Priority" />
              {filters.priority.length > 0 && (
                <Typography variant="caption" color="primary" sx={{ ml: 1 }}>{filters.priority.length} selected</Typography>
              )}
            </MenuItem>
            <MenuItem onClick={(e) => { setActiveSubMenu('category'); setSubMenuAnchorEl(e.currentTarget); }}>
              <ListItemText primary="Category" />
              {filters.category.length > 0 && (
                <Typography variant="caption" color="primary" sx={{ ml: 1 }}>{filters.category.length} selected</Typography>
              )}
            </MenuItem>
          </MenuList>
        </Menu>

        <Menu
          anchorEl={subMenuAnchorEl}
          open={Boolean(subMenuAnchorEl) && (activeSubMenu === 'priority' || activeSubMenu === 'category')}
          onClose={() => { setSubMenuAnchorEl(null); setActiveSubMenu(null); setFilterAnchorEl(null); setClickedChipFilter(null); }}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <MenuList>
            {activeSubMenu === 'priority' && (
              <>
                <MenuItem onClick={() => { setFilters(prev => ({ ...prev, priority: [] })); setSubMenuAnchorEl(null); setActiveSubMenu(null); setFilterAnchorEl(null); setClickedChipFilter(null); }}>
                  <ListItemText primary="All Priorities" />
                </MenuItem>
                {['low', 'medium', 'high'].map(p => (
                  <MenuItem key={p} selected={filters.priority.includes(p)} onClick={() => {
                    setFilters(prev => ({
                      ...prev,
                      priority: prev.priority.includes(p) ? prev.priority.filter(x => x !== p) : [...prev.priority, p]
                    }));
                    setSubMenuAnchorEl(null); setActiveSubMenu(null); setFilterAnchorEl(null); setClickedChipFilter(null);
                  }}>
                    <ListItemText primary={p.charAt(0).toUpperCase() + p.slice(1)} />
                  </MenuItem>
                ))}
              </>
            )}
            {activeSubMenu === 'category' && (
              <>
                <MenuItem onClick={() => { setFilters(prev => ({ ...prev, category: [] })); setSubMenuAnchorEl(null); setActiveSubMenu(null); setFilterAnchorEl(null); setClickedChipFilter(null); }}>
                  <ListItemText primary="All Categories" />
                </MenuItem>
                {['plumbing', 'electrical', 'hvac', 'appliances', 'pest_control', 'landscaping', 'general_repair', 'roofing', 'flooring', 'painting'].map(cat => (
                  <MenuItem key={cat} selected={filters.category.includes(cat)} onClick={() => {
                    setFilters(prev => ({
                      ...prev,
                      category: prev.category.includes(cat) ? prev.category.filter(c => c !== cat) : [...prev.category, cat]
                    }));
                  }}>
                    <ListItemText primary={cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} />
                  </MenuItem>
                ))}
              </>
            )}
          </MenuList>
        </Menu>

        {/* ── Main content area ── */}
        <AnimateIn delay={300} direction="bottom" distance={120}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
              <CircularProgress />
            </Box>
          ) : viewMode === 'board' ? (
            /* ────────────────── BOARD VIEW ────────────────── */
            <DndContext
              collisionDetection={(args) => {
                const pointer = pointerWithin(args);
                return pointer.length > 0 ? pointer : closestCenter(args);
              }}
              onDragStart={({ active }) => setDragActive(active.id)}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setDragActive(null)}
            >
              <Box
                sx={{
                  display: 'flex',
                  gap: 2,
                  overflowX: 'auto',
                  overflowY: 'visible',
                  pb: 2,
                  mx: -0.5,
                  px: 0.5,
                  '&::-webkit-scrollbar': { height: 8 },
                  '&::-webkit-scrollbar-track': { bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 4 },
                  '&::-webkit-scrollbar-thumb': { bgcolor: alpha(theme.palette.info.main, 0.35), borderRadius: 4, '&:hover': { bgcolor: alpha(theme.palette.info.main, 0.55) } }
                }}
              >
                {boardColumns.map(col => (
                  <DroppableColumn
                    key={col.key}
                    columnKey={col.key}
                    label={col.label}
                    color={col.color}
                    cards={col.cards}
                    properties={properties}
                    onCardClick={(id) => navigate(`/landlord/maintenance/${id}`)}
                    onMoveClick={handleBoardMoveClick}
                    theme={theme}
                  />
                ))}
              </Box>

              <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
                {dragActive ? (() => {
                  const req = boardAllRequests.find(r => String(r.id) === String(dragActive));
                  if (!req) return null;
                  return (
                    <Box
                      sx={{
                        bgcolor: 'background.paper',
                        border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.12)}`,
                        borderRadius: 2,
                        p: 1.5,
                        width: 220,
                        boxShadow: theme.palette.mode === 'dark' ? `0 8px 32px ${alpha(theme.palette.common.black, 0.4)}, inset 0 1px 0 rgba(255,255,255,0.06)` : `0 8px 24px ${alpha(theme.palette.common.black, 0.14)}`,
                        cursor: 'grabbing',
                        userSelect: 'none'
                      }}
                    >
                      <CardContent request={req} properties={properties} onCardClick={() => {}} theme={theme} isOverlay />
                    </Box>
                  );
                })() : null}
              </DragOverlay>

            </DndContext>
          ) : (
            /* ────────────────── QUEUE VIEW ────────────────── */
            <Box sx={{ display: 'flex', gap: 0, border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`, borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper', boxShadow: theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}` }}>
              {/* Left panel: table */}
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                {sortedRequests.length === 0 ? (
                  <Box sx={{ p: 4, textAlign: 'center' }}>
                    <ToolOutlined style={{ fontSize: 48, color: theme.palette.text.disabled, marginBottom: 16 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>No maintenance requests found</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {search.trim() !== '' || selectedProperty ? 'Try adjusting your search or filter criteria.' : 'Get started by creating your first maintenance request.'}
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: alpha(theme.palette.background.default, 0.6) }}>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.6, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('orderNumber')}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <span>Order #</span>
                                {sortField === 'orderNumber' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.6, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => handleSort('property')}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <span>Property</span>
                                {sortField === 'property' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.6, cursor: 'pointer' }} onClick={() => handleSort('title')}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <span>Title</span>
                                {sortField === 'title' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.6, cursor: 'pointer' }} onClick={() => handleSort('category')}>
                              <Stack direction="row" spacing={0.5} alignItems="center">
                                <span>Category</span>
                                {sortField === 'category' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.6, cursor: 'pointer' }} align="center" onClick={() => handleSort('priority')}>
                              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                <span>Priority</span>
                                {sortField === 'priority' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.6, cursor: 'pointer' }} align="center" onClick={() => handleSort('status')}>
                              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="center">
                                <span>Status</span>
                                {sortField === 'status' && (sortOrder === 'asc' ? <ArrowUpOutlined style={{ fontSize: 10 }} /> : <ArrowDownOutlined style={{ fontSize: 10 }} />)}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.6 }}>Vendor</TableCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: 0.6 }}>Age</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedRequests.map((request) => {
                            const isSelected = selectedRequest?.id === request.id;
                            const propLabel = getPropertyDisplayLabel(request, properties);
                            const categoryDisplay = request.category
                              ? request.category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                              : '—';
                            const isMember = request.assignedToType === 4;
                            const vendorName = isMember ? request.assignedContactName : request.vendorName;

                            return (
                              <TableRow
                                key={request.id}
                                hover
                                selected={isSelected}
                                onClick={() => navigate(`/landlord/maintenance/${request.id}`)}
                                sx={{
                                  cursor: 'pointer',
                                  bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.06) : undefined,
                                  '&.Mui-selected': { bgcolor: alpha(theme.palette.primary.main, 0.06) },
                                  '&.Mui-selected:hover': { bgcolor: alpha(theme.palette.primary.main, 0.1) }
                                }}
                              >
                                <TableCell>
                                  <Typography variant="caption" fontWeight={700} color="primary.main">
                                    {request.orderNumber || '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption" noWrap sx={{ maxWidth: 120, display: 'block' }}>{propLabel}</Typography>
                                </TableCell>
                                <TableCell sx={{ maxWidth: 180 }}>
                                  <Typography variant="caption" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                                    {request.title || '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption" color="text.secondary">{categoryDisplay}</Typography>
                                </TableCell>
                                <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                  <PriorityChipDisplay priority={request.priority} />
                                </TableCell>
                                <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                                  <StatusChip status={request.status} />
                                </TableCell>
                                <TableCell>
                                  {vendorName ? (
                                    <Stack direction="row" spacing={0.5} alignItems="center">
                                      <Avatar sx={{ width: 20, height: 20, fontSize: '0.6rem', bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.main' }}>
                                        {vendorName[0].toUpperCase()}
                                      </Avatar>
                                      <Typography variant="caption" noWrap sx={{ maxWidth: 100 }}>{vendorName}</Typography>
                                    </Stack>
                                  ) : (
                                    <Typography variant="caption" color="text.disabled">—</Typography>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Typography variant="caption" color="text.secondary">{getDaysAgo(request.createdAt) || '—'}</Typography>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Pagination */}
                    {sortedRequests.length > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">Items per page:</Typography>
                          <FormControl size="small" sx={{ minWidth: 70 }}>
                            <Select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} sx={{ height: 28, fontSize: '0.75rem' }}>
                              <MenuItem value={10}>10</MenuItem>
                              <MenuItem value={20}>20</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="caption" color="text.secondary">Page {page + 1} of {totalPages}</Typography>
                          <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => handlePageChange(Math.max(0, page - 1))} disabled={page === 0} sx={{ minWidth: 90, fontSize: '0.7rem' }}>Prev</Button>
                          <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} sx={{ minWidth: 90, fontSize: '0.7rem' }}>Next</Button>
                        </Box>
                      </Box>
                    )}
                  </>
                )}
              </Box>

              {/* Right sidebar - hidden on mobile */}
              {!isMobile && (
                <Box
                  sx={{
                    width: 380,
                    flexShrink: 0,
                    borderLeft: `1px solid ${theme.palette.divider}`,
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: alpha(theme.palette.background.default, 0.5)
                  }}
                >
                  {selectedRequest ? (
                    <Box sx={{ p: 2.5, flex: 1, overflowY: 'auto' }}>
                      {/* Header */}
                      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.5, fontSize: '0.65rem' }}>
                        SELECTED · {selectedRequest.orderNumber || `MR-${selectedRequest.id}`}
                      </Typography>
                      <Typography variant="h5" fontWeight={700} sx={{ mt: 0.5, mb: 0.5, lineHeight: 1.25 }}>
                        {selectedRequest.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {getPropertyDisplayLabel(selectedRequest, properties)} · reported by · {getDaysAgo(selectedRequest.createdAt) || '—'}
                      </Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 1.5, mb: 1.5 }}>
                        <PriorityChipDisplay priority={selectedRequest.priority} />
                        <StatusChip status={selectedRequest.status} />
                      </Stack>

                      <Divider sx={{ mb: 2 }} />

                      {/* Agent transcript */}
                      <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'primary.main', display: 'block', mb: 1.5 }}>
                        Agent Transcript · Live
                      </Typography>
                      <Stack spacing={1} sx={{ mb: 2 }}>
                        <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06), borderRadius: 1.5, p: 1.25 }}>
                          <Typography variant="caption" fontWeight={700} color="primary.main" sx={{ display: 'block', mb: 0.25 }}>Peace · agent</Typography>
                          <Typography variant="caption" color="text.secondary">
                            I&apos;ve reviewed this ticket and identified it as a {(selectedRequest.category || 'general').toLowerCase()} issue. Searching for qualified vendors now.
                          </Typography>
                        </Box>
                        <Box sx={{ bgcolor: alpha(theme.palette.background.paper, 0.8), border: `1px solid ${theme.palette.divider}`, borderRadius: 1.5, p: 1.25 }}>
                          <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.25 }}>Peace · agent</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Found {Math.floor(Math.random() * 3) + 1} vendors in your network with availability. Recommend assigning based on rating and proximity.
                          </Typography>
                        </Box>
                      </Stack>

                      <Divider sx={{ mb: 2 }} />

                      {/* Agent recommends */}
                      <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary', display: 'block', mb: 1.5 }}>
                        Agent Recommends
                      </Typography>
                      {selectedRequest.vendorName ? (
                        <Box sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1.5, p: 1.5, mb: 1.5 }}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar sx={{ width: 36, height: 36, bgcolor: alpha(theme.palette.primary.main, 0.15), color: 'primary.main', fontWeight: 700 }}>
                              {selectedRequest.vendorName[0].toUpperCase()}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" fontWeight={600}>{selectedRequest.vendorName}</Typography>
                              <Typography variant="caption" color="text.secondary">Assigned vendor</Typography>
                            </Box>
                          </Stack>
                          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                            <Button size="small" variant="outlined" fullWidth sx={{ textTransform: 'none', fontSize: '0.72rem' }}
                              onClick={(e) => { e.stopPropagation(); drawer.openVendorAssignDrawer(selectedRequest, refetch); }}>
                              Change vendor
                            </Button>
                          </Stack>
                        </Box>
                      ) : (
                        <Box sx={{ border: `1px dashed ${theme.palette.divider}`, borderRadius: 1.5, p: 1.5, mb: 1.5, textAlign: 'center' }}>
                          <Typography variant="caption" color="text.secondary">No vendor assigned yet</Typography>
                          <Button size="small" variant="contained" fullWidth sx={{ mt: 1, textTransform: 'none', fontSize: '0.72rem' }}
                            onClick={(e) => { e.stopPropagation(); drawer.openVendorAssignDrawer(selectedRequest, refetch); }}>
                            Assign vendor
                          </Button>
                        </Box>
                      )}

                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button size="small" variant="outlined" fullWidth sx={{ textTransform: 'none', fontSize: '0.72rem' }}
                          onClick={() => navigate(`/landlord/maintenance/${selectedRequest.id}`)}>
                          View details
                        </Button>
                        <Tooltip title="Delete request">
                          <MuiIconButton size="small" onClick={() => handleDeleteClick(selectedRequest)}>
                            <DeleteOutlined style={{ color: theme.palette.error.main, fontSize: 16 }} />
                          </MuiIconButton>
                        </Tooltip>
                      </Stack>
                    </Box>
                  ) : null}
                </Box>
              )}
            </Box>
          )}
        </AnimateIn>

        {/* ── Board Move Menu ── */}
        <Menu
          anchorEl={boardMoveMenuAnchor}
          open={Boolean(boardMoveMenuAnchor)}
          onClose={handleBoardMoveMenuClose}
          slots={{ transition: Fade }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <MenuItem disabled dense>
            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Move to…
            </Typography>
          </MenuItem>
          {BOARD_COLUMNS.map((column) => {
            const isSelected = selectedRequestForBoardMove && statusToColumn(selectedRequestForBoardMove.status) === column.key;
            return (
              <MenuItem key={column.key} onClick={() => handleBoardMoveChange(column.key)} selected={isSelected}>
                <Chip label={column.label} color={column.color} size="small" sx={{ fontWeight: 600 }} />
              </MenuItem>
            );
          })}
        </Menu>

        {/* ── Status Change Menu ── */}
        <Menu
          anchorEl={statusMenuAnchor}
          open={Boolean(statusMenuAnchor)}
          onClose={handleStatusMenuClose}
          slots={{ transition: Fade }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          {statusOptions.map((option) => {
            const currentStatus = selectedRequestForStatus?.status?.toString().toLowerCase() || '';
            const normalizedCurrent = currentStatus === 'inprogress' ? 'in-progress' : currentStatus === 'onhold' ? 'on-hold' : currentStatus;
            const isSelected = normalizedCurrent === option.value;
            return (
              <MenuItem key={option.value} onClick={() => handleStatusChange(option.value)} selected={isSelected}>
                <Chip label={option.label} color={option.color} size="small" sx={{ fontWeight: 600 }} />
              </MenuItem>
            );
          })}
        </Menu>

        {/* ── Priority Change Menu ── */}
        <Menu
          anchorEl={priorityMenuAnchor}
          open={Boolean(priorityMenuAnchor)}
          onClose={handlePriorityMenuClose}
          slots={{ transition: Fade }}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          {priorityOptions.map((option) => {
            const currentPriority = selectedRequestForPriority?.priority?.toString().toLowerCase() || '';
            const isSelected = currentPriority === option.value;
            return (
              <MenuItem key={option.value} onClick={() => handlePriorityChange(option.value)} selected={isSelected}>
                <Chip label={option.label} color={option.color} size="small" sx={{ fontWeight: 600 }} />
              </MenuItem>
            );
          })}
        </Menu>

        {/* ── Confirmation Dialog ── */}
        <ConfirmationDialog
          open={deleteConfirmOpen}
          onClose={() => { setDeleteConfirmOpen(false); setRequestToDelete(null); }}
          onConfirm={handleConfirmDelete}
          title="Confirm Delete Maintenance Request"
          message={`Are you sure you want to delete maintenance request "${requestToDelete?.title}"? This action cannot be undone.`}
          confirmText="Delete Request"
          confirmColor="error"
        />

        {/* ── Drawers ── */}
        <LandlordMaintenanceDrawer onAddSuccess={async () => { await refetch(); }} />
        <MaintenanceEditDrawer maintenance={drawer.selectedMaintenance} onUpdateSuccess={async () => { await refetch(); }} />
        <VendorAssignDrawer />

      </Box>
    </Fade>
  );
}
