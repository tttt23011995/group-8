import { createContext, useContext } from 'react';

interface RefreshContextValue {
  refreshKey: number;
  triggerRefresh: () => void;
}

export const RefreshContext = createContext<RefreshContextValue>({
  refreshKey: 0,
  triggerRefresh: () => {},
});

export function useRefresh() {
  return useContext(RefreshContext);
}
