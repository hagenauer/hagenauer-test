const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async function (event) {
  try {
    const artikelnummer = (event.queryStringParameters?.artikelnummer || "").trim();

    // Artikelnr. is always 7 digits
    if (!/^[0-9]{7}$/.test(artikelnummer)) {
      return json(400, {
        error: "Valid 7-digit Artikelnummer is required."
      });
    }

    // Call Supabase SQL function
    // This function removes empty columns and created_at
    const { data, error } = await supabase.rpc("get_artikel_details", {
      p_artikelnummer: artikelnummer
    });

    if (error) {
      console.error("Supabase detail error:", error);

      return json(500, {
        error: "Supabase detail query failed.",
        details: error.message
      });
    }

    if (!data || Object.keys(data).length === 0) {
      return json(404, {
        error: "Artikel not found."
      });
    }

    return json(200, {
      artikel: data
    });

  } catch (err) {
    console.error("Unexpected detail error:", err);

    return json(500, {
      error: "Unexpected server error.",
      details: err.message
    });
  }
};
