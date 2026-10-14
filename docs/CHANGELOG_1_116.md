# Novelty Library v1.116 — Public Community Reviews ordering

- The reader-facing Community Reviews page now sorts all published reviews by Review No. in descending numeric order.
- Numeric parsing handles values such as `48`, `#48`, and `Review No. 48`, so #48 appears above #30 and #100 above #99.
- Entries with missing or unreadable Review No. values are placed after numbered reviews.
- The change is limited to the public Community Reviews page; the admin Publishing Queue is unchanged from v1.114.
- No SQL or database schema changes.
