export interface IGroupStat {
  xp: number;
  sessions: number;
}

export interface IState {
  version: number;
  updated_at: string;
  xp_total: number;
  level: number;
  xp_in_level: number;
  xp_to_next: number;
  stats: {
    prompts: number;
    actions: Record<string, number>;
    sessions: number;
    by_source: Record<string, IGroupStat>;
    by_repo: Record<string, IGroupStat>;
  };
}
