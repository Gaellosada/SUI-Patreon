# Creator Profile Page

This directory contains the creator/profile view when a user looks up a wallet address or SuiNS name and clicks "View".

## Structure for contributors

- `page.tsx` - Main profile page (extend with profile content)
- `components/` - Profile-specific components (create as needed)
- `hooks/` - Custom hooks for fetching profile data (create as needed)

## Extending

1. Add profile data fetching in a custom hook (e.g. `hooks/useCreatorProfile.ts`)
2. Add UI components in `components/` (e.g. `CreatorHeader`, `CreatorPosts`)
3. Compose them in `page.tsx`
