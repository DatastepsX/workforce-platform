# Workforce Platform

## Project Overview
A Next.js 14 workforce management platform with Supabase authentication.

## Tech Stack
- **Framework**: Next.js 14 (App Router, `src/` directory)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **Auth & DB**: Supabase (`@supabase/ssr` for cookie-based SSR auth)

## Project Structure
```
src/
  app/
    layout.tsx          # Root layout
    page.tsx            # Redirects to /login
    login/page.tsx      # Email/password login (Client Component)
    dashboard/page.tsx  # Protected page (Server Component)
  lib/
    supabase/
      client.ts         # Browser Supabase client (createBrowserClient)
      server.ts         # Server Supabase client (createServerClient + cookies)
    utils.ts            # shadcn cn() helper
  components/ui/        # shadcn/ui components
  middleware.ts         # Route protection: /dashboard → /login if unauthenticated
```

## Auth Pattern
- `src/lib/supabase/client.ts` — used in Client Components and event handlers
- `src/lib/supabase/server.ts` — used in Server Components and Server Actions
- `src/middleware.ts` — redirects unauthenticated users away from `/dashboard`, and authenticated users away from `/login`

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
