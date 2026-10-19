// Deletes stories (rows + image files) older than 30 days. Highlights are NOT touched: their photos
// live in the separate 'highlights' bucket. Deploy with JWT verification OFF and set the secret CRON_SECRET.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const toPath = (v: string) => (v.includes('/storage/v1/object/public/stories/') ? v.split('/storage/v1/object/public/stories/')[1].split('?')[0] : v);

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) return new Response('forbidden', { status: 403 });
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
  let rows = 0, files = 0;
  for (let round = 0; round < 20; round++) {
    const { data, error } = await sb.from('stories').select('id,image_url').lt('created_at', cutoff).limit(500);
    if (error) return new Response(error.message, { status: 500 });
    if (!data?.length) break;
    const { error: delErr } = await sb.from('stories').delete().in('id', data.map((s) => s.id));
    if (delErr) return new Response(delErr.message, { status: 500 });
    rows += data.length;
    const paths = [...new Set(data.map((s) => toPath(s.image_url)))];
    // A reposted story shares the file: keep it while any newer row still points at it.
    const { data: still } = await sb.from('stories').select('image_url').in('image_url', paths);
    const keep = new Set((still ?? []).map((s) => toPath(s.image_url)));
    const gone = paths.filter((p) => !keep.has(p));
    if (gone.length) { await sb.storage.from('stories').remove(gone); files += gone.length; }
  }
  return new Response(JSON.stringify({ rows, files }), { headers: { 'Content-Type': 'application/json' } });
});
