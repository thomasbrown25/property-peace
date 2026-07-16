import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
import useCreateProperty from 'hooks/useCreateProperty';
import useAuth from 'hooks/useAuth';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { addOrUpdateUnit } from 'store/unit/unit.action';
import { getProperties } from 'store/property/property.action';
import { openSnackbar } from 'api/snackbar';
import { geocodeAddress, fetchPropertyImageFromAddress, buildFullAddress } from 'utils/propertyImportAddress';
import { parseCSV as aiParseCSV, aiMapCsvRowsWithAgent, IMPORT_FIELD_DEFINITIONS } from 'utils/aiCsvImportAgent';

const REQUIRED_COLUMNS = [
  'property_type',
  'room_rentals',
  'street_address',
  'city',
  'state',
  'zip_code',
  'beds',
  'baths'
];

const PROPERTY_TYPE_MAP = {
  'single-family house': 'singleFamily',
  singlefamily: 'singleFamily',
  townhouse: 'townhouse',
  condominium: 'condominium',
  'small multi-family': 'smallMultiFamily',
  smallmultifamily: 'smallMultiFamily',
  'apartment building': 'apartmentBuilding',
  apartmentbuilding: 'apartmentBuilding',
  'other types': 'other',
  other: 'other'
};

const VALID_PROPERTY_TYPES = [
  'Single-Family House',
  'Townhouse',
  'Condominium',
  'Small Multi-Family',
  'Apartment Building',
  'Other Types'
];

function parseBool(val) {
  const v = String(val || '').trim().toLowerCase();
  if (['true', 'yes', '1'].includes(v)) return true;
  if (['false', 'no', '0'].includes(v)) return false;
  return null;
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
  {
    property_type: 'Single-Family House',
    room_rentals: 'false',
    street_address: '123 Main St',
    city: 'Austin',
    state: 'TX',
    zip_code: '78701',
    beds: '3',
    baths: '2'
  },
  {
    property_type: 'Townhouse',
    room_rentals: 'false',
    street_address: '200 Elm St',
    city: 'Austin',
    state: 'TX',
    zip_code: '78702',
    beds: '2',
    baths: '2'
  },
  {
    property_type: 'Condominium',
    room_rentals: 'false',
    street_address: '300 Cedar Dr',
    city: 'Austin',
    state: 'TX',
    zip_code: '78703',
    beds: '2',
    baths: '1.5'
  },
  {
    property_type: 'Small Multi-Family',
    room_rentals: 'true',
    street_address: '456 Oak Ave',
    city: 'Houston',
    state: 'TX',
    zip_code: '77001',
    beds: '2',
    baths: '1.5'
  },
  {
    property_type: 'Apartment Building',
    room_rentals: 'false',
    street_address: '500 Pine Rd',
    city: 'Houston',
    state: 'TX',
    zip_code: '77002',
    beds: '1',
    baths: '1'
  },
  {
    property_type: 'Other Types',
    room_rentals: 'false',
    street_address: '600 Maple Ln',
    city: 'Houston',
    state: 'TX',
    zip_code: '77003',
    beds: '2',
    baths: '1'
  }
];

export default function PropertyImportPage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const { createProperty } = useCreateProperty();

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

  const mapPropertyTypeToBackend = (value) => {
    const v = String(value || '').trim().toLowerCase();
    const mapped = PROPERTY_TYPE_MAP[v];
    if (mapped) return mapped;
    if (VALID_PROPERTY_TYPES.some((t) => t.toLowerCase() === v)) {
      return PROPERTY_TYPE_MAP[v.replace(/\s+/g, ' ')];
    }
    const normalized = v.replace(/\s+/g, ' ').replace(/-/g, ' ');
    return PROPERTY_TYPE_MAP[normalized] ?? null;
  };

  const validateRow = (row, rowIndex) => {
    const errors = [];
    const propertyType = getRowValue(row, 'property_type', 'propertytype');
    const roomRentals = getRowValue(row, 'room_rentals', 'roomrentals');
    const streetAddress = getRowValue(row, 'street_address', 'streetaddress', 'street address');
    const city = getRowValue(row, 'city');
    const state = getRowValue(row, 'state');
    const zipCode = getRowValue(row, 'zip_code', 'zipcode', 'zip code');
    const beds = getRowValue(row, 'beds', 'bedrooms', 'bedrooms');
    const baths = getRowValue(row, 'baths', 'bathrooms', 'bathrooms');

    if (!propertyType) errors.push('Missing property_type');
    const backendType = mapPropertyTypeToBackend(propertyType);
    if (propertyType && !backendType) errors.push(`Invalid property_type: "${propertyType}"`);

    const roomRentalsBool = parseBool(roomRentals);
    if (roomRentals === '' || roomRentalsBool === null) errors.push('Invalid room_rentals (use true/false or yes/no)');

    if (!streetAddress) errors.push('Missing street_address');
    if (!city) errors.push('Missing city');
    if (!state) errors.push('Missing state');
    if (!zipCode) errors.push('Missing zip_code');

    const bedsNum = beds ? parseFloat(beds) : NaN;
    if (!beds || isNaN(bedsNum) || bedsNum < 0 || bedsNum > 10)
      errors.push('Invalid beds (use 0-10)');

    const bathsNum = baths ? parseFloat(baths) : NaN;
    if (!baths || isNaN(bathsNum) || bathsNum < 0 || bathsNum > 10)
      errors.push('Invalid baths (use 0.5, 1, 1.5, etc.)');

    return { errors, propertyType: backendType, roomRentals: roomRentalsBool, streetAddress, city, state, zipCode, beds: String(beds), baths: String(baths) };
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

    if (subscriptionStatus && !subscriptionStatus.canAddProperty) {
      openSnackbar({
        open: true,
        message: subscriptionStatus.upgradeMessage || 'Your subscription is not active. Please activate your subscription to add properties.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setImporting(true);
    setResults(null);

    try {
      const text = await csvFile.text();
      const parsedRows = aiParseCSV(text);
      const aiMappingResult = await aiMapCsvRowsWithAgent('properties', parsedRows, IMPORT_FIELD_DEFINITIONS.properties);
      const rows = aiMappingResult.rows;

      if (rows.length === 0) {
        throw new Error('No valid rows found in CSV file. Ensure the first row contains headers and data starts on row 2.');
      }

      if (aiMappingResult.unmappedFields.length > 0) {
        const available = aiMappingResult.sourceHeaders.join(', ');
        throw new Error(`AI could not map required columns: ${aiMappingResult.unmappedFields.join(', ')}. Found: ${available || 'none'}`);
      }

      let successCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const rowIndex = i + 2;
        const validation = validateRow(rows[i], rowIndex);

        if (validation.errors.length > 0) {
          errors.push(`Row ${rowIndex}: ${validation.errors.join('; ')}`);
          continue;
        }

        const { propertyType, roomRentals, streetAddress, city, state, zipCode, beds, baths } = validation;

        const isSingleFamilyType = ['singleFamily', 'townhouse', 'condominium'].includes(propertyType);
        const backendPropertyType = isSingleFamilyType ? 'singleFamily' : 'multiUnit';

        const remainingSlots = subscriptionStatus?.remainingUnitSlots ?? Infinity;
        if (remainingSlots !== null && remainingSlots <= 0) {
          errors.push(`Row ${rowIndex}: Cannot add more units. Subscription limit reached.`);
          continue;
        }

        try {
          // Geocode address via Google Maps; if found, use full address; else use CSV values
          let finalStreet = streetAddress.trim();
          let finalCity = city.trim();
          let finalState = state.trim();
          let finalZip = zipCode.trim();
          const geocoded = await geocodeAddress(streetAddress, city, state, zipCode);
          if (geocoded && (geocoded.streetAddress || geocoded.city || geocoded.state || geocoded.zipCode)) {
            finalStreet = geocoded.streetAddress || finalStreet;
            finalCity = geocoded.city || finalCity;
            finalState = geocoded.state || finalState;
            finalZip = geocoded.zipCode || finalZip;
          }

          const fullAddress = buildFullAddress(finalStreet, finalCity, finalState, finalZip);
          const imageFile = await fetchPropertyImageFromAddress(fullAddress);

          const payload = {
            name: null,
            propertyType: backendPropertyType,
            streetAddress: finalStreet,
            city: finalCity,
            state: finalState,
            zipCode: finalZip,
            primaryManagerId: user?.Id ?? user?.id,
            operatingAccountId: null,
            unitCount: null
          };

          const created = await createProperty(payload, imageFile || null, { suppressSuccessSnackbar: true });

          if (!created?.id) {
            errors.push(`Row ${rowIndex}: Failed to add property (${streetAddress})`);
            continue;
          }

          const unitPayload = {
            id: 0,
            name: 'Unit 1',
            bedrooms: beds,
            baths,
            squareFeet: 0,
            isOccupied: false,
            PropertyId: created.id,
            type: '',
            rentAmount: 0,
            amenities: [],
            includedUtility: []
          };

          const unitResult = await dispatch(addOrUpdateUnit(unitPayload));

          if (!unitResult) {
            errors.push(`Row ${rowIndex}: Property created but unit creation failed (${streetAddress})`);
          }

          successCount++;
        } catch (err) {
          const msg = err?.response?.data?.message || err?.message || 'Unknown error';
          errors.push(`Row ${rowIndex}: ${msg}`);
        }
      }

      setResults({ successCount, errors, total: rows.length });
      dispatch(getProperties());

      if (successCount > 0) {
        openSnackbar({
          open: true,
          message: `Successfully imported ${successCount} propert${successCount === 1 ? 'y' : 'ies'}${errors.length > 0 ? `. ${errors.length} error(s) occurred.` : ''}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
      }

      if (errors.length > 0 && successCount === 0) {
        openSnackbar({
          open: true,
          message: 'Failed to import properties. Check the error list below.',
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

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Properties', path: '/landlord/properties' },
          { label: 'Import' }
        ]}
      />

      <MainCard sx={{ mt: 3 }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h4" fontWeight={600}>
              Import Properties
            </Typography>
            <Button
              size="small"
              startIcon={<ArrowLeftOutlined />}
              onClick={() => navigate('/landlord/properties')}
              sx={{ textTransform: 'none' }}
            >
              Back to Properties
            </Button>
          </Box>

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
              Keep using this template for the cleanest import. If your CSV has different column names, the AI import agent will auto-map matching fields before importing.
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
                  <TableCell>property_type</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Single-Family House, Townhouse, Condominium, Small Multi-Family, Apartment Building, Other Types</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>room_rentals</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>true/false or yes/no</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>street_address</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Street address text</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>city</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>City name</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>state</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>State (e.g., CA, TX)</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>zip_code</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Zip code</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>beds</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Number of bedrooms (0-10) for first/only unit</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>baths</TableCell>
                  <TableCell>Yes</TableCell>
                  <TableCell>Number of bathrooms (e.g., 0.5, 1, 1.5, 2)</TableCell>
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
              {`property_type,room_rentals,street_address,city,state,zip_code,beds,baths
Single-Family House,false,123 Main St,Austin,TX,78701,3,2
Townhouse,false,200 Elm St,Austin,TX,78702,2,2
Condominium,false,300 Cedar Dr,Austin,TX,78703,2,1.5
Small Multi-Family,true,456 Oak Ave,Houston,TX,77001,2,1.5
Apartment Building,false,500 Pine Rd,Houston,TX,77002,1,1
Other Types,false,600 Maple Ln,Houston,TX,77003,2,1`}
            </Box>

            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
              For multi-unit property types (Small Multi-Family, Apartment Building, Other Types), only the first unit is created. You can add more units later from the property page.
            </Typography>
          </Paper>

          {/* Download Template */}
          <Box sx={{ mb: 1 }}>
            <CSVLink
              data={SAMPLE_CSV}
              filename="property-import-template.csv"
              headers={REQUIRED_COLUMNS}
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
              id="property-csv-input"
            />
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <label htmlFor="property-csv-input">
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
                {results.successCount} of {results.total} propert{results.total === 1 ? 'y' : 'ies'} imported successfully.
                {results.errors.length > 0 && ` ${results.errors.length} error(s).`}
              </Alert>
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
