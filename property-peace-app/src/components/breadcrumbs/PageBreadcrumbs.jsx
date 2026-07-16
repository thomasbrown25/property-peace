import { Breadcrumbs, Link, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

/**
 * Reusable breadcrumb component for page navigation
 * @param {Array} items - Array of breadcrumb items. Each item should have:
 *   - label: string - The text to display
 *   - path: string (optional) - The route to navigate to. If not provided, item is not clickable
 * @param {string} separator - Custom separator (default: '›')
 */
export default function PageBreadcrumbs({ items = [], separator = '›' }) {
  const navigate = useNavigate();

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <Breadcrumbs sx={{ mb: 2 }} separator={separator} aria-label="breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const linkPath = item.path ?? item.to;
        
        if (isLast || !linkPath) {
          // Last item or item without path - not clickable
          return (
            <Typography key={index} color="text.primary" fontWeight={500}>
              {item.label}
            </Typography>
          );
        }
        
        // Clickable item
        return (
          <Link
            key={index}
            component="button"
            onClick={() => navigate(linkPath)}
            sx={{
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' },
              cursor: 'pointer'
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}

