Vercel build fix

The previous deployment failed because src/App.tsx imported @/pages/ReviewsPage, but the file was not present in the Vercel checkout at commit 935be6c.
This archive includes src/pages/ReviewsPage.tsx and makes the import explicit in src/App.tsx. Confirm both files are committed to the repository root used as the Vercel Root Directory before redeploying.
The PWA glob warning is non-fatal and is unrelated to this missing-module error.
