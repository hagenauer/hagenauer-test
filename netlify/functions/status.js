const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function supabaseHeaders(serviceKey) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };
}

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL; // e.g. https://xxxx.supabase.co
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // service_role key

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error:
          "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in Netlify Environment Variables",
      }),
    };
  }

  const BASE = `${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/item_states`;

  try {
    // -------- GET --------
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      const itemId = params.itemId;

      if (itemId) {
        // Fetch one item
        const url =
          `${BASE}?item_id=eq.${encodeURIComponent(itemId)}` +
          `&select=item_id,status,remark,updated_at`;

        const res = await fetch(url, {
          method: "GET",
          headers: supabaseHeaders(SERVICE_KEY),
        });

        const data = await res.json();

        if (!res.ok) {
          return {
            statusCode: res.status,
            headers,
            body: JSON.stringify({ error: data }),
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(data[0] || null),
        };
      } else {
        // Fetch all items
        const url = `${BASE}?select=item_id,status,remark,updated_at`;

        const res = await fetch(url, {
          method: "GET",
          headers: supabaseHeaders(SERVICE_KEY),
        });

        const rows = await res.json();

        if (!res.ok) {
          return {
            statusCode: res.status,
            headers,
            body: JSON.stringify({ error: rows }),
          };
        }

        const map = {};
        for (const row of rows) {
          map[row.item_id] = {
            status: row.status,
            remark: row.remark,
            updated_at: row.updated_at,
          };
        }

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(map),
        };
      }
    }

    // -------- POST (UPSERT) --------
    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body || "{}");
      const { itemId, status, remark } = data;

      if (!itemId || !status) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "itemId and status are required" }),
        };
      }

      // Upsert requires item_id to be PRIMARY KEY or UNIQUE (you already set PK)
      const payload = {
        item_id: itemId,
        status,
        remark: remark || null,
        updated_at: new Date().toISOString(),
      };

      const res = await fetch(BASE, {
        method: "POST",
        headers: {
          ...supabaseHeaders(SERVICE_KEY),
          "Content-Type": "application/json",
          // merge-duplicates = UPSERT
          // return=representation = return updated row
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(payload),
      });

      const out = await res.json();

      if (!res.ok) {
        return {
          statusCode: res.status,
          headers,
          body: JSON.stringify({ error: out }),
        };
      }

      // Supabase returns array of rows
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(out[0] || out),
      };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (error) {
    console.error("Error in Netlify function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || String(error) }),
    };
  }
};



