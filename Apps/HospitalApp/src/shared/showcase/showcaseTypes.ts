import type { View } from '../ui/NavBar';

export interface ShowcaseStep {
  id: string;
  target: string;
  view?: View;
  actionId?: string;
  title: string;
  description: string;
  side?: 'top' | 'right' | 'bottom' | 'left' | 'over';
  align?: 'start' | 'center' | 'end';
}

export interface ShowcaseTour {
  id: string;
  label: string;
  steps: ShowcaseStep[];
}

export interface ShowcaseNavigationAdapter {
  currentView: View;
  availableViews: View[];
  navigateTo: (view: View) => void;
}
