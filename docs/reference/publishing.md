# Publishing the companion extension

How to ship `app/extension` to the **VS Code Marketplace** (and optionally **Open VSX** for
Cursor / VSCodium / Windsurf). You run these — they need _your_ publisher account + token.

> **Before the first publish: make the GitHub repo public.** The Marketplace listing, README image
> (`app/public/splash.png`), badges, and the `curl | bash` installer all resolve against
> `raw.githubusercontent.com` / the repo URL — they 404 while the repo is private.
> `gh repo edit Hin-Nattapat/commit-quest --visibility public --accept-visibility-change-consequences`

## One-time setup

1. **Create a publisher** at <https://marketplace.visualstudio.com/manage>. The publisher ID **must
   match** `publisher` in `app/extension/package.json` (currently `natpat`).
2. **Create a Personal Access Token (PAT)** in Azure DevOps (<https://dev.azure.com>):
   - Organization: **All accessible organizations**
   - Scopes: **Marketplace → Manage**
   - Copy the token (shown once).
3. Log in once: `cd app/extension && npx vsce login natpat` (paste the PAT).

## Publish

```bash
cd app/extension
npm run publish            # = build:all (vite → copy-webview → esbuild) then `vsce publish`
```

`vsce publish` reads the version from `package.json`. To bump while publishing:
`npx vsce publish minor` (or `patch` / `major`) — commit the version bump afterward.

Verify the live listing:
<https://marketplace.visualstudio.com/items?itemName=natpat.commit-quest-companion>

## Open VSX (optional — Cursor / VSCodium / Windsurf)

1. Create a token at <https://open-vsx.org> (sign in with GitHub → Access Tokens), and create the
   `natpat` namespace once: `npx ovsx create-namespace natpat -p <token>`.
2. Publish: `cd app/extension && OVSX_PAT=<token> npm run publish:ovsx`.

## Checklist before publishing

- [ ] Repo is public.
- [ ] `npm run build:all` succeeds and the panel works from the freshly packaged `.vsix`
      (`npm run reinstall`, reload window).
- [ ] `media/icon.png` is 128×128 and `package.json` has `categories`, `keywords`, `galleryBanner`,
      `license`, `repository`.
- [ ] `app/extension/README.md` (the Marketplace listing) reads well — it is shown verbatim on the
      Marketplace page.
- [ ] Version bumped if this isn't the first release.
