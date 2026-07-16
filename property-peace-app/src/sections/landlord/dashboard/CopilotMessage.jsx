import { Box, Typography, CircularProgress, Chip, Stack } from '@mui/material';
import { alpha } from '@mui/system';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useMemo } from 'react';

// Helper to extract text content from React children
const getTextContent = (children) => {
  if (typeof children === 'string') {
    return children;
  }
  if (Array.isArray(children)) {
    return children.map(child => {
      if (typeof child === 'string') {
        return child;
      }
      if (typeof child === 'object' && child?.props?.children) {
        return getTextContent(child.props.children);
      }
      return '';
    }).join('');
  }
  if (typeof children === 'object' && children?.props?.children) {
    return getTextContent(children.props.children);
  }
  return '';
};

// Component to render text with priority chips
const PriorityText = ({ children }) => {
  const textContent = getTextContent(children);
  
  if (!textContent) {
    return children;
  }

  // Pattern to match priority indicators like:
  // "Overdue Rent Payments (Urgent):"
  // "Unpaid Security Deposits (Medium priority):"
  // "1. Title (Urgent):"
  // Also match variations: "(Urgent)", "(Medium)", "(Low)", "(Medium priority)", "(Low priority)"
  // Match the full pattern: optional number, title (any characters except newline), priority in parentheses, optional colon
  const priorityPattern = /((?:\d+\.\s*)?[^\n(]+?)\s*\(((?:Urgent|Medium(?:\s+priority)?|Low(?:\s+priority)?))\)\s*(:)?/gi;
  
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = priorityPattern.exec(textContent)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: textContent.substring(lastIndex, match.index) });
    }

    const title = match[1].trim();
    const priorityText = match[2];
    const colon = match[3] || '';

    // Determine chip color based on priority
    let chipColor = 'primary'; // Default blue for low
    let chipLabel = priorityText;

    if (priorityText.toLowerCase().includes('urgent')) {
      chipColor = 'error'; // Red
      chipLabel = 'Urgent';
    } else if (priorityText.toLowerCase().includes('medium')) {
      chipColor = 'warning'; // Orange/yellow
      chipLabel = 'Medium';
    } else if (priorityText.toLowerCase().includes('low')) {
      chipColor = 'primary'; // Blue
      chipLabel = 'Low';
    }

    parts.push({
      type: 'priority',
      title,
      chipColor,
      chipLabel,
      colon
    });

    lastIndex = priorityPattern.lastIndex;
  }

  // Add remaining text after last match
  if (lastIndex < textContent.length) {
    parts.push({ type: 'text', content: textContent.substring(lastIndex) });
  }

  // If no matches found, return original
  if (parts.length === 0) {
    return children;
  }

  // Render with chips
  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'priority') {
          return (
            <Stack key={index} direction="row" spacing={1} alignItems="center" component="span" sx={{ display: 'inline-flex', flexWrap: 'wrap', mb: 0.5 }}>
              <Typography component="span">
                {part.title}
              </Typography>
              <Chip
                label={part.chipLabel}
                color={part.chipColor}
                size="small"
                sx={{ height: 24, fontSize: '0.7rem', fontWeight: 'bold' }}
              />
              {part.colon && <Typography component="span">:</Typography>}
            </Stack>
          );
        } else {
          return <span key={index}>{part.content}</span>;
        }
      })}
    </>
  );
};

export default function CopilotMessage({ content, streaming = false, loading = false }) {
  // Custom components for ReactMarkdown to handle priority chips
  const markdownComponents = useMemo(() => ({
    p: ({ children, ...props }) => {
      // Check if paragraph contains priority pattern
      const textContent = getTextContent(children);
      
      // Check if paragraph starts with a number (numbered list item formatted as paragraph)
      const isNumbered = /^\d+\.\s/.test(textContent);
      
      // Check for priority pattern (more flexible matching)
      const hasPriority = textContent && /\(((?:Urgent|Medium(?:\s+priority)?|Low(?:\s+priority)?))\)/i.test(textContent);
      
      if (hasPriority || isNumbered) {
        // Parse the numbered item to extract main point (before colon) and description
        // Pattern: "1. Main Point (Priority): Description text"
        // More flexible pattern that handles various formats
        const numberedItemPattern = /^(\d+\.\s*)(.+?)(\s*\([^)]+\))?\s*(:)?\s*(.*)$/s;
        const match = textContent.match(numberedItemPattern);
        
        if (match && match[2]) {
          const numberPart = match[1]; // "1. "
          let mainPoint = match[2].trim(); // "Main Point" - this should be bold
          const priorityPart = (match[3] || '').trim(); // "(Urgent)" or empty
          const colon = match[4] || ''; // ":" or empty
          const description = (match[5] || '').trim(); // "Description text" - this should NOT be bold
          
          // Extract priority for chip
          let chipColor = 'primary';
          let chipLabel = '';
          if (priorityPart) {
            const priorityMatch = priorityPart.match(/\((Urgent|Medium(?:\s+priority)?|Low(?:\s+priority)?)\)/i);
            if (priorityMatch) {
              const priorityText = priorityMatch[1].toLowerCase();
              if (priorityText.includes('urgent')) {
                chipColor = 'error';
                chipLabel = 'Urgent';
              } else if (priorityText.includes('medium')) {
                chipColor = 'warning';
                chipLabel = 'Medium';
              } else if (priorityText.includes('low')) {
                chipColor = 'primary';
                chipLabel = 'Low';
              }
            }
          }
          
          return (
            <Typography component="p" {...props} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
              <Typography component="span">
                {numberPart}
                {mainPoint}
              </Typography>
              {priorityPart && (
                <>
                  {' '}
                  <Chip
                    label={chipLabel || priorityPart.replace(/[()]/g, '')}
                    color={chipColor}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold', ml: 0.5, verticalAlign: 'middle' }}
                  />
                </>
              )}
              {colon && <Typography component="span">{colon}</Typography>}
              {description && <Typography component="span"> {description}</Typography>}
            </Typography>
          );
        }
        
        // Fallback to PriorityText if pattern doesn't match
        if (hasPriority) {
          return (
            <Typography component="p" {...props} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
              <PriorityText>{children}</PriorityText>
            </Typography>
          );
        }
        
        // Fallback for numbered items without priority
        return (
          <Typography component="p" {...props} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>
            {children}
          </Typography>
        );
      }
      return <Typography component="p" {...props} sx={{ mb: 1.5, '&:last-child': { mb: 0 } }}>{children}</Typography>;
    },
    li: ({ children, ...props }) => {
      // Check if list item contains priority pattern
      const textContent = getTextContent(children);
      
      // Check for priority pattern (more flexible matching)
      const hasPriority = textContent && /\(((?:Urgent|Medium(?:\s+priority)?|Low(?:\s+priority)?))\)/i.test(textContent);
      
      // Check if it's a numbered list item (starts with number)
      const isNumbered = /^\d+\.\s/.test(textContent);
      
      if (hasPriority || isNumbered) {
        // Parse the numbered item to extract main point (before colon) and description
        const numberedItemPattern = /^(\d+\.\s*)(.+?)(\s*\([^)]+\))?\s*(:)?\s*(.*)$/s;
        const match = textContent.match(numberedItemPattern);
        
        if (match && match[2]) {
          const numberPart = match[1]; // "1. "
          let mainPoint = match[2].trim(); // "Main Point" - this should be bold
          const priorityPart = (match[3] || '').trim(); // "(Urgent)" or empty
          const colon = match[4] || ''; // ":" or empty
          const description = (match[5] || '').trim(); // "Description text" - this should NOT be bold
          
          // Extract priority for chip
          let chipColor = 'primary';
          let chipLabel = '';
          if (priorityPart) {
            const priorityMatch = priorityPart.match(/\((Urgent|Medium(?:\s+priority)?|Low(?:\s+priority)?)\)/i);
            if (priorityMatch) {
              const priorityText = priorityMatch[1].toLowerCase();
              if (priorityText.includes('urgent')) {
                chipColor = 'error';
                chipLabel = 'Urgent';
              } else if (priorityText.includes('medium')) {
                chipColor = 'warning';
                chipLabel = 'Medium';
              } else if (priorityText.includes('low')) {
                chipColor = 'primary';
                chipLabel = 'Low';
              }
            }
          }
          
          return (
            <li {...props} style={{ marginBottom: '0.75em', listStylePosition: 'outside' }}>
              <Typography component="span">
                {numberPart}
                {mainPoint}
              </Typography>
              {priorityPart && (
                <>
                  {' '}
                  <Chip
                    label={chipLabel || priorityPart.replace(/[()]/g, '')}
                    color={chipColor}
                    size="small"
                    sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold', ml: 0.5, verticalAlign: 'middle' }}
                  />
                </>
              )}
              {colon && <Typography component="span">{colon}</Typography>}
              {description && <Typography component="span"> {description}</Typography>}
            </li>
          );
        }
        
        // Fallback to PriorityText if pattern doesn't match
        if (hasPriority) {
          return (
            <li {...props} style={{ marginBottom: '0.75em', listStylePosition: 'outside' }}>
              <Typography component="span">
                <PriorityText>{children}</PriorityText>
              </Typography>
            </li>
          );
        }
      }
      
      // Regular list items (not bold)
      return (
        <li {...props} style={{ marginBottom: '0.75em', listStylePosition: 'outside' }}>
          <Typography component="span">
            {children}
          </Typography>
        </li>
      );
    },
    ol: ({ children, ...props }) => {
      return <ol {...props} style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>{children}</ol>;
    },
    ul: ({ children, ...props }) => {
      return <ul {...props} style={{ margin: '0.5em 0', paddingLeft: '1.5em' }}>{children}</ul>;
    }
  }), []);

  if (loading) {
    return (
      <Box
        sx={{
          p: 2,
          borderRadius: 1,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
          minHeight: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
          Generating summary...
        </Typography>
      </Box>
    );
  }

  if (!content) {
    return null;
  }

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: 1,
        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.05),
        border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
        '& p': {
          margin: '0.5em 0',
          '&:first-of-type': { marginTop: 0 },
          '&:last-of-type': { marginBottom: 0 }
        },
        '& ul, & ol': {
          margin: '0.5em 0',
          paddingLeft: '1.5em'
        },
        '& strong': {
          fontWeight: 600,
          color: 'text.primary'
        }
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {streaming && (
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: 8,
            height: 16,
            bgcolor: 'primary.main',
            ml: 0.5,
            animation: 'blink 1s infinite',
            '@keyframes blink': {
              '0%, 50%': { opacity: 1 },
              '51%, 100%': { opacity: 0 }
            }
          }}
        />
      )}
    </Box>
  );
}
