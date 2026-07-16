import { useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Stack,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  alpha,
  useTheme
} from '@mui/material';
import { ImportOutlined, ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import { CSVLink } from 'react-csv';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { bulkCreateUnits } from 'store/unit/unit.action';
import useFetchProperty from 'hooks/useFetchProperty';
import { openSnackbar } from 'api/snackbar';

const REQUIRED_COLUMNS = ['name', 'beds', 'baths'];
const OPTIONAL_COLUMNS = ['room_rentals'];

function parseBool(val) {
  const v = String(val || '').trim().toLowerCase();
  if (['true', 'yes', '1'].includes(v)) return true;
  if (['false', 'no', '0'].includes(v)) return false;
  return false;
}

function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];

  const parseRow = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === ',' && !inQuotes) || c === '\n') {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += c;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = parseRow(lines[0]).map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseRow(lines[i]);
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(header) {
  return header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function getRowValue(row, ...keys) {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    for (const header of Object.keys(row)) {
      if (normalizeHeader(header) === normalized) {
        return row[header];
      }
    }
  }
  return '';
}

const SAMPLE_CSV = [
  { name: '1', beds: '2', baths: '1.5', room_rentals: 'false' },
  { name: '2', beds: '2', baths: '2', room_rentals: 'false' },
  { name: '3', beds: '1', baths: '1', room_rentals: 'true' },
  { name: 'Apartment A', beds: '3', baths: '2', room_rentals: 'false' },
  { name: 'Unit 101', beds: '2', baths: '1.5', room_rentals: 'false' }
];

export default function UnitImportPage() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { selectedProperty: property, refetch: refetchProperty } = useFetchProperty(propertyId);

  const [csvFile, setCsvFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const fileInputRef = useRef(null);

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
      setResults(null);
    }
  };

  const validateRow = (row, rowIndex) => {
    const errors = [];
    const name = getRowValue(row, 'name', 'unit', 'unit_name', 'unit_name');
    const beds = getRowValue(row, 'beds', 'bedrooms', 'bed');
    const baths = getRowValue(row, 'baths', 'bathrooms', 'bath');

    if (!name || !name.trim()) errors.push('Missing name');
    const bedsNum = beds ? parseFloat(beds) : NaN;
    if (!beds || isNaN(bedsNum) || bedsNum < 0 || bedsNum > 10) errors.push('Invalid beds (use 0-10)');
    const bathsNum = baths ? parseFloat(baths) : NaN;
    if (!baths || isNaN(bathsNum) || bathsNum < 0 || bathsNum > 10) errors.push('Invalid baths (use 0.5, 1, 1.5, etc.)');

    return {
      errors,
      name: name?.trim() || '',
      beds: String(beds || '0'),
      baths: String(baths || '0'),
      roomRentals: parseBool(getRowValue(row, 'room_rentals', 'roomrentals', 'room_rental'))
    };
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

    if (!propertyId) {
      openSnackbar({
        open: true,
        message: 'Property ID is required',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setImporting(true);
    setResults(null);

    try {
      const text = await csvFile.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error('No valid rows found in CSV file. Ensure the first row contains headers and data starts on row 2.');
      }

      const firstRowHeaders = Object.keys(rows[0] || {}).map(normalizeHeader);
      const missingCols = REQUIRED_COLUMNS.filter(
        (c) => !firstRowHeaders.some((h) => normalizeHeader(h) === normalizeHeader(c))
      );
      if (missingCols.length > 0) {
        const available = Object.keys(rows[0] || {}).join(', ');
        throw new Error(`Missing required columns: ${missingCols.join(', ')}. Found: ${available || 'none'}`);
      }

      let successCount = 0;
      const errors = [];
      const validUnits = [];

      for (let i = 0; i < rows.length; i++) {
        const rowIndex = i + 2;
        const validation = validateRow(rows[i], rowIndex);

        if (validation.errors.length > 0) {
          errors.push(`Row ${rowIndex}: ${validation.errors.join('; ')}`);
          continue;
        }

        validUnits.push({
          id: 0,
          name: validation.name,
          bedrooms: validation.beds,
          baths: validation.baths,
          squareFeet: 0,
          isOccupied: false,
          PropertyId: parseInt(propertyId),
          type: '',
          rentAmount: 0,
          amenities: [],
          includedUtility: [],
          hasRoomRentals: validation.roomRentals
        });
      }

      if (validUnits.length > 0) {
        try {
          const result = await dispatch(bulkCreateUnits(parseInt(propertyId), validUnits));
          if (result?.success && result?.data) {
            successCount = result.data.length;
            await refetchProperty?.();
          } else {
            throw new Error('Bulk create failed');
          }
        } catch (err) {
          errors.push(err?.response?.data?.message || err?.message || 'Failed to import units');
        }
      }

      setResults({ successCount, errors, total: rows.length });

      if (successCount > 0) {
        openSnackbar({
          open: true,
          message: `Successfully imported ${successCount} unit(s)${errors.length > 0 ? `. ${errors.length} error(s) occurred.` : ''}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      }

      if (errors.length > 0 && successCount === 0) {
        openSnackbar({
          open: true,
          message: 'Failed to import units. Check the error list below.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.message || 'Failed to import CSV file',
        variant: 'alert',
        alert: { color: 'error' }
      });
      setResults({ successCount: 0, errors: [err?.message], total: 0 });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setResults(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleBack = () => {
    navigate(`/landlord/property/${propertyId}/add-units`);
  };

  if (propertyId && !property) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Properties', path: '/landlord/properties' },
          { label: property?.name || property?.streetAddress || 'Property', path: `/landlord/property/${propertyId}` },
          { label: 'Add Units', path: `/landlord/property/${propertyId}/add-units` },
          { label: 'Import' }
        ]}
      />

      <MainCard sx={{ mt: 3 }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h4" fontWeight={600}>
              Import Units
            </Typography>
            <Button
              size="small"
              startIcon={<ArrowLeftOutlined />}
              onClick={handleBack}
              sx={{ textTransform: 'none' }}
            >
              Back to Add Units
            </Button>
          </Box>

          {property && (
            <Typography variant="body1" color="text.secondary">
              Importing units for: <strong>{property.name || property.streetAddress}</strong>
            </Typography>
          )}

          {/* Template Documentation */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              borderRadius: 2
            }}
          >
            <Typography variant="h6" fontWeight={600} gutterBottom>
              CSV Template Format
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Your CSV must include the following columns. The first row should be headers.
            </Typography>

            <Table size="small" sx={{ mb: 2 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Column</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Required</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Values / Format</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>name</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Unit identifier (e.g., 1, 2, Unit 1, Apartment A)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>beds</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Number of bedrooms (0-10)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>baths</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Number of bathrooms (e.g., 0.5, 1, 1.5, 2)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>room_rentals</TableCell>
                  <TableCell>No</TableCell>
                  <TableCell>true/false or yes/no (default: false)</TableCell>
                </TableRow>
              </TableBody>
            </Table>

            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
              Example CSV:
            </Typography>
            <Box
              component="pre"
              sx={{
                p: 2,
                bgcolor: alpha(theme.palette.grey[500], 0.1),
                borderRadius: 1,
                fontSize: '0.8rem',
                overflow: 'auto'
              }}
            >
              {`name,beds,baths,room_rentals
1,2,1.5,false
2,2,2,false
3,1,1,true
Apartment A,3,2,false
Unit 101,2,1.5,false`}
            </Box>
          </Paper>

          {/* Download Template */}
          <Box sx={{ mb: 1 }}>
            <CSVLink
              data={SAMPLE_CSV}
              filename="unit-import-template.csv"
              headers={[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]}
              style={{ textDecoration: 'none' }}
            >
              <Button
                variant="outlined"
                color="primary"
                startIcon={<DownloadOutlined />}
                sx={{ textTransform: 'none' }}
              >
                Download Template
              </Button>
            </CSVLink>
          </Box>

          {/* File Upload */}
          <Paper
            variant="outlined"
            sx={{
              p: 3,
              bgcolor: alpha(theme.palette.background.paper, 0.6),
              borderRadius: 2,
              borderStyle: 'dashed',
              borderWidth: 2
            }}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              ref={fileInputRef}
              style={{ display: 'none' }}
              id="unit-csv-input"
            />
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <label htmlFor="unit-csv-input">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<ImportOutlined />}
                  sx={{
                    textTransform: 'none',
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
              <Button
                variant="contained"
                color="primary"
                startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <ImportOutlined />}
                onClick={handleImport}
                disabled={!csvFile || importing}
                sx={{ textTransform: 'none' }}
              >
                {importing ? 'Importing...' : 'Import'}
              </Button>
              {results && (
                <Button variant="text" onClick={handleReset} sx={{ textTransform: 'none' }}>
                  Reset
                </Button>
              )}
            </Stack>
          </Paper>

          {/* Results */}
          {results && (
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                bgcolor: alpha(theme.palette.background.paper, 0.6),
                borderRadius: 2
              }}
            >
              <Typography variant="h6" fontWeight={600} gutterBottom>
                Import Results
              </Typography>
              <Alert
                severity={results.successCount > 0 ? (results.errors.length > 0 ? 'warning' : 'success') : 'error'}
                sx={{ mb: 2 }}
              >
                {results.successCount} of {results.total} unit(s) imported successfully.
                {results.errors.length > 0 && ` ${results.errors.length} error(s).`}
              </Alert>
              {results.successCount > 0 && (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleBack}
                  sx={{ mt: 2, textTransform: 'none' }}
                >
                  Back to Add Units
                </Button>
              )}
              {results.errors.length > 0 && (
                <Box>
                  <Typography variant="body2" fontWeight={500} gutterBottom>
                    Errors:
                  </Typography>
                  <Box
                    component="ul"
                    sx={{
                      m: 0,
                      pl: 2.5,
                      maxHeight: 200,
                      overflow: 'auto'
                    }}
                  >
                    {results.errors.map((err, idx) => (
                      <li key={idx}>
                        <Typography variant="body2" color="error.main">
                          {err}
                        </Typography>
                      </li>
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          )}
        </Stack>
      </MainCard>
    </Box>
  );
}
