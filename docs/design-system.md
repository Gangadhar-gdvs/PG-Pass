# PGPass Design System — "Lavender Glass 3D"

**Source of truth:** the four reference screens in `docs/screenshots/`
(`admin-panel.png`, `owner-dashboard.png`, `resident-portal.png`, `landing.png`).
Every token below was sampled from those images. Admin, Owner and Resident
panels share **one** theme — there are no per-panel accent colours.

Implementation lives in:

| Layer | File |
|---|---|
| Tokens, canvas, surfaces, motion | `app/globals.css` (`@theme` + `@layer components`) |
| Font + toaster | `app/layout.tsx` (Plus Jakarta Sans) |
| Logo | `components/brand/Logo.tsx` (`<Logo/>`, `<LogoMark/>`, `<Wordmark/>`) |
| 3D icons | `components/brand/Icon3D.tsx` (`<Icon3D/>`, `<IconTile/>`, `<IconBubble/>`, `<GlyphTile/>`) + `public/brand/icons/*.png` |
| 3D illustrations | `components/brand/Illustration.tsx` + `public/brand/illus/*.png` |
| Primitives | `components/ui/*` (Button, Card, Badge, Input/Textarea/SearchInput, Dropdown, Drawer, ConfirmDialog, TabBar, DataTable, EmptyState, Skeletons, Avatar, …) |
| Page kit | `components/ui/dashboard-kit.tsx` (HeroHeader, PageHeader, StatTile, QuickActionGrid, SectionCard, SectionHeader, ActivityRow, DonutChart, InfoBanner, FilterChips, KeyValue, ArrowDot, HeroAction) |
| Navigation | `components/ui/bottom-tab-bar.tsx`, `app/(owner)/OwnerShell.tsx`, `components/owner/OwnerTopBar.tsx`, `app/(resident)/ResidentShell.tsx` |

---

## 1. Visual language (what the references do)

- **Canvas** — soft lavender (`#EEE8FE`) lit by blurred light blobs: purple top-left,
  blue top-right, lilac bottom. It is painted once by `body::before`; pages must
  **not** set their own page background (no `bg-white`/`bg-slate-50` wrappers).
- **Surfaces** — frosted white glass cards (`.app-card`), radius 22px, white 1px rim,
  lavender depth shadow. Never a grey hairline box on white.
- **Ink** — deep navy-indigo `#1A1870` for headings and primary text; indigo-grey
  `#3B3577` body; `#6F6A9A` captions; `#A59ECB` placeholders.
- **Brand** — violet `#7B3FF2`, gradient `#A066FF → #7B3FF2 → #6123E6` for primary
  buttons, the FAB, active tabs/nav, and highlighted words (`.text-gradient`).
- **Pastel tiles** carry 3D icons: violet, indigo, sky, mint, peach, rose, amber, slate
  (`.tint-card .tint-<name>`). Tiles are gradients (lighter top-left → richer bottom-right).
- **3D icons** — glossy icons from the refs (house, people, bed, wallet, ₹ coin, wrench,
  bell, document, calendar, megaphone, check, chart…). Used for stat tiles, quick
  actions, section headers, list bubbles, feature tiles, empty states.
  **Small UI glyphs** (chevrons, arrows, inputs, nav bar, buttons) stay Lucide line icons.
- **Typography** — Plus Jakarta Sans everywhere. Headings 800 weight, tight tracking.
  Numbers use the same family with tabular figures (`.font-mono-numbers`). True
  monospace (`font-mono`) only for tokens/IDs/UTRs.
- **Shape** — pills for buttons/chips/badges/tabs; 16px tiles; 22px cards; 28px sheets.
- **Motion** — `animate-fade-up` page entrance, `.stagger` lists, `.press` (scale .97),
  `.lift` hover, `animate-pop` for appearing banners, `animate-float` on hero art.
  All respect `prefers-reduced-motion`.

## 2. Tokens (Tailwind classes)

| Purpose | Class |
|---|---|
| Heading / primary text | `text-ink` |
| Body / secondary | `text-ink-2` |
| Caption / meta | `text-muted` |
| Placeholder / disabled | `text-faint` |
| Divider | `border-line`, `divide-line` |
| Input border | `border-line-strong` |
| Subtle fill inside a card | `bg-lilac`, `bg-lilac-2`, `.well` |
| Brand | `text-brand`, `text-brand-700` (links), `bg-brand-50/100/200`, `bg-[image:var(--grad-brand)]` |
| Success | `text-success`, `text-success-ink`, `bg-success-bg`, `border-success-line` |
| Warning (pending, due) | `text-warning`, `text-warning-ink`, `bg-warning-bg`, `border-warning-line` |
| Danger | `text-danger`, `text-danger-ink`, `bg-danger-bg`, `border-danger-line` |
| Info | `text-info`, `text-info-ink`, `bg-info-bg`, `border-info-line` |

`slate-*`/`gray-*` are remapped to the lavender-indigo neutral scale, and
`amber-*` to the warm orange scale, so legacy classes still land on-palette — but
prefer the semantic tokens above in new code. **Never hard-code hex colours in
pages.** (Gradient stops inside the kit are the only exception.)

### Status mapping (use consistently)

| Meaning | Badge variant | Colour family |
|---|---|---|
| Paid / resolved / active / success | `paid` | success (green) |
| Pending / due / open / warning | `pending` | warning (orange) |
| Awaiting verification / in progress / brand info | `verify` / `brand` | violet |
| Vacant / inactive / archived | `vacant` | lilac |
| Overdue / failed / suspended / destructive | `danger` | danger (rose-red) |
| Informational | `cyan` | info (blue) |

## 3. Surfaces & utilities

| Class | Use |
|---|---|
| `.app-card` | Default card / section container (glass). Pad with `p-4 sm:p-5`. |
| `.glass-solid` | Opaque white card for very dense data. |
| `.glass-bar` | Sticky headers / footers (backdrop blur). |
| `.well` | Inset lilac box inside a card (summaries, quoted info, code-like values). |
| `.tint-card .tint-<tint>` | Pastel 3D tile. |
| `.icon-bubble .tint-<tint>` | Round pastel bubble behind an icon. |
| `.hero-gradient` | Violet gradient hero card (owner welcome, CTA band). |
| `.text-gradient` | Violet gradient text for the emphasised word(s). |
| `.chip` | Lavender chip ("This Month", dates, counts). |
| `.field` | Raw `<input>/<textarea>/<select>` that can't use the kit components. |
| `.btn-pill` / `.btn-soft` | Link styled as primary / secondary pill. |

## 4. Components — how to build pages

### Page anatomy (every internal page)
```tsx
<div className="space-y-5">
  <PageHeader icon="wrench" tint="sky" title="Maintenance" subtitle="Track and resolve issues"
    actions={<Button><Plus className="h-4 w-4" />New request</Button>} />
  {/* optional stat row */}
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <StatTile icon="alert" tint="peach" label="Open" value={3} />
    …
  </div>
  {/* filters */}
  <FilterChips options={…} value={filter} onChange={setFilter} />  {/* or <TabBar/> */}
  {/* content */}
  <SectionCard title="Requests" icon="tools">
    <div className="divide-y divide-line">{items.map(i => <ActivityRow … />)}</div>
  </SectionCard>
</div>
```

### Dashboards
- `HeroHeader variant="gradient"` (owner style: violet card, white text, `illustration="hero-owner"`)
  or `variant="light"` (admin / resident style: on-canvas, gradient name, `illustration="hero-admin" | "hero-resident"`).
- Stat row of `StatTile`s (3D icon, big number, label, `ArrowDot` when linked).
- `SectionCard` with `DonutChart` for occupancy/overview.
- `QuickActionGrid` (`layout="grid"` admin/owner, `layout="list"` resident).
- `SectionCard title="Recent Activity" icon="clock"` with `ActivityRow`s.

### Lists & tables
- Card list: `SectionCard` + `divide-y divide-line` + `ActivityRow` (or custom rows using `IconBubble`).
- Tabular data: `DataTable` (glass card, stacked cards on phones).
- Search: `SearchInput`. Filters: `FilterChips` or `TabBar` (pill).

### Forms
- `Input`, `Textarea`, `Dropdown`, `PhoneInput`, `OtpInput` — never raw unstyled controls.
  If a raw control is unavoidable (file input, month picker, range), give it `.field`.
- Group fields in an `.app-card p-5 space-y-4`; primary action = `<Button>` (violet pill),
  secondary = `<Button variant="outline">`.

### Dialogs, sheets, feedback
- `Drawer` (bottom sheet on phones, side sheet on desktop) for detail / create / edit flows.
- `ConfirmDialog` for destructive confirmation.
- `InfoBanner tone=…` for any coloured alert/notice block (replaces ad-hoc red/amber/blue boxes).
- `EmptyState` with `icon3d` or `illustration="clipboard"` for empty lists.
- Loading: the shaped skeletons in `components/ui/skeletons.tsx`.
- Toasts are themed globally (`react-hot-toast`).

### Kit options worth knowing
- `Button size="icon" | "icon-sm"` — round icon-only buttons (44/40px). Don't squeeze `md` with `w-11`.
- `ProgressBar color="brand"` (default violet) · `"amber"` (warning orange) · `"emerald"` · `"coral"`.
- `StatTile caption` — small secondary line; `PageHeader icon` accepts a 3D icon name **or** a node (e.g. `<GlyphTile/>`).
- `InfoBanner` — `title` optional, `iconSize` (default 40).
- `EmptyState tint` — bubble tint for `icon3d`/`icon`.
- `HeroHeader actionsClassName` — e.g. `"hidden sm:flex"` when the same actions exist as Quick Actions on phones.
- `components/brand/AuthShell.tsx` — shared sign-in layout (`AuthShell`, `AuthLoader`).
- Animations use fill-mode `backwards` on purpose: a lingering `transform` would capture
  `position: fixed` descendants (drawers/dialogs).

### Buttons
| Variant | Look | Use |
|---|---|---|
| `solid` (default) | violet gradient pill + glow | primary action |
| `outline` | white glass pill | secondary |
| `soft` | lavender pill, violet text | tertiary in-card |
| `ghost` | text only, lilac hover | inline / icon buttons |
| `success` / `destructive` | green / rose gradient | confirm-paid / delete |

Don't recolour buttons through `className` (`bg-[#…]`) or inline `style={{background}}` —
pick a variant.

### 3D icon vocabulary (suggested mapping)
| Concept | Icon3D | Tint |
|---|---|---|
| Properties / PGs | `building`, `house`, `home-blue` | violet / sky |
| Beds / rooms / guests | `bed`, `bed-teal` | sky / mint |
| Residents / users | `users`, `residents`, `users-purple` | sky / violet |
| Owner / person | `person` | mint |
| Staff | `staff` | indigo |
| Add person / visitors | `user-add` | sky |
| Rent / payments / revenue | `rupee`, `rupee-badge`, `wallet`, `wallet-sm` | mint / violet |
| Expenses | `wallet-orange` | peach |
| Maintenance | `wrench`, `wrench-orange`, `tools`, `tools-purple` | sky / peach |
| Notices / reminders | `bell`, `bell-purple`, `bell-green`, `megaphone` | peach / violet |
| Reports / documents / receipts | `report`, `doc`, `doc-green` | indigo / mint |
| Dates / schedules | `calendar`, `calendar-clock`, `clock` | violet |
| Analytics | `chart` | violet |
| Success / paid / verified | `check` | mint |
| Warning / overdue / error | `alert` | peach / rose |
| Quick actions / features | `bolt`, `grid`, `star` | — |

For concepts with no 3D icon (settings, chat, security keys) use `<GlyphTile icon={Lucide}/>`.

### Illustrations
`hero-admin`, `hero-owner`, `hero-resident`, `hero-landing`, `shield-orbit`, `clipboard`, `bell-cta`
via `<Illustration name width />`. Heroes on dashboards/auth/landing; `clipboard` for empty
states; `shield-orbit` for security/privacy; `bell-cta` for reminders/CTA.

## 5. Navigation
- **Home only gets the app bar** (owner `/dashboard`, resident `/resident/home`): PG switcher with an
  inline dropdown on the left, avatar on the right → `/profile` (owner full profile page).
- **Every other page owns its header:** `PageHeader` is a compact frosted bar that stays pinned
  (`sticky`, below the notch) while the page scrolls. On phones its `actions` render just below the
  bar (they scroll away); from `sm` up they sit inside it. Optional `back={{ href, label }}`.
- Shell `<main>` uses `overflow-x-clip`, **never** `overflow-x-hidden` (that makes it a scroll
  container and silently breaks sticky headers).
- **Bottom tab bar:** solid white, fills to the screen edge (`viewportFit: 'cover'` + safe-area
  padding), labelled icons with a violet underline marker, and a 56px gradient centre button that
  stays inside the bar. Content pads `pb-[calc(6rem+env(safe-area-inset-bottom))]`.
- **Desktop (md+):** floating glass sidebar; its identity block links to `/profile`.
- **Staff menus** are filtered by permission via `canAccessPage()` (`lib/constants/navAccess.ts`). When adding an
  owner page, add its rule to `STAFF_PAGE_ACCESS` (a unit test enforces this).
- **Sign-in screens** (`AuthShell`, admin login) must fit one phone screen with no scrolling
  (checked at 390×664 and 360×640): headline + form on phones; description, bullets and 3D scene
  from `md` up; size with `100dvh`, not `100vh`.

## 6. Don'ts
- No `bg-white` page wrappers, grey `border-[#E2E8F0]` boxes, `rounded-[6px]` corners,
  uppercase micro-labels (`text-[10px] uppercase tracking-wider`) as the primary label style,
  amber/teal/indigo accents, or black (`bg-[#09090B]`) buttons.
- No default browser controls (unstyled select/checkbox/file inputs).
- Don't change behaviour, data flow, API calls, permissions or copy meaning while restyling.
