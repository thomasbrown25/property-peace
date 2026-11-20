import { alpha } from '@mui/material/styles';

export const chatConversationRowButtonSx = {
  py: 1.25,
  pl: 1.5,
  pr: 0.5,
  minWidth: 0,
  flex: 1,
  alignItems: 'center',
  borderRadius: 0
};

export function getChatStyles(theme) {
  const dark = theme.palette.mode === 'dark';
  const { primary, divider } = theme.palette;
  const messagesDivider = dark ? alpha(primary.main, 0.18) : alpha(divider, 0.72);

  return {
    messagesDivider,
    messagesSoftDivider: dark ? alpha(primary.main, 0.12) : alpha(divider, 0.58),
    messagesCardBorder: dark ? alpha(primary.main, 0.2) : alpha(divider, 0.72),
    messagesDashedBorder: dark ? alpha(primary.main, 0.24) : alpha(divider, 0.85),
    messagesPanelShadow: dark ? `0 18px 42px ${alpha('#020617', 0.36)}` : 'none',
    messagesCardShadow: dark ? `0 10px 26px ${alpha('#020617', 0.26)}` : 'none',
    messageFilterSx: {
      minHeight: 30,
      minWidth: 0,
      borderRadius: 999,
      px: 1,
      textTransform: 'none',
      whiteSpace: 'nowrap',
      fontSize: '0.75rem',
      fontWeight: 600,
      borderColor: messagesDivider,
      color: 'text.primary',
      '&:hover': { borderColor: 'primary.main', bgcolor: alpha(primary.main, 0.08) },
      '&[aria-pressed="true"]': {
        bgcolor: alpha(primary.main, dark ? 0.22 : 0.1),
        borderColor: 'primary.main',
        color: dark ? primary.light : primary.main
      }
    }
  };
}
