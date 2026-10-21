// ══════════════════════════════════════════════════════════════════
//  KIDORA — Service Espace Parent (§25)
// ══════════════════════════════════════════════════════════════════

import { api } from "./api";
import type { ChildDashboard, ChildSummary } from "../types";

export const parentService = {
  children() {
    return api<{ children: ChildSummary[] }>("/parent/children");
  },

  dashboard(profileId: string) {
    return api<ChildDashboard>(`/parent/dashboard/${profileId}`);
  },
};
