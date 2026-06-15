// FF2-style staggered formation for up to 3 ambient pack mobs (slot 0 = front, struck first).
// The hit-effect layer reuses these so a slash lands on its mob — keep it the single source.
export interface ISlotPos {
  right: string;
  bottom: string;
}

const MOB_SLOTS: ISlotPos[] = [
  { right: "13%", bottom: "20%" }, // front
  { right: "22%", bottom: "30%" }, // mid
  { right: "16%", bottom: "42%" }, // back
];

export const slotPos = (slot: number): ISlotPos => {
  return MOB_SLOTS[slot] ?? MOB_SLOTS[MOB_SLOTS.length - 1];
};
