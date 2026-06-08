import { createContext, useContext } from 'react';

interface ThemeContextValue {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
