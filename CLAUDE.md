# WorkforceX Platform

## Vision
Workforce Operating System — not a classic ATS.
Manages permanent hiring, freelancers, contractors, and internal mobility across one unified process.

## Tech Stack
- **Framework**: Next.js 14 (App Router, `src/` directory)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth & DB**: Supabase (PostgreSQL + Auth + Storage, `@supabase/ssr` for cookie-based SSR auth)
- **Deployment**: Vercel — https://workforce-platform-omega.vercel.app
- **Mobile**: Expo React Native SDK 54 at `../workforce-mobile`

## MVP Roles
- `admin` — full access
- `hiring_manager` — creates demands, sees own pipeline
- `recruiter` — manages all demands and candidates
- `candidate` — creates profile, applies to demands
- `supplier` — receives demand requests, submits CVs

## MVP Modules (build in this order)
1. **Roles & Auth** — `profiles` table with role column ← NEXT
2. **Demand Management** — create, list, detail
3. **Demand Distribution** — send demands to suppliers
4. **CV Upload** — candidates and suppliers upload CVs
5. **Basic Matching** — match candidates to demands

## Current Status
- Login + Dashboard running on Vercel and locally
- Apple-inspired design applied to login and dashboard
- No business logic yet — auth only

## Design System
- **Accent**: `#007AFF` (Apple blue)
- **Background**: white (`#FFFFFF`) for pages, `#F2F2F7` for grouped sections
- **Secondary label**: `#8E8E93`
- **Success**: `#34C759`, **Destructive**: `#FF3B30`
- System font (SF Pro on iOS, system-ui on web), minimal spacious layout
- Mobile forms: step-by-step wizard pattern

## Project Structure
```
src/
  app/
    layout.tsx              # Root layout
    page.tsx                # Redirects to /login
    login/page.tsx          # Email/password login (Client Component)
    dashboard/page.tsx      # Protected page (Server Component)
  lib/
    supabase/
      client.ts             # Browser Supabase client (createBrowserClient)
      server.ts             # Server Supabase client (createServerClient + cookies)
    utils.ts                # shadcn cn() helper
  components/ui/            # shadcn/ui components
  middleware.ts             # Route protection: /dashboard → /login if unauthenticated
```

## Auth Pattern
- `src/lib/supabase/client.ts` — used in Client Components and event handlers
- `src/lib/supabase/server.ts` — used in Server Components and Server Actions
- `src/middleware.ts` — redirects unauthenticated users away from protected routes

## Environment Variables
Set in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Development
```bash
npm run dev    # Start dev server on http://localhost:3000
npm run build  # Production build
npm run lint   # ESLint
```

## Adding shadcn Components
```bash
npx shadcn@latest add <component-name>
```
