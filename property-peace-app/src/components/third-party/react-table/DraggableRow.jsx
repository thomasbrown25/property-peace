import PropTypes from 'prop-types';

// material-ui
import { IconButton } from '@mui/material';
import { TableCell } from '@mui/material';
import { TableRow } from '@mui/material';

// third party
import { useDraggable, useDroppable } from '@dnd-kit/core';

// assets
import DragOutlined from '@ant-design/icons/DragOutlined';

// ==============================|| DRAGGABLE ROW ||============================== //

export default function DraggableRow({ row, children }) {
  const { setNodeRef: setDropRef, isOver: isOverCurrent } = useDroppable({ id: `row-${row.id}` });

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: `row-${row.id}` });

  return (
    <TableRow ref={setDropRef} sx={{ opacity: isDragging ? 0.5 : 1, bgcolor: isOverCurrent ? 'primary.lighter' : 'inherit' }}>
      <TableCell>
        <IconButton
          ref={setDragRef}
          {...listeners}
          {...attributes}
          size="small"
          color="secondary"
          disabled={row.getIsGrouped()}
          sx={{ p: 0, width: 24, height: 24, fontSize: '1rem', mr: 0.75 }}
        >
          <DragOutlined />
        </IconButton>
      </TableCell>
      {children}
    </TableRow>
  );
}

DraggableRow.propTypes = { row: PropTypes.object, reorderRow: PropTypes.func, children: PropTypes.node };
