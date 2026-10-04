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
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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

      // IMPORTANT: Review No. is a shared sequence across the Google Sheet
      // and website submissions. Never use the Sheet's number as the identity
      // of a master_list row: a website review may already have claimed that
      // number. The stable identity of an imported Sheet row is its
      // sheet_row_index. Existing Sheet rows keep their already-assigned
      // Review No.; a genuinely new Sheet row gets MAX(master_list.review_no)+1.
      const existingRes = await fetch(
        `${supabaseUrl}/rest/v1/master_list?select=id,review_no,sheet_row_index`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        }
      );
      const existingRows = existingRes.ok
        ? ((await existingRes.json()) as { id: string; review_no: string; sheet_row_index: number | null }[])
        : [];
      const existingIdBySheetRow = new Map<number, { id: string; review_no: string }>();
      let maxReviewNo = 0;
      for (const existing of existingRows) {
        const n = Number.parseInt((existing.review_no || '').trim(), 10);
        if (Number.isFinite(n) && n > maxReviewNo) maxReviewNo = n;
        if (existing.sheet_row_index != null) {
          existingIdBySheetRow.set(Number(existing.sheet_row_index), {
            id: existing.id,
            review_no: existing.review_no || '',
          });
        }
      }

      const nowIso = new Date().toISOString();
      const toInsert: (MasterRow & { updated_at: string })[] = [];
      const toUpdate: (MasterRow & { id: string; updated_at: string })[] = [];

      for (const row of parsedRows) {
        const existingSheetRow = existingIdBySheetRow.get(row.sheet_row_index);
        if (existingSheetRow) {
          // The Sheet's displayed Review No. is informational after import.
          // Preserve the number already assigned in master_list so a Sheet row
          // numbered 238 cannot overwrite a website-created #238.
          toUpdate.push({
            ...row,
            review_no: existingSheetRow.review_no,
            id: existingSheetRow.id,
            updated_at: nowIso,
          });
        } else {
          // New Sheet row: assign the next number in the shared sequence,
          // regardless of the number typed in the Google Sheet.
          maxReviewNo += 1;
          toInsert.push({ ...row, review_no: String(maxReviewNo), updated_at: nowIso });
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
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
