import { createContext } from "react";

export const ScriptStateContext = createContext({
  currentTime: 0,
  setCurrentTime: () => {},
  focusRequest: null,
  setFocusRequest: () => {},
  activePanelId: null,
  setActivePanelId: () => {},
});
