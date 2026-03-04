export const patientTheme = {
  fonts: {
    heading: '"Avenir Next", "Trebuchet MS", "Segoe UI Variable", sans-serif',
    body: '"Avenir Next", "Segoe UI Variable", "Segoe UI", sans-serif',
  },
  colors: {
    ink: '#14213d',
    inkMuted: '#4a5a77',
    surface: '#fffdf8',
    surfaceMuted: '#f4f1ea',
    line: '#d9d3c4',
    accent: '#1949b8',
    accentStrong: '#102b7a',
    accentSoft: '#dfeafe',
    success: '#10765c',
    warning: '#c36b0c',
    danger: '#b93b35',
    stone: '#e7e1d3',
    white: '#ffffff',
  },
  shadows: {
    panel: '0 20px 60px rgba(20, 33, 61, 0.12)',
    card: '0 14px 30px rgba(20, 33, 61, 0.08)',
  },
  radius: {
    xl: '28px',
    lg: '22px',
    md: '16px',
    sm: '12px',
  },
};

export const heroBackdrop = `
  radial-gradient(circle at top left, rgba(25,73,184,0.18), transparent 32%),
  radial-gradient(circle at top right, rgba(16,43,122,0.12), transparent 28%),
  linear-gradient(180deg, #f7f3ea 0%, #fffdf8 44%, #f3f6fb 100%)
`;

export const panelBorder = `1px solid ${patientTheme.colors.line}`;
