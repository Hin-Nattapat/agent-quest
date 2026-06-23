// Echelon formation for up to 3 ambient pack mobs (slot 0 = front, struck first). Same-size mobs
// spread on BOTH axes — each step recedes up-and-toward-centre — so depth reads from the staircase,
// not from shrinking sprites. The hit-effect layer reuses these so a slash lands on its mob — keep
// it the single source.
export interface ISlotPos {
  right: string;
  bottom: string;
}

const MOB_SLOTS: ISlotPos[] = [
  { right: "10%", bottom: "8%" }, // front — closest: low, far right
  { right: "19%", bottom: "15%" }, // mid
  { right: "28%", bottom: "22%" }, // back — furthest: high, toward centre
];

export const slotPos = (slot: number): ISlotPos => {
  return MOB_SLOTS[slot] ?? MOB_SLOTS[MOB_SLOTS.length - 1];
};
