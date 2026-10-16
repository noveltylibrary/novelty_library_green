# v1.131 – Featured poster strip + Admins & Contacts tabs
- Home: new PES-style wide (16:9) poster strip between the Submit/Reviews buttons and the shortcut cards. Swipe on phones, arrows/dots on desktop, slow auto-slide (pauses on touch/hover, off for reduced motion). Hidden until posters are published.
- Admin → Admins & Contacts is now 3 tabs: Control (admin access + Support email, unchanged), Notifications (existing panel), Announcements (new). Routes: /admin/admins, /admin/notifications, /admin/announcements.
- Announcements: upload up to 10 posters (6 recommended, 1600x900), title/caption/link per poster, reorder, show/hide, auto-slide speed, heading, live preview, and "Import from HTML" parser into the fixed poster format (only https image/title/caption/link are read; scripts ignored).
- Storage: images in the existing `posters` bucket (admin upload policy), settings in the existing `editable_pages` row `home-announcement-posters`. No SQL / Supabase changes.
