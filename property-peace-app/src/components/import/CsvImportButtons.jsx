import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { ImportOutlined } from '@ant-design/icons';
import { useDispatch } from 'react-redux';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import useCreateProperty from 'hooks/useCreateProperty';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { parseCSV, aiMapCsvRowsWithAgent, IMPORT_FIELD_DEFINITIONS } from 'utils/aiCsvImportAgent';
import { getAllTenants } from 'store/tenant/tenant.action';
import { addVendor, getVendors } from 'store/vendor/vendor.action';
import { addOrUpdateUnit } from 'store/unit/unit.action';
import { getProperties } from 'store/property/property.action';
import { geocodeAddress, fetchPropertyImageFromAddress, buildFullAddress } from 'utils/propertyImportAddress';

const PROPERTY_TYPE_MAP = {
  'single-family house': 'singleFamily',
  'single family': 'singleFamily',
  singlefamily: 'singleFamily',
  townhouse: 'townhouse',
  condominium: 'condominium',
  condo: 'condominium',
  'small multi-family': 'smallMultiFamily',
  smallmultifamily: 'smallMultiFamily',
  multifamily: 'smallMultiFamily',
  'multi family': 'smallMultiFamily',
  'apartment building': 'apartmentBuilding',
  apartmentbuilding: 'apartmentBuilding',
  apartment: 'apartmentBuilding',
  'other types': 'other',
  other: 'other'
};

function parseBool(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', ''].includes(normalized)) return false;
  return null;
}

function normalizeHeader(header) {
  return String(header || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function getRowValue(row, ...keys) {
  for (const key of keys) {
    const normalized = normalizeHeader(key);
    for (const header of Object.keys(row || {})) {
      if (normalizeHeader(header) === normalized) return row[header];
    }
  }
  return '';
}

function mapPropertyTypeToBackend(value) {
  const v = String(value || '').trim().toLowerCase();
  const mapped = PROPERTY_TYPE_MAP[v];
  if (mapped) return mapped;
  const normalized = v.replace(/\s+/g, ' ').replace(/-/g, ' ');
  return PROPERTY_TYPE_MAP[normalized] ?? null;
}

function tenantRowFromMapped(row, rowIndex) {
  return {
    rowIndex,
    values: {
      firstName: String(getRowValue(row, 'first_name', 'firstname', 'first name') || '').trim(),
      lastName: String(getRowValue(row, 'last_name', 'lastname', 'last name') || '').trim(),
      email: String(getRowValue(row, 'email', 'e_mail') || '').trim(),
      phoneNumber: String(getRowValue(row, 'phone_number', 'phonenumber', 'phone number', 'phone') || '').trim()
    }
  };
}

function vendorRowFromMapped(row, rowIndex, landlordId) {
  return {
    rowIndex,
    values: {
      landlordId,
      name: String(row.name || '').trim(),
      businessName: String(row.business_name || '').trim(),
      email: String(row.email || '').trim(),
      phone: String(row.phone || '').trim(),
      category: String(row.category || '').trim(),
      address: String(row.address || '').trim(),
      city: String(row.city || '').trim(),
      state: String(row.state || '').trim(),
      zipCode: String(row.zip_code || '').trim(),
      taxId: String(row.tax_id || '').trim(),
      licenseNumber: String(row.license_number || '').trim(),
      requires1099: String(row.requires_1099 || '').trim(),
      notes: String(row.notes || '').trim()
    }
  };
}

function propertyRowFromMapped(row, rowIndex) {
  const propertyType = String(getRowValue(row, 'property_type', 'propertytype') || '').trim();
  const backendType = mapPropertyTypeToBackend(propertyType);
  return {
    rowIndex,
    values: {
      propertyType,
      propertyTypeBackend: backendType || '',
      propertyName: String(getRowValue(row, 'property_name', 'property name', 'name', 'nickname', 'nick_name') || '').trim(),
      streetAddress: String(getRowValue(row, 'street_address', 'streetaddress', 'street address', 'address') || '').trim(),
      city: String(getRowValue(row, 'city') || '').trim(),
      state: String(getRowValue(row, 'state') || '').trim(),
      zipCode: String(getRowValue(row, 'zip_code', 'zipcode', 'zip code', 'zip') || '').trim(),
      beds: String(getRowValue(row, 'beds', 'bedrooms') || '').trim(),
      baths: String(getRowValue(row, 'baths', 'bathrooms') || '').trim(),
      squareFeet: String(getRowValue(row, 'square_feet', 'square feet', 'sqft', 'sq ft') || '').trim(),
      yearBuilt: String(getRowValue(row, 'year_built', 'year built', 'built', 'built_year') || '').trim()
    }
  };
}

const ACCEPTED_FIELDS = {
  tenants: [
    { label: 'First name', required: true },
    { label: 'Last name', required: true },
    { label: 'Email', required: false },
    { label: 'Phone number', required: false }
  ],
  properties: [
    { label: 'Property type', required: true, helper: 'Single-family, townhouse, condo, small multi-family, apartment building, etc.' },
    { label: 'Property name / nickname', required: false },
    { label: 'Street address', required: true },
    { label: 'City', required: false, helper: 'Accepted. If missing, Property Peace will try Google address lookup from street address.' },
    { label: 'State', required: false, helper: 'Accepted. If missing, Property Peace will try Google address lookup from street address.' },
    { label: 'Zip code', required: false, helper: 'Accepted. If missing, Property Peace will try Google address lookup from street address.' },
    { label: 'Beds', required: true },
    { label: 'Baths', required: true },
    { label: 'Square feet', required: false },
    { label: 'Year built', required: false }
  ],
  vendors: [
    { label: 'Vendor name', required: true },
    { label: 'Business name', required: false },
    { label: 'Email', required: false },
    { label: 'Phone', required: false },
    { label: 'Category / trade', required: false },
    { label: 'Address, city, state, zip', required: false },
    { label: 'Tax ID, license number, 1099 flag, notes', required: false }
  ]
};

function validateField(entityType, key, value) {
  const text = String(value || '').trim();
  if (entityType === 'tenants') {
    if (key === 'firstName' && !text) return 'Required';
    if (key === 'lastName' && !text) return 'Required';
  }

  if (entityType === 'vendors') {
    if (key === 'name' && !text) return 'Required';
  }

  if (entityType === 'properties') {
    if (key === 'propertyType') {
      if (!text) return 'Required';
      if (!mapPropertyTypeToBackend(text)) return 'Use a supported property type';
    }
    if (key === 'streetAddress' && !text) return 'Required';
    if (key === 'beds') {
      const num = parseFloat(text);
      if (!text) return 'Required';
      if (Number.isNaN(num) || num < 0 || num > 50) return 'Enter a valid number';
    }
    if (key === 'baths') {
      const num = parseFloat(text);
      if (!text) return 'Required';
      if (Number.isNaN(num) || num < 0 || num > 50) return 'Enter a valid number';
    }
    if (key === 'squareFeet' && text) {
      const num = parseFloat(text);
      if (Number.isNaN(num) || num < 0) return 'Enter a valid number';
    }
    if (key === 'yearBuilt' && text) {
      const num = parseInt(text, 10);
      if (Number.isNaN(num) || num < 1700 || num > new Date().getFullYear() + 1) return 'Enter a valid year';
    }
  }
  return '';
}

function validateItem(entityType, item, editableColumns) {
  const errors = {};
  editableColumns.forEach((column) => {
    const error = validateField(entityType, column.key, item.values[column.key], item.values);
    if (error) errors[column.key] = error;
  });
  return { ...item, errors };
}

function buildTenantPayload(values) {
  return {
    Firstname: String(values.firstName || '').trim(),
    Lastname: String(values.lastName || '').trim(),
    Email: String(values.email || '').trim() || null,
    PhoneNumber: String(values.phoneNumber || '').trim() || null,
    PropertyId: null,
    UnitId: null,
    LeaseId: null
  };
}

function buildVendorPayload(values) {
  return {
    LandlordId: values.landlordId,
    Name: String(values.name || '').trim(),
    BusinessName: String(values.businessName || '').trim() || null,
    Email: String(values.email || '').trim() || null,
    Phone: String(values.phone || '').trim() || null,
    Category: String(values.category || '').trim() || null,
    Address: String(values.address || '').trim() || null,
    City: String(values.city || '').trim() || null,
    State: String(values.state || '').trim() || null,
    ZipCode: String(values.zipCode || '').trim() || null,
    TaxId: String(values.taxId || '').trim() || null,
    LicenseNumber: String(values.licenseNumber || '').trim() || null,
    Requires1099: parseBool(values.requires1099) ?? false,
    Notes: String(values.notes || '').trim() || null
  };
}

function getImportPluralLabel(label) {
  if (label === 'Property') return 'Properties';
  if (label === 'Tenant') return 'Tenants';
  if (label === 'Vendor') return 'Vendors';
  return `${label}s`;
}

function AcceptedFieldsIntro({ entityType }) {
  const fields = ACCEPTED_FIELDS[entityType] || [];
  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
      <Stack spacing={1.25}>
        <Typography variant="subtitle1" fontWeight={700}>What Property Peace can import</Typography>
        <Typography variant="body2" color="text.secondary">
          Upload your CSV as-is. Property Peace uses AI to map your headers and sample values, so you do not need to rename columns or reformat to a template.
        </Typography>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {fields.map((field) => (
            <Chip
              key={field.label}
              size="small"
              color={field.required ? 'primary' : 'default'}
              variant={field.required ? 'filled' : 'outlined'}
              label={`${field.label}${field.required ? ' *' : ''}`}
            />
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary">* Required. Missing required values can be filled in the next step before importing.</Typography>
        {entityType === 'properties' && (
          <Typography variant="caption" color="text.secondary">
            For properties, city/state/zip are accepted but not required if a street address is present; Property Peace will try to complete the address with Google during creation.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}

function EditablePreviewTable({ columns, items, onValueChange }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 430 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, minWidth: 64 }}>Row</TableCell>
            {columns.map((column) => (
              <TableCell key={column.key} sx={{ fontWeight: 700, minWidth: column.minWidth || 150 }}>
                {column.label}{column.required ? ' *' : ''}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, itemIndex) => (
            <TableRow key={item.rowIndex}>
              <TableCell>{item.rowIndex}</TableCell>
              {columns.map((column) => {
                const error = item.errors?.[column.key];
                return (
                  <TableCell key={column.key}>
                    <TextField
                      value={item.values[column.key] || ''}
                      onChange={(event) => onValueChange(itemIndex, column.key, event.target.value)}
                      size="small"
                      fullWidth
                      required={column.required}
                      error={Boolean(error)}
                      helperText={error || column.helperText || ' '}
                      placeholder={column.placeholder || ''}
                      select={false}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          bgcolor: 'background.paper',
                          ...(error ? { '& fieldset': { borderColor: 'error.main', borderWidth: 2 } } : {})
                        }
                      }}
                    />
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function CsvImportButton({ entityType, label, buttonProps = {}, columns, buildItems, onConfirmImport }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [items, setItems] = useState([]);
  const [mappingInfo, setMappingInfo] = useState(null);
  const [error, setError] = useState('');

  const invalidCount = useMemo(() => items.filter((item) => Object.keys(item.errors || {}).length > 0).length, [items]);
  const readyCount = items.length - invalidCount;
  const canConfirm = items.length > 0 && invalidCount === 0;

  const resetInput = () => {
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClear = () => {
    resetInput();
    setFileName('');
    setItems([]);
    setMappingInfo(null);
    setError('');
  };

  const openImportModal = () => {
    setOpen(true);
    setError('');
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    resetInput();
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      openSnackbar({ open: true, message: 'Please select a CSV file', variant: 'alert', alert: { color: 'error' } });
      return;
    }

    setPreparing(true);
    setError('');
    setItems([]);
    setFileName(file.name);

    try {
      const text = await file.text();
      const parsedRows = parseCSV(text);
      const mapped = await aiMapCsvRowsWithAgent(entityType, parsedRows, IMPORT_FIELD_DEFINITIONS[entityType]);
      if (!mapped.rows.length) throw new Error('No valid rows found in CSV file. Ensure the first row contains headers and data starts on row 2.');
      setMappingInfo(mapped);
      const builtItems = buildItems(mapped.rows).map((item) => validateItem(entityType, item, columns));
      setItems(builtItems);
    } catch (err) {
      const message = err?.message || 'Failed to read CSV file';
      setError(message);
      openSnackbar({ open: true, message, variant: 'alert', alert: { color: 'error' } });
    } finally {
      setPreparing(false);
    }
  };

  const handleValueChange = (itemIndex, key, value) => {
    setItems((prev) =>
      prev.map((item, index) => {
        if (index !== itemIndex) return item;
        const next = { ...item, values: { ...item.values, [key]: value } };
        if (entityType === 'properties' && key === 'propertyType') {
          next.values.propertyTypeBackend = mapPropertyTypeToBackend(value) || '';
        }
        return validateItem(entityType, next, columns);
      })
    );
  };

  const importPluralLabel = getImportPluralLabel(label);

  const handleConfirm = async () => {
    if (!canConfirm) {
      openSnackbar({ open: true, message: 'Fill all required fields before importing.', variant: 'alert', alert: { color: 'error' } });
      return;
    }
    setImporting(true);
    try {
      const result = await onConfirmImport(items);
      setOpen(false);
      setItems([]);
      setFileName('');
      setMappingInfo(null);
      openSnackbar({
        open: true,
        message: result?.message || `Successfully imported ${items.length} ${importPluralLabel.toLowerCase()}.`,
        variant: 'alert',
        alert: { color: result?.errors?.length ? 'warning' : 'success' }
      });
    } catch (err) {
      openSnackbar({ open: true, message: err?.message || `Failed to import ${importPluralLabel.toLowerCase()}`, variant: 'alert', alert: { color: 'error' } });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept=".csv" onChange={handleFileSelected} style={{ display: 'none' }} />
      <Button
        size="small"
        variant="outlined"
        startIcon={preparing ? <CircularProgress size={14} color="inherit" /> : <ImportOutlined />}
        onClick={openImportModal}
        disabled={preparing || importing || buttonProps.disabled}
        {...buttonProps}
      >
        {preparing ? 'Reading CSV...' : 'Import'}
      </Button>

      <Dialog
        open={open}
        onClose={importing ? undefined : () => setOpen(false)}
        maxWidth="md"
        fullWidth
        sx={{
          '& .MuiDialog-paper': {
            width: '100%',
            maxWidth: 820
          }
        }}
      >
        <DialogTitle>Import {importPluralLabel}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <AcceptedFieldsIntro entityType={entityType} />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button
                variant="contained"
                startIcon={preparing ? <CircularProgress size={16} color="inherit" /> : <ImportOutlined />}
                onClick={() => inputRef.current?.click()}
                disabled={preparing || importing}
                sx={{ textTransform: 'none' }}
              >
                {fileName ? 'Choose Different CSV' : 'Choose CSV File'}
              </Button>
              <Typography variant="body2" color="text.secondary">
                {fileName ? `Selected: ${fileName}` : 'Select your CSV when ready.'}
              </Typography>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}

            {items.length > 0 && (
              <>
                <Alert severity={invalidCount > 0 ? 'warning' : 'success'}>
                  {readyCount} of {items.length} row{items.length === 1 ? '' : 's'} complete. {invalidCount > 0 && `${invalidCount} row${invalidCount === 1 ? '' : 's'} need required values filled before you can confirm.`}
                </Alert>
                <EditablePreviewTable columns={columns} items={items} onValueChange={handleValueChange} />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={importing} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            onClick={handleClear}
            disabled={importing || (!fileName && !items.length && !error)}
            sx={{ textTransform: 'none' }}
          >
            Clear
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={importing || !canConfirm}
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <ImportOutlined />}
            sx={{ textTransform: 'none' }}
          >
            {importing ? 'Importing...' : `Confirm Import (${items.length || 0})`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function TenantCsvImportButton({ buttonProps }) {
  const dispatch = useDispatch();
  const columns = [
    { key: 'firstName', label: 'First Name', required: true },
    { key: 'lastName', label: 'Last Name', required: true },
    { key: 'email', label: 'Email', required: false },
    { key: 'phoneNumber', label: 'Phone', required: false }
  ];

  return (
    <CsvImportButton
      entityType="tenants"
      label="Tenant"
      buttonProps={buttonProps}
      columns={columns}
      buildItems={(rows) => rows.map((row, index) => tenantRowFromMapped(row, index + 2))}
      onConfirmImport={async (items) => {
        const errors = [];
        let successCount = 0;
        for (const item of items) {
          try {
            const response = await axiosServices.post('/api/tenant', buildTenantPayload(item.values));
            if (response?.data?.data?.Id || response?.data?.data?.id) successCount++;
            else errors.push(`Row ${item.rowIndex}: Failed to create tenant`);
          } catch (err) {
            errors.push(`Row ${item.rowIndex}: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
          }
        }
        await dispatch(getAllTenants());
        return { message: `Successfully imported ${successCount} tenant${successCount === 1 ? '' : 's'}${errors.length ? `. ${errors.length} row(s) had issues.` : ''}`, errors };
      }}
    />
  );
}

export function VendorCsvImportButton({ buttonProps }) {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const landlordId = user?.id ?? user?.Id;
  const columns = [
    { key: 'name', label: 'Name', required: true },
    { key: 'businessName', label: 'Business', required: false },
    { key: 'email', label: 'Email', required: false },
    { key: 'phone', label: 'Phone', required: false },
    { key: 'category', label: 'Category', required: false }
  ];

  return (
    <CsvImportButton
      entityType="vendors"
      label="Vendor"
      buttonProps={buttonProps}
      columns={columns}
      buildItems={(rows) => rows.map((row, index) => vendorRowFromMapped(row, index + 2, landlordId))}
      onConfirmImport={async (items) => {
        const errors = [];
        let successCount = 0;
        for (const item of items) {
          const result = await dispatch(addVendor(buildVendorPayload(item.values)));
          if (result?.success) successCount++;
          else errors.push(`Row ${item.rowIndex}: ${result?.message || 'Failed to create vendor'}`);
        }
        await dispatch(getVendors(landlordId, false));
        return { message: `Successfully imported ${successCount} vendor${successCount === 1 ? '' : 's'}${errors.length ? `. ${errors.length} row(s) had issues.` : ''}`, errors };
      }}
    />
  );
}

export function PropertyCsvImportButton({ buttonProps }) {
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const { createProperty } = useCreateProperty();
  const columns = [
    { key: 'propertyType', label: 'Property Type', required: true, placeholder: 'Single-Family House' },
    { key: 'propertyName', label: 'Name / Nickname', required: false },
    { key: 'streetAddress', label: 'Street Address', required: true },
    { key: 'city', label: 'City', required: false },
    { key: 'state', label: 'State', required: false },
    { key: 'zipCode', label: 'Zip', required: false },
    { key: 'beds', label: 'Beds', required: true },
    { key: 'baths', label: 'Baths', required: true },
    { key: 'squareFeet', label: 'Sq Ft', required: false },
    { key: 'yearBuilt', label: 'Year Built', required: false }
  ];

  return (
    <CsvImportButton
      entityType="properties"
      label="Property"
      buttonProps={buttonProps}
      columns={columns}
      buildItems={(rows) => rows.map((row, index) => propertyRowFromMapped(row, index + 2))}
      onConfirmImport={async (items) => {
        if (subscriptionStatus && !subscriptionStatus.canAddProperty) {
          throw new Error(subscriptionStatus.upgradeMessage || 'Your subscription is not active. Please activate your subscription to add properties.');
        }

        const errors = [];
        let successCount = 0;
        for (const item of items) {
          const { propertyType, propertyName, streetAddress, city, state, zipCode, beds, baths, squareFeet } = item.values;
          const mappedType = mapPropertyTypeToBackend(propertyType);
          const isSingleFamilyType = ['singleFamily', 'townhouse', 'condominium'].includes(mappedType);
          const backendPropertyType = isSingleFamilyType ? 'singleFamily' : 'multiUnit';

          try {
            let finalStreet = String(streetAddress || '').trim();
            let finalCity = String(city || '').trim();
            let finalState = String(state || '').trim();
            let finalZip = String(zipCode || '').trim();
            const geocoded = await geocodeAddress(finalStreet, finalCity, finalState, finalZip);
            if (geocoded && (geocoded.streetAddress || geocoded.city || geocoded.state || geocoded.zipCode)) {
              finalStreet = geocoded.streetAddress || finalStreet;
              finalCity = geocoded.city || finalCity;
              finalState = geocoded.state || finalState;
              finalZip = geocoded.zipCode || finalZip;
            }

            const fullAddress = buildFullAddress(finalStreet, finalCity, finalState, finalZip);
            const imageFile = await fetchPropertyImageFromAddress(fullAddress);
            const created = await createProperty(
              {
                name: String(propertyName || '').trim() || finalStreet,
                propertyType: backendPropertyType,
                streetAddress: finalStreet,
                city: finalCity,
                state: finalState,
                zipCode: finalZip,
                primaryManagerId: user?.Id ?? user?.id,
                operatingAccountId: null,
                unitCount: null
              },
              imageFile || null,
              { suppressSuccessSnackbar: true }
            );

            if (!created?.id) {
              errors.push(`Row ${item.rowIndex}: Failed to add property (${streetAddress})`);
              continue;
            }

            const unitResult = await dispatch(addOrUpdateUnit({
              id: 0,
              name: 'Unit 1',
              bedrooms: beds,
              baths,
              squareFeet: squareFeet ? Number(squareFeet) : 0,
              isOccupied: false,
              PropertyId: created.id,
              type: '',
              rentAmount: 0,
              amenities: [],
              includedUtility: []
            }));

            if (!unitResult) errors.push(`Row ${item.rowIndex}: Property created but unit creation failed (${streetAddress})`);
            successCount++;
          } catch (err) {
            errors.push(`Row ${item.rowIndex}: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
          }
        }
        dispatch(getProperties());
        return { message: `Successfully imported ${successCount} propert${successCount === 1 ? 'y' : 'ies'}${errors.length ? `. ${errors.length} row(s) had issues.` : ''}`, errors };
      }}
    />
  );
}
