import PropTypes from 'prop-types';
import { TableCell, Stack } from '@mui/material';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

/**
 * Sortable table header cell component
 * Displays column name with sort indicator
 */
export default function SortableTableHeader({ 
  field, 
  sortField, 
  sortOrder, 
  onSort, 
  children, 
  align = 'left',
  sx = {} 
}) {
  const isActive = sortField === field;
  
  return (
    <TableCell
      sx={{
        fontWeight: 600,
        cursor: 'pointer',
        userSelect: 'none',
        fontFamily: "'Host Grotesk', sans-serif",
        ...sx
      }}
      onClick={onSort}
      align={align}
    >
      <Stack 
        direction="row" 
        spacing={0.5} 
        alignItems="center"
        justifyContent={align === 'right' ? 'flex-end' : 'flex-start'}
      >
        <span>{children}</span>
        {isActive && (
          sortOrder === 'asc' 
            ? <ArrowUpOutlined style={{ fontSize: 12 }} /> 
            : <ArrowDownOutlined style={{ fontSize: 12 }} />
        )}
      </Stack>
    </TableCell>
  );
}

SortableTableHeader.propTypes = {
  field: PropTypes.string.isRequired,
  sortField: PropTypes.string,
  sortOrder: PropTypes.oneOf(['asc', 'desc']),
  onSort: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  align: PropTypes.oneOf(['left', 'right', 'center']),
  sx: PropTypes.object
};

