// Mirrors core `IAdvanceOption.kind` (denormalized into state.class.advance). Defined app-side so the
// webview compares against an enum without importing a core runtime enum (the seam — same reason the
// "a"|"b" branch literals are not a core enum here). Keep the string values in sync with core.
export enum AdvanceKind {
  Class = "class",
  Branch = "branch",
  Respec = "respec",
}
