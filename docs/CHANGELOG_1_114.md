# Novelty Library v1.114

## Publishing Queue manual metadata overrides

- The Save action now sends the manually entered Blogger post URL to the persistence layer instead of silently omitting it.
- The save helper attempts to store `blog_url` in `community_reviews` when that optional column exists, then safely retries without it on deployments where the column is absent. It also attempts the optional legacy `master_list.blog_url` field when applicable.
- When neither database table has a `blog_url` column, manual Blogger URLs are retained in browser local storage and take precedence over future Blogger crawl results on refresh.
- Manually changed `Published On` values are saved to `community_reviews.published_on` and retained as overrides so a delayed Blogger crawl cannot replace them.
- The Save action now updates the visible queue row in place instead of reloading the full queue immediately.
- Individual published review pages now prefer the saved admin blog URL over a crawler match, so the public “View in Blog” button follows the manual correction.
- Optional migration: `sql/blog_url_publishing_queue_1_114.sql` adds the nullable `community_reviews.blog_url` column if the deployment does not have it. It is idempotent and does not alter policies or existing records. Applying it makes manual blog URLs persist across browsers and devices.
