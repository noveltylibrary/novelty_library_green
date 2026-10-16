# v1.128 – Faster "View in Blog" / blog review pages

Cause: the public review page only learned its blog link after the `blog-posts` edge function
crawled all of Blogger live (up to 3 sequential requests) on every visit, with no shared cache.

Changes (browser-side only; no Supabase / edge function / SQL changes):
- `src/lib/blog.ts`: archive cached in memory + localStorage (`nl_blog_archive_v1`), one shared in-flight
  request, stale-while-revalidate (cached copy returned instantly, refreshed in background after 10 min),
  new `peekBlogPosts()` and `warmBlogPosts()`.
- `src/App.tsx`: archive warmed in the background (idle) when the site opens.
- `src/pages/ReviewPage.tsx`: blog link/poster merge applied instantly from the cache, refreshed after.
- `src/pages/BlogReviewPage.tsx`: renders instantly from cache, no skeleton on repeat visits.
