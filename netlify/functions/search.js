
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
    const q = (event.queryStringParameters?.q || "").trim();

    if (!q) {
      return json(400, {
        error: "Search query is required."
      });
    }

    if (q.length > 120) {
      return json(400, {
        error: "Search query is too long."
      });
    }

    const { data, error } = await supabase.rpc("search_artikel", {
      p_query: q,
      p_limit: 20
    });

    if (error) {
      console.error(error);
      return json(500, {
        error: "Supabase search failed."
      });
    }

    return json(200, {
      results: data || []
    });

  } catch (err) {
    console.error(err);
    return json(500, {
      error: "Unexpected server error."
    });
  }
};