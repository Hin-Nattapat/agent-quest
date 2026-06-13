import { ActivityState } from "./activity";

export enum HeroAnim {
  Farming = "farming",
  Idle = "idle",
  Rest = "rest",
  Attack = "attack",
  Hurt = "hurt",
  Celebrate = "celebrate",
}

export enum MonsterAnim {
  Idle = "idle",
  Hurt = "hurt",
  Attack = "attack",
  Die = "die",
}

export const MONSTER_HITS = 5; // cosmetic: hits to kill the ambient monster

export interface IHitResult {
  hits: number; // hits after this strike (reset to 0 on death = respawn)
  died: boolean;
}

export const hitMonster = (hits: number): IHitResult => {
  const next = hits + 1;
  const died = next >= MONSTER_HITS;
  return { hits: died ? 0 : next, died };
};

const HERO_BASE: Record<ActivityState, HeroAnim> = {
  [ActivityState.Farming]: HeroAnim.Farming,
  [ActivityState.Idle]: HeroAnim.Idle,
  [ActivityState.Rest]: HeroAnim.Rest,
};

export interface IHeroAnimArgs {
  celebrate: boolean;
  hurt: boolean;
  attack: boolean;
  activity: ActivityState;
}

export const heroAnim = (props: IHeroAnimArgs): HeroAnim => {
  const { celebrate, hurt, attack, activity } = props;
  if (celebrate) {
    return HeroAnim.Celebrate;
  }
  if (hurt) {
    return HeroAnim.Hurt;
  }
  if (attack) {
    return HeroAnim.Attack;
  }
  return HERO_BASE[activity];
};

export interface IMonsterAnimArgs {
  dying: boolean;
  attacking: boolean;
  hurt: boolean;
}

export const monsterAnim = (props: IMonsterAnimArgs): MonsterAnim => {
  const { dying, attacking, hurt } = props;
  if (dying) {
    return MonsterAnim.Die;
  }
  if (attacking) {
    return MonsterAnim.Attack;
  }
  if (hurt) {
    return MonsterAnim.Hurt;
  }
  return MonsterAnim.Idle;
};
