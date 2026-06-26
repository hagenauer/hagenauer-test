const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TABLE_NAME = process.env.SUPABASE_TABLE || "alles zusammen";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function cleanArtikelRow(row) {
  const cleaned = {};

  for (const [key, value] of Object.entries(row)) {
    // Always hide created_at
    if (key === "created_at") continue;

    // Hide empty values
    if (value === null || value === undefined) continue;
    if (String(value).trim() === "") continue;

    cleaned[key] = value;
  }

  return cleaned;
}

exports.handler = async function (event) {
  try {
    const artikelnummer = (event.queryStringParameters?.artikelnummer || "").trim();

    if (!/^[0-9]{7}$/.test(artikelnummer)) {
      return json(400, {
        error: "Valid 7-digit Artikelnummer is required."
      });
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("*")
      .eq("Artikelnr.", artikelnummer)
      .limit(1);

    if (error) {
      console.error(error);
      return json(500, {
        error: "Supabase detail query failed."
      });
    }

    if (!data || data.length === 0) {
      return json(404, {
        error: "Artikel not found."
      });
    }

    const cleanedArtikel = cleanArtikelRow(data[0]);

    return json(200, {
      artikel: cleanedArtikel
    });

  } catch (err) {
    console.error(err);
    return json(500, {
      error: "Unexpected server error."
    });
  }
};