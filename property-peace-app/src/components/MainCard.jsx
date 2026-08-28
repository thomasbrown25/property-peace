import { forwardRef } from 'react';
import PropTypes from 'prop-types';

// material-ui
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';

const MainCard = forwardRef(
  (
    {
      border = true,
      boxShadow,
      children,
      subheader,
      content = true,
      contentSX = {},
      darkTitle,
      divider = true,
      elevation,
      secondary,
      shadow,
      sx = {},
      title,
      accentColor,
      accentShadow = false,
      codeHighlight = false,
      codeString,
      modal = false,
      ...others
    },
    ref
  ) => {
    return (
      <Card
        ref={ref}
        elevation={elevation || 0}
        sx={(theme) => ({
          position: 'relative',
          ...(border && {
            border: `1px solid ${theme.palette.mode === 'dark' ? alpha('#dbe7f3', 0.2) : alpha(theme.palette.divider, 0.14)}`
          }),
          '--card-accent': accentColor || theme.palette.primary.main,
          borderRadius: 2.25,
          boxShadow: boxShadow ? shadow || `0 1px 3px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.28 : 0.08)}` : 'none',
          backgroundImage: 'none',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
          ':hover': {
            boxShadow: boxShadow ? shadow || `0 2px 10px ${alpha(theme.palette.common.black, theme.palette.mode === 'dark' ? 0.32 : 0.1)}` : 'none'
          },
          ...(theme.palette.mode === 'dark' && {
            borderColor: accentShadow ? alpha(theme.palette.primary.main, 0.42) : alpha('#dbe7f3', 0.2),
            boxShadow: accentShadow
              ? `0 18px 46px ${alpha(theme.palette.common.black, 0.26)}, 0 0 0 1px ${alpha(accentColor || theme.palette.primary.main, 0.2)}, 0 0 28px ${alpha(accentColor || theme.palette.primary.main, 0.16)}`
              : boxShadow ? shadow || `0 1px 3px ${alpha(theme.palette.common.black, 0.28)}` : 'none',
            backgroundColor: theme.palette.background.paper,
            backgroundImage: `linear-gradient(180deg, ${alpha('#ffffff', 0.045)} 0%, ${alpha(accentColor || theme.palette.primary.main, 0.025)} 100%)`,
            ':hover': {
              boxShadow: accentShadow
                ? `0 20px 52px ${alpha(theme.palette.common.black, 0.3)}, 0 0 0 1px ${alpha(accentColor || theme.palette.primary.main, 0.28)}, 0 0 34px ${alpha(accentColor || theme.palette.primary.main, 0.2)}`
                : boxShadow ? shadow || `0 2px 10px ${alpha(theme.palette.common.black, 0.32)}` : 'none',
              borderColor: accentShadow ? alpha(theme.palette.primary.main, 0.52) : alpha('#dbe7f3', 0.2)
            }
          }),
          ...(theme.palette.mode === 'light' && accentShadow && {
            borderColor: alpha(theme.palette.divider, 0.8),
            boxShadow: `0 14px 36px ${alpha(theme.palette.common.black, 0.06)}`,
            backgroundColor: theme.palette.common.white,
            backgroundImage: 'none',
            ':hover': {
              boxShadow: `0 16px 42px ${alpha(theme.palette.common.black, 0.08)}`,
              borderColor: alpha(theme.palette.divider, 0.95)
            }
          }),
          ...(codeHighlight && {
            '& pre': { margin: 0, padding: '12px !important', fontFamily: theme.typography.fontFamily, fontSize: '0.75rem' }
          }),
          ...(modal && {
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: { xs: `calc(100% - 50px)`, sm: 'auto' },
            maxWidth: 768
          }),
          ...(typeof sx === 'function' ? sx(theme) : sx || {})
        })}
        {...others}
      >
        {/* card header and action */}
        {title && (
          <CardHeader
            sx={{ p: 2.5, pb: 2 }}
            slotProps={{ 
              title: { 
                variant: darkTitle ? 'h4' : 'subtitle1',
                sx: { 
                  fontWeight: 600,
                  fontSize: '1rem',
                  lineHeight: 1.5,
                  fontFamily: "'Host Grotesk', sans-serif"
                }
              }, 
              action: { sx: { m: '0px auto', alignSelf: 'center' } } 
            }}
            title={title}
            action={secondary}
            subheader={subheader}
          />
        )}

        {/* content & header divider */}
        {title && divider && (
          <Divider sx={{ borderColor: (theme) => theme.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(theme.palette.divider, 0.08) }} />
        )}

        {/* card content */}
        {content && (
          <CardContent
            sx={contentSX}
            {...(modal && { slotProps: { root: { sx: { overflowY: 'auto', minHeight: 'auto', maxHeight: `calc(100vh - 200px)` } } } })}
          >
            {children}
          </CardContent>
        )}
        {!content && children}

        {/* card footer - clipboard & highlighter  */}
        {/* {codeString && (
        <>
          <Divider sx={{ borderStyle: 'dashed' }} />
          <Highlighter codeString={codeString} codeHighlight={codeHighlight} />
        </>
      )} */}
      </Card>
    );
  }
);

MainCard.propTypes = {
  border: PropTypes.bool,
  boxShadow: PropTypes.bool,
  children: PropTypes.node,
  subheader: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  content: PropTypes.bool,
  contentSX: PropTypes.object,
  darkTitle: PropTypes.bool,
  divider: PropTypes.bool,
  elevation: PropTypes.number,
  secondary: PropTypes.any,
  shadow: PropTypes.string,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  title: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  accentColor: PropTypes.string,
  accentShadow: PropTypes.bool,
  codeHighlight: PropTypes.bool,
  codeString: PropTypes.string,
  modal: PropTypes.bool,
  others: PropTypes.any
};

export default MainCard;
