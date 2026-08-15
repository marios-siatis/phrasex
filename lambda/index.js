require('dotenv').config();

const { Pool } = require('pg');

const path = require('path');
const fs = require('fs');

const caPath = path.join(__dirname, 'global-bundle.pem');

const IS_LOCAL = process.env.IS_LOCAL === 'true';
console.log(`IS_LOCAL=${IS_LOCAL}, caPath=${caPath}, exists=${fs.existsSync(caPath)}`);
const DATABASE_URL = process.env.DATABASE_URL;
const THRESHOLD_HOURS = Number(process.env.THRESHOLD_HOURS || '0');
const INSTAGRAM_GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || '24.0';
const RUN_ONCE = process.env.RUN_ONCE
  ? process.env.RUN_ONCE === 'true'
  : false;
const POLL_INTERVAL_SECONDS = Number(process.env.POLL_INTERVAL_SECONDS || '300');
const IMAGE_BASE_URL = process.env.IMAGE_BASE_URL;

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable');
  process.exit(1);
}

 connectionString = DATABASE_URL.replace(
  /[?&]sslmode=[^&]*/i,
  ''
);

const pool = new Pool({
  connectionString,

  ssl: IS_LOCAL
    ? false
    : {
        ca: fs.readFileSync(
          path.join(__dirname, 'global-bundle.pem')
        ),
        rejectUnauthorized: true
      },

  connectionTimeoutMillis: 10000,
  query_timeout: 15000,
  max: 2
});

async function postToInstagram(igUserId, accessToken, imageUrl, caption) {
  if (!igUserId) throw new Error('Missing Instagram user ID');
  if (!accessToken) throw new Error('Missing Instagram access token');
  if (!imageUrl) throw new Error('Missing image URL');

  const imageAbsoluteUrl = new URL(
    imageUrl,
    IMAGE_BASE_URL
  ).toString();

  // For test locally where localhost is not allowed for posting in INstagram API  
  // const imageAbsoluteUrl = "https://ucd9546b8e5d3ef0e5b0ffaebcd5.previews.dropboxusercontent.com/p/thumb/ADGtrdG8F0wXCjANd5HLR7q4AhVO4GvDOukx6GJXZ0yABHomqh7NdVQpYdl827sWTU78wOn51SBmmIMjMEMZpv2xKNWvT7Pgmw264Q4ITmFL-wc6RBZI8BrOfIppLxkjghiB_s-jH2oXWAqU5_-hWgap8MY2qkeGXr4kGdUQK7nPMXgKykg7kdz1lAeQNZljLAoyfHQssAaFyuCuwTsPwngJp1oSeE4XAAXJUjjxPek7QrVWsh30U_3kAxm_idqF-I2ESGCZ2tvmtBiVK3VMfRp0CuJztj3ZgfTpwBNGDLMYVyjW2j_uslhxDd50aGPvWYQWFLLzWLzNb4nEB4iNcASTam_FTdsnlfeD9djKp50U54nLs4yrasvx5oxeXxmNvZNd_318Ma6-HmGLZdUIX0b_/p.jpeg?is_prewarmed=true";
  console.log(`Posting image: ${imageAbsoluteUrl}`);

  if (!/^https:\/\//i.test(imageAbsoluteUrl)) {
    throw new Error(
      `Instagram image URL must be a public HTTPS URL. Received: ${imageAbsoluteUrl}`
    );
  }

  // Instagram Login / Instagram API flow.
  const createUrl =
    `https://graph.instagram.com/v${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(igUserId)}/media`;

  const createParams = new URLSearchParams();
  createParams.append('image_url', imageAbsoluteUrl);
  createParams.append('caption', caption);
  createParams.append('access_token', accessToken);

  const createResp = await fetch(createUrl, {
    method: 'POST',
    body: createParams,
  });

  const createJson = await createResp.json();

  if (!createResp.ok) {
    throw new Error(`Create media failed: ${JSON.stringify(createJson)}`);
  }

  const creationId = createJson.id || createJson.creation_id;

  if (!creationId) {
    throw new Error(
      `Instagram did not return a creation ID: ${JSON.stringify(createJson)}`
    );
  }

  console.log(`Instagram media container created: ${creationId}`);

  const publishUrl =
    `https://graph.instagram.com/v${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(igUserId)}/media_publish`;

  const publishParams = new URLSearchParams();
  publishParams.append('creation_id', creationId);
  publishParams.append('access_token', accessToken);

  const publishResp = await fetch(publishUrl, {
    method: 'POST',
    body: publishParams,
  });

  const publishJson = await publishResp.json();

  if (!publishResp.ok) {
    throw new Error(`Publish media failed: ${JSON.stringify(publishJson)}`);
  }

  return publishJson;
}

async function checkAndPostOnce() {
  const client = await pool.connect();

  try {
    // PostgreSQL is the source of truth for scheduling.
    // With THRESHOLD_HOURS=0, only posts whose scheduled time has arrived
    // are selected.
    const thresholdDate = new Date(
      Date.now() - THRESHOLD_HOURS * 3600 * 1000
    ).toISOString();
    console.log(`ThresholdDate ${thresholdDate}`);
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
      JOIN quoteimages qi ON qi.id = sp.quoteimageid
      JOIN instagramaccounts ia ON ia.id = sp.instagramaccountid
      WHERE sp.posted = false
        AND sp.scheduledat > $1
      ORDER BY sp.scheduledat ASC
      LIMIT 10
    `;

    const res = await client.query(q, [thresholdDate]);

    console.log(
      `Found ${res.rowCount} posts to publish (threshold ${THRESHOLD_HOURS}h)`
    );

    for (const row of res.rows) {
      try {
        const caption = row.author
          ? `${row.quote} - ${row.author}`
          : row.quote;

        console.log(
          `Posting post id=${row.id} to IG user=${row.instagramuserid} image=${row.finalimageurl}`
        );

        const result = await postToInstagram(
          row.instagramuserid,
          row.accesstoken,
          row.finalimageurl,
          caption
        );

        const instagramMediaId = result?.id || null;

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
          `Marked scheduled post ${row.id} as posted. Instagram media id=${instagramMediaId}`
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

// Local development: RUN_ONCE=true node index.js
// AWS Lambda: EventBridge invokes exports.handler().
// Do not run a permanent setTimeout loop inside Lambda.
async function mainLoop() {
  try {
    await checkAndPostOnce();
  } catch (err) {
    console.error('Checker failed:', err?.message || err);
  }

  if (RUN_ONCE) {
    await pool.end();
    return;
  }

  setTimeout(mainLoop, POLL_INTERVAL_SECONDS * 1000);
}

if (require.main === module) {
  mainLoop();
}

exports.handler = async function handler(event) {
  await checkAndPostOnce();

  return {
    statusCode: 200,
    body: JSON.stringify({ status: 'ok' }),
  };
};
