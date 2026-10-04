// Legacy inline-style theme. Live screens use the CSS design system in
// src/styles; this remains only for modules that have not been removed yet.
export const patientTheme = {
  fonts: {
    heading: "'Instrument Serif', Georgia, serif",
    body: "'Instrument Sans Variable', 'Instrument Sans', ui-sans-serif, system-ui, sans-serif",
  },
  colors: {
    ink: '#0E1630',
    inkMuted: '#4A5167',
    surface: '#FFFFFF',
    surfaceMuted: '#FBFBF9',
    line: 'rgba(14, 22, 48, 0.12)',
    accent: '#2986FF',
    accentStrong: '#0067DE',
    accentSoft: '#E7EFFB',
    success: '#146C43',
    warning: '#8A5300',
    danger: '#B42318',
    stone: '#EFEFEA',
    white: '#ffffff',
  },
  shadows: {
    panel: '0 1px 2px rgba(14, 22, 48, 0.04), 0 14px 30px -22px rgba(14, 22, 48, 0.22)',
    card: '0 1px 2px rgba(14, 22, 48, 0.04)',
  },
  radius: {
    xl: '28px',
    lg: '24px',
    md: '20px',
    sm: '14px',
  },
};

export const heroBackdrop = '#F4F3EF';

export const panelBorder = `1px solid ${patientTheme.colors.line}`;
