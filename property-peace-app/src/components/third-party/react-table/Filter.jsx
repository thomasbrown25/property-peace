import PropTypes from 'prop-types';
// material-ui
import { Stack } from '@mui/material';

// project imports
import DebouncedInput from './DebouncedInput';

// assets
import MinusOutlined from '@ant-design/icons/MinusOutlined';

const filterStyle = { fontSize: 12, '& .MuiOutlinedInput-input': { p: 1 } };

// ==============================|| FILTER - NUMBER FIELD ||============================== //

function NumberInput({ columnFilterValue, getFacetedMinMaxValues, setFilterValue }) {
  const minOpt = getFacetedMinMaxValues()?.[0];
  const min = Number(minOpt ?? '');

  const maxOpt = getFacetedMinMaxValues()?.[1];
  const max = Number(maxOpt || 0);

  return (
    <Stack direction="row" sx={{ gap: 0.5, alignItems: 'center' }}>
      <DebouncedInput
        type="number"
        value={columnFilterValue?.[0] ?? ''}
        onFilterChange={(value) => setFilterValue((old) => [value, old?.[1]])}
        placeholder={`Min ${minOpt ? `(${min})` : ''}`}
        fullWidth
        slotProps={{ input: { min: min, max: max } }}
        startIcon={false}
        sx={filterStyle}
      />
      <MinusOutlined color="disabled" />
      <DebouncedInput
        type="number"
        value={columnFilterValue?.[1] ?? ''}
        onFilterChange={(value) => setFilterValue((old) => [old?.[0], value])}
        placeholder={`Max ${maxOpt ? `(${max})` : ''}`}
        fullWidth
        slotProps={{ input: { min: min, max: max } }}
        startIcon={false}
        sx={filterStyle}
      />
    </Stack>
  );
}

// ==============================|| FILTER - TEXT FIELD ||============================== //

function TextInput({ columnId, columnFilterValue, header, setFilterValue }) {
  const dataListId = columnId + 'list';

  return (
    <DebouncedInput
      type="text"
      fullWidth
      value={columnFilterValue ?? ''}
      onFilterChange={(value) => setFilterValue(value)}
      placeholder={`Search ${header}`}
      slotProps={{ input: { list: dataListId } }}
      startIcon={false}
      sx={filterStyle}
    />
  );
}

// ==============================|| FILTER - INPUT ||============================== //

export default function Filter({ column, table }) {
  const firstValue = table.getPreFilteredRowModel().flatRows[0]?.getValue(column.id);

  const columnFilterValue = column.getFilterValue();

  return typeof firstValue === 'number' ? (
    <NumberInput
      columnFilterValue={columnFilterValue}
      getFacetedMinMaxValues={column.getFacetedMinMaxValues}
      setFilterValue={column.setFilterValue}
    />
  ) : (
    <TextInput
      columnId={column.id}
      columnFilterValue={columnFilterValue}
      setFilterValue={column.setFilterValue}
      header={column.columnDef.header}
    />
  );
}

NumberInput.propTypes = { columnFilterValue: PropTypes.number, getFacetedMinMaxValues: PropTypes.func, setFilterValue: PropTypes.func };

TextInput.propTypes = {
  columnId: PropTypes.string,
  columnFilterValue: PropTypes.string,
  header: PropTypes.string,
  setFilterValue: PropTypes.func
};

Filter.propTypes = { column: PropTypes.object, table: PropTypes.object };
