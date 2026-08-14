require('dotenv').config();

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const THRESHOLD_HOURS = Number(process.env.THRESHOLD_HOURS || '1');
const INSTAGRAM_GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_VERSION || '16.0';
const RUN_ONCE = process.env.RUN_ONCE === 'true' || false;
const POLL_INTERVAL_SECONDS = Number(process.env.POLL_INTERVAL_SECONDS || '300');

if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL environment variable');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function postToInstagram(igUserId, accessToken, imageUrl, caption) {
  // Create media
  const createUrl = `https://graph.facebook.com/v${INSTAGRAM_GRAPH_VERSION}/${igUserId}/media`;

  const params = new URLSearchParams();
  params.append('image_url', imageUrl);
  params.append('caption', caption);
  params.append('access_token', accessToken);

  const createResp = await fetch(createUrl, { method: 'POST', body: params });
  const createJson = await createResp.json();
  if (!createResp.ok) {
    throw new Error(`Create media failed: ${JSON.stringify(createJson)}`);
  }

  const creationId = createJson.id || createJson.creation_id;
  if (!creationId) throw new Error('No creation id returned from Instagram');

  // Publish media
  const publishUrl = `https://graph.facebook.com/v${INSTAGRAM_GRAPH_VERSION}/${igUserId}/media_publish`;
  const publishParams = new URLSearchParams();
  publishParams.append('creation_id', creationId);
  publishParams.append('access_token', accessToken);

  const publishResp = await fetch(publishUrl, { method: 'POST', body: publishParams });
  const publishJson = await publishResp.json();
  if (!publishResp.ok) {
    throw new Error(`Publish media failed: ${JSON.stringify(publishJson)}`);
  }

  return publishJson;
}

async function checkAndPostOnce() {
  const client = await pool.connect();
  try {
    const thresholdDate = new Date(Date.now() - THRESHOLD_HOURS * 3600 * 1000).toISOString();
    //console.log(`threshold ${thresholdDate}`);
    const q = `
      SELECT sp.id, sp.quoteimageid, sp.instagramaccountid, sp.scheduledat, qi.finalimageurl, qi.quote, qi.author, ia.instagramuserid, ia.accesstoken
      FROM scheduledposts sp
      JOIN quoteimages qi ON qi.id = sp.quoteimageid
      JOIN instagramaccounts ia ON ia.id = sp.instagramaccountid
      WHERE sp.posted = false AND sp.scheduledat > $1
      ORDER BY sp.scheduledat ASC
      LIMIT 10`;

    const res = await client.query(q, [thresholdDate]);
    console.log(`Found ${res.rowCount} posts to publish (threshold ${THRESHOLD_HOURS}h)`);

    for (const row of res.rows) {
      try {
        const caption = `${row.quote} — ${row.author}`;
        console.log(`Posting post id=${row.id} to IG user ${row.instagramuserid} image=${row.finalimageurl}`);
        await postToInstagram(row.instagramuserid, row.accesstoken, row.finalimageurl, caption);

        await client.query('UPDATE scheduledposts SET posted = true WHERE id = $1', [row.id]);
        console.log(`Marked scheduled post ${row.id} as posted`);
      } catch (err) {
        console.error(`Failed to post scheduled post ${row.id}:`, err.message || err);
      }
    }
  } finally {
    client.release();
  }
}

async function mainLoop() {
  try {
    await checkAndPostOnce();
  } catch (err) {
    console.error('Checker failed:', err.message || err);
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
  return { status: 'ok' };
};
