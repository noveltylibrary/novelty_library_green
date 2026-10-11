# Changelog 1.89

## Admin — Submitted Reviews List
- New **Mark for Review** tab beside Pending / Approved / Declined (new review status `marked`).
- "Mark for Review" now moves a review into that tab (it used to just send it back to Pending); a **Move to Pending** button returns it.
- **Notify** button on every submission with a signed-in reviewer: type a message that lands in their notification bell.
- Accepting a review now automatically notifies the reviewer ("Your review was accepted", with the Review No.).

## Admin — Reserved Book Reviews List
- **Notify** button on every reservation made by a user.
- Accepting a reservation automatically sends a "Your book reservation was accepted" notification.

## Admin — new "Notify Users" section (/admin/notify)
- Hub card + page: searchable contact list, compose title + message, send to one reader or broadcast to everyone.

## Profile (1.88 carry-over)
- Basic Reader section icon: custom reader-with-bookmark SVG (matches by section name or header).
- Ad slot: collapses when no ad rendered; non-personalised frame sends origin referrer.

## Database — run once
`sql/admin_notifications_1_89.sql` (adds the `marked` status and `admin_send_notification`).
