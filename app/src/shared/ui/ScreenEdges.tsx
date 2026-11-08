import { createContext, useContext } from 'react';
import type { Edge } from 'react-native-safe-area-context';

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];
/** Screens above a bottom tab bar: the bar already covers the home-indicator area. */
export const EDGES_ABOVE_TAB_BAR: readonly Edge[] = ['top', 'right', 'left'];

const ScreenEdgesContext = createContext<readonly Edge[]>(ALL_EDGES);

export const ScreenEdgesProvider = ScreenEdgesContext.Provider;

/** Which screen edges `Screen` keeps clear of notches and system bars. */
export function useScreenEdges(): readonly Edge[] {
  return useContext(ScreenEdgesContext);
}
