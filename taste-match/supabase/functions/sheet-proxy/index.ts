const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/14PSrS1Jve37kI_3eNEr-9IojbzhyaLFEU3iqMRtiI-Q/export?format=csv";

interface MasterRow {
  review_no: string;
  timestamp: string;
  name: string;
  email: string;
  contact_required: string;
  instagram: string;
  website: string;
  book_title: string;
  author: string;
  genre: string;
  series: string;
  book_number: string;
  language: string;
  translated_in: string;
  reviewers_rating: string;
  goodreads_rating: string;
  amazon_rating: string;
  traits: string;
  book_cover: string;
  review: string;
  amazon_link: string;
  review_date: string;
  heard_from: string;
  agreement: string;
  form_rating: string;
  suggestions: string;
  status: string;
  blogger_draft: string;
  sheet_row_index: number;
}

const EXPECTED_COLUMNS = 28;

function parseCSVRecords(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const records: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    records.push(row);
    row = [];
  };

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      if (field.length === 0) {
        inQuotes = true;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === ",") {
      endField();
      i++;
      continue;
    }

    if (char === "\r") {
      i++;
      continue;
    }

    if (char === "\n") {
      endRow();
      i++;
      continue;
    }

    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    endRow();
  }

  return records.filter((r) => r.some((cell) => cell.trim().length > 0));
}

function sanitizeField(value: string): string {
  return value
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .trim();
}

// The database only accepts an empty value or a link that starts with
// http:// or https:// (master_list_amazon_link_scheme_chk). Some sheet cells
// have text in front of the link (e.g. "Book Title https://amzn.in/..."), so
// keep just the first http(s) link, or blank the cell if there is none.
function sanitizeUrl(value: string): string {
  const cleaned = sanitizeField(value);
  if (!cleaned) return "";
  const match = cleaned.match(/https?:\/\/[^\s"'<>]+/i);
  return match ? match[0] : "";
}

function isValidReviewNo(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || /^\d+$/.test(trimmed);
}

function parseCSV(text: string): MasterRow[] {
  const records = parseCSVRecords(text);

  const rows: MasterRow[] = [];
  for (let r = 1; r < records.length; r++) {
    let v = records[r];
    if (!v.some((x) => x.trim())) continue;

    if (v.length < EXPECTED_COLUMNS) {
      v = [...v, ...Array(EXPECTED_COLUMNS - v.length).fill("")];
    } else if (v.length > EXPECTED_COLUMNS) {
      v = v.slice(0, EXPECTED_COLUMNS);
    }

    const reviewNo = sanitizeField(v[0] ?? "");
    const bookTitle = sanitizeField(v[7] ?? "");
    const author = sanitizeField(v[8] ?? "");

    if (!bookTitle && !author) continue;

    if (!/^\d+$/.test(reviewNo)) continue;

    rows.push({
      review_no: reviewNo,
      timestamp: sanitizeField(v[1] ?? ""),
      name: sanitizeField(v[2] ?? ""),
      email: sanitizeField(v[3] ?? ""),
      contact_required: sanitizeField(v[4] ?? ""),
      instagram: sanitizeField(v[5] ?? ""),
      website: sanitizeField(v[6] ?? ""),
      book_title: bookTitle,
      author: author,
      genre: sanitizeField(v[9] ?? ""),
      series: sanitizeField(v[10] ?? ""),
      book_number: sanitizeField(v[11] ?? ""),
      language: sanitizeField(v[12] ?? ""),
      translated_in: sanitizeField(v[13] ?? ""),
      reviewers_rating: sanitizeField(v[14] ?? ""),
      goodreads_rating: sanitizeField(v[15] ?? ""),
      amazon_rating: sanitizeField(v[16] ?? ""),
      traits: sanitizeField(v[17] ?? ""),
      book_cover: sanitizeField(v[18] ?? ""),
      review: sanitizeField(v[19] ?? ""),
      amazon_link: sanitizeUrl(v[20] ?? ""),
      review_date: sanitizeField(v[21] ?? ""),
      heard_from: sanitizeField(v[22] ?? ""),
      agreement: sanitizeField(v[23] ?? ""),
      form_rating: sanitizeField(v[24] ?? ""),
      suggestions: sanitizeField(v[25] ?? ""),
      status: sanitizeField(v[26] ?? ""),
      blogger_draft: sanitizeField(v[27] ?? ""),
      sheet_row_index: rows.length + 1,
    });
  }
  return rows;
}

const jsonError = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Admin gate. Every action on this function reads or writes private data with the service-role key, so the
 * caller must present the signed-in user's own Supabase Auth JWT (Authorization: Bearer <access_token>).
 * The token is checked by calling public.is_admin() *as that user*: PostgREST validates the JWT signature and
 * expiry, and is_admin() answers from auth.uid() (admin_emails + confirmed e-mail). The public anon key is a valid
 * JWT too, but has no auth.uid(), so it is rejected with 403.
 * Returns null when the caller is an admin, otherwise the Response to send back.
 */
async function requireAdmin(req: Request): Promise<Response | null> {
  const match = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return jsonError(401, "Sign in as an admin to use this function.");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/is_admin`, {
      method: "POST",
      headers: {
        ...(anonKey ? { apikey: anonKey } : {}),
        Authorization: `Bearer ${match[1]}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (res.status === 401 || res.status === 403) {
      return jsonError(401, "Your session is invalid or has expired. Please sign in again.");
    }
    if (!res.ok) return jsonError(500, "Could not verify admin access.");
    if ((await res.json()) !== true) return jsonError(403, "Admin access required.");
  } catch (_err) {
    return jsonError(500, "Could not verify admin access.");
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const denied = await requireAdmin(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "csv";

  try {
    if (action === "import") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const res = await fetch(SHEET_CSV_URL, {
        headers: { "User-Agent": "NoveltyLibrary/1.0" },
      });
      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Google Sheets returned ${res.status}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await res.text();
      const totalSheetRows = Math.max(0, parseCSVRecords(text).length - 1);
      const parsedRows = parseCSV(text);

      const existingRes = await fetch(
        `${supabaseUrl}/rest/v1/master_list?select=id,review_no`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      const existingRows = existingRes.ok
        ? ((await existingRes.json()) as { id: string; review_no: string }[])
        : [];
      const existingIdByReviewNo = new Map(
        existingRows
          .filter((r) => (r.review_no || "").trim())
          .map((r) => [r.review_no.trim(), r.id])
      );

      const nowIso = new Date().toISOString();
      const toInsert: (MasterRow & { updated_at: string })[] = [];
      const toUpdate: (MasterRow & { id: string; updated_at: string })[] = [];

      for (const row of parsedRows) {
        const existingId = existingIdByReviewNo.get(row.review_no);
        if (existingId) {
          toUpdate.push({ ...row, id: existingId, updated_at: nowIso });
        } else {
          toInsert.push({ ...row, updated_at: nowIso });
        }
      }

      if (toInsert.length > 0) {
        const insertRes = await fetch(`${supabaseUrl}/rest/v1/master_list`, {
          method: "POST",
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify(toInsert),
        });
        if (!insertRes.ok) {
          const errBody = await insertRes.text();
          return new Response(
            JSON.stringify({ error: `Insert failed: ${errBody}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (toUpdate.length > 0) {
        const updateRes = await fetch(
          `${supabaseUrl}/rest/v1/master_list?on_conflict=id`,
          {
            method: "POST",
            headers: {
              "apikey": serviceKey,
              "Authorization": `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
              "Prefer": "resolution=merge-duplicates,return=minimal",
            },
            body: JSON.stringify(toUpdate),
          }
        );
        if (!updateRes.ok) {
          const errBody = await updateRes.text();
          return new Response(
            JSON.stringify({ error: `Update failed: ${errBody}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const skipped = totalSheetRows - parsedRows.length;
      return new Response(
        JSON.stringify({
          totalInSheet: totalSheetRows,
          imported: toInsert.length,
          updated: toUpdate.length,
          skipped,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "cleanup-junk") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const findRes = await fetch(
        `${supabaseUrl}/rest/v1/master_list?select=id,book_title,author,review_no`,
        {
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        }
      );
      if (!findRes.ok) {
        const errBody = await findRes.text();
        return new Response(
          JSON.stringify({ error: `Lookup failed: ${errBody}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const allRows = (await findRes.json()) as {
        id: string;
        book_title: string | null;
        author: string | null;
        review_no: string | null;
      }[];
      const junkRows = allRows.filter(
        (r) =>
          (!r.book_title?.trim() && !r.author?.trim()) ||
          !isValidReviewNo(r.review_no ?? "")
      );

      if (junkRows.length === 0) {
        return new Response(
          JSON.stringify({ deleted: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ids = junkRows.map((r) => r.id);
      const deleteRes = await fetch(
        `${supabaseUrl}/rest/v1/master_list?id=in.(${ids.join(",")})`,
        {
          method: "DELETE",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        }
      );
      if (!deleteRes.ok) {
        const errBody = await deleteRes.text();
        return new Response(
          JSON.stringify({ error: `Delete failed: ${errBody}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ deleted: junkRows.length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(SHEET_CSV_URL, {
      headers: { "User-Agent": "NoveltyLibrary/1.0" },
    });

    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Google Sheets returned ${res.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const text = await res.text();

    return new Response(text, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv",
        // The sheet contains reviewer e-mails: never let a shared cache keep it.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
