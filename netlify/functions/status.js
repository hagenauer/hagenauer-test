const { Client } = require("pg");

exports.handler = async (event, context) => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL, // From Netlify environment variable
  });

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  // Required for CORS
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers };
  }

  try {
    await client.connect();

    // -------- GET --------
    if (event.httpMethod === "GET") {
      const params = event.queryStringParameters || {};
      const itemId = params.itemId;

      if (itemId) {
        // Fetch one item
        const result = await client.query(
          "SELECT item_id, status, remark, updated_at FROM item_states WHERE item_id = $1",
          [itemId]
        );
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(result.rows[0] || null),
        };
      } else {
        // Fetch all items
        const result = await client.query(
          "SELECT item_id, status, remark, updated_at FROM item_states"
        );

        const map = {};
        for (const row of result.rows) {
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

    // -------- POST --------
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

      const result = await client.query(
        `
        INSERT INTO item_states (item_id, status, remark)
        VALUES ($1, $2, $3)
        ON CONFLICT (item_id)
        DO UPDATE SET status = EXCLUDED.status,
                      remark = EXCLUDED.remark,
                      updated_at = NOW()
        RETURNING item_id, status, remark, updated_at;
        `,
        [itemId, status, remark || null]
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(result.rows[0]),
      };
    }

    return { statusCode: 405, headers, body: "Method Not Allowed" };
  } catch (error) {
    console.error("Error in Netlify function:", error);
    return { statusCode: 500, headers, body: "Server error" };
  } finally {
    await client.end();
  }
};
