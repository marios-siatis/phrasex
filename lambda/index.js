require('dotenv').config();

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const INSTAGRAM_GRAPH_VERSION =
  process.env.INSTAGRAM_GRAPH_VERSION || '24.0';

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable');
  throw new Error('Missing DATABASE_URL environment variable');
}

const pool = new Pool({
  connectionString: DATABASE_URL,

  ssl: {
    rejectUnauthorized: false
  },

  connectionTimeoutMillis: 10000,
  query_timeout: 15000,
  max: 2
});

async function postToInstagram(
  igUserId,
  accessToken,
  imageUrl,
  caption
) {
  if (!igUserId) {
    throw new Error('Missing Instagram user ID');
  }

  if (!accessToken) {
    throw new Error('Missing Instagram access token');
  }

  if (!imageUrl) {
    throw new Error('Missing image URL');
  }

  // Backend returns the image URL.
  // If it is already HTTPS, use it exactly as returned.
  const imageAbsoluteUrl = imageUrl.startsWith('http')
    ? imageUrl
    : imageUrl;

  console.log(`Posting image: ${imageAbsoluteUrl}`);

  if (!/^https:\/\//i.test(imageAbsoluteUrl)) {
    throw new Error(
      `Instagram image URL must be a public HTTPS URL. Received: ${imageAbsoluteUrl}`
    );
  }

  const createUrl =
    `https://graph.instagram.com/v${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(igUserId)}/media`;

  const createParams = new URLSearchParams();

  createParams.append('image_url', imageAbsoluteUrl);
  createParams.append('caption', caption);
  createParams.append('access_token', accessToken);

  const createResp = await fetch(createUrl, {
    method: 'POST',
    body: createParams
  });

  const createJson = await createResp.json();

  if (!createResp.ok) {
    throw new Error(
      `Create media failed: ${JSON.stringify(createJson)}`
    );
  }

  const creationId =
    createJson.id || createJson.creation_id;

  if (!creationId) {
    throw new Error(
      `Instagram did not return a creation ID: ${JSON.stringify(createJson)}`
    );
  }

  console.log(
    `Instagram media container created: ${creationId}`
  );

  const publishUrl =
    `https://graph.instagram.com/v${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(igUserId)}/media_publish`;

  const publishParams = new URLSearchParams();

  publishParams.append('creation_id', creationId);
  publishParams.append('access_token', accessToken);

  const publishResp = await fetch(publishUrl, {
    method: 'POST',
    body: publishParams
  });

  const publishJson = await publishResp.json();

  if (!publishResp.ok) {
    throw new Error(
      `Publish media failed: ${JSON.stringify(publishJson)}`
    );
  }

  return publishJson;
}

async function checkAndPostOnce() {
  const client = await pool.connect();

  try {
    console.log('Checking scheduled posts...');

    const q = `
      SELECT
        sp.id,
        sp.quoteimageid,
        sp.instagramaccountid,
        sp.scheduledat,
        qi.finalimageurl,
        qi.quote,
        qi.author,
        ia.instagramuserid,
        ia.accesstoken
      FROM scheduledposts sp
      JOIN quoteimages qi
        ON qi.id = sp.quoteimageid
      JOIN instagramaccounts ia
        ON ia.id = sp.instagramaccountid
      WHERE sp.posted = false
      AND sp.scheduledat >= NOW() - INTERVAL '4 hours'
      ORDER BY sp.scheduledat ASC
      LIMIT 10
    `;

    const res = await client.query(q);

    console.log(
      `Found ${res.rowCount} posts ready to publish`
    );

    for (const row of res.rows) {
      try {
        const caption = row.author
          ? `${row.quote} - ${row.author}`
          : row.quote;

        console.log(
          `Posting post id=${row.id} ` +
          `to IG user=${row.instagramuserid} ` +
          `image=${row.finalimageurl}`
        );

        const result = await postToInstagram(
          row.instagramuserid,
          row.accesstoken,
          row.finalimageurl,
          caption
        );

        const instagramMediaId =
          result?.id || null;

        await client.query(
          `
            UPDATE scheduledposts
            SET
              posted = true,
              instagrammediaid = $1
            WHERE id = $2
          `,
          [instagramMediaId, row.id]
        );

        console.log(
          `Marked scheduled post ${row.id} as posted. ` +
          `Instagram media id=${instagramMediaId}`
        );

      } catch (err) {
        console.error(
          `Failed to post scheduled post ${row.id}:`,
          err?.message || err
        );
      }
    }

  } finally {
    client.release();
  }
}

exports.handler = async function handler(event) {
  console.log('PhraseX Instagram checker started');

  try {
    await checkAndPostOnce();

    console.log('PhraseX Instagram checker completed');

    return {
      statusCode: 200,
      body: JSON.stringify({
        status: 'ok'
      })
    };

  } catch (err) {
    console.error(
      'Checker failed:',
      err?.stack || err?.message || err
    );

    throw err;
  }
};