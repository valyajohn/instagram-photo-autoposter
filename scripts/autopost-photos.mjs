import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const GRAPH_API = 'https://graph.facebook.com/v21.0';
const STATE_FILE = path.resolve(process.cwd(), 'posted_photos.json');

const {
  GDRIVE_PHOTOS_FOLDER_ID = '',
  GOOGLE_API_KEY = '',
  IG_USER_ID = '',
  IG_ACCESS_TOKEN = '',
  IG_PHOTO_CAPTIONS = '',
  DEFAULT_PHOTO_CAPTIONS = "Golden hour frame ✨||Editorial mood in every detail||Soft light, sharp silhouette||Studio session · pure aesthetics||Captured in the moment 📸||Minimalist look, maximum presence||Late afternoon glow||Behind the lens today||Timeless frame 🤍||Chasing natural light||New lookbook drop||Moodboard energy ✨||Effortless elegance||Details make the look||In my element today||Quiet luxury aesthetic||Sunlight & shadows||Fresh from the photoshoot||Styled to perfection||Clean lines and soft tones||High-fashion state of mind||Portrait of the day ✨||Where style meets mood||Natural light never lies||New angle, same energy||Main character frame||Focus on the vibe||Classic look, modern mood||Frame worth keeping 🤍||Less noise, more aesthetic||Soft glam & crisp lines||City light session||Everyday editorial||Styled for the moment||Pure visual harmony||Captured between takes||Weekend lookbook vibes||Shine without trying||Aesthetic check ✨||Today’s favorite shot||Dressed for the lens||Subtle glow, strong look||Outtake from today’s shoot||Warm tones & calm energy||Fashion is a mood||Camera loves natural light||Simplicity is iconic||Look of the hour ✨||Curated visual story||Vibe check passed||On set & feeling good||Grace in every frame||Modern muse aesthetic||Just another studio story||Mirror of today’s mood||Textures, light & style||Elevated everyday look||Shot on golden hour 🌅||Unfiltered visual poetry||Keep it chic, keep it real",
  IG_PHOTO_HASHTAGS = '',
  DEFAULT_PHOTO_HASHTAGS = "#photoshoot #photography #portrait #portraitphotography #editorial #editorialphotography #modelshoot #studio #studiophotography #film #35mm #analog #goldenhour #naturallight #aestheticphoto #visuals #frame #behindthescenes #photooftheday #instaphoto #ootd #outfitoftheday #lookbook #streetstyle #fashion #fashionstyle #styleinspo #outfitinspo #chic #chicstyle #minimalistfashion #trendyoutfit #whatiwore #stylediary #fashioneditorial #highfashion #casualchic #glamlook #eveninglook #luxestyle #dailylook #fashionista #outfitideas #styleoftheday #streetfashion #beauty #beautymodel #glam #makeup #makeuplook #glow #glowup #aesthetic #aesthetics #feminine #feminineenergy #muse #model #modelvibes #naturalbeauty #softglam #cleangirlaesthetic #thatgirl #pretty #portraitmood #instagood #instadaily #explore #explorepage #viral #trending #fyp #foryou #mood #vibes",
  PHOTO_HASHTAGS_COUNT = "10",
  IG_FIRST_COMMENT = '',
  DEFAULT_FIRST_COMMENT = "Больше фото и бэкстейдж в нашем Telegram — ссылка в шапке профиля 👆 (или @stage_style_media)",
  PHOTO_SORT_ORDER = "random",
} = process.env;

const EFFECTIVE_CAPTIONS = IG_PHOTO_CAPTIONS.trim() ? IG_PHOTO_CAPTIONS : DEFAULT_PHOTO_CAPTIONS;
const EFFECTIVE_HASHTAGS = IG_PHOTO_HASHTAGS.trim() ? IG_PHOTO_HASHTAGS : DEFAULT_PHOTO_HASHTAGS;
const EFFECTIVE_FIRST_COMMENT = IG_FIRST_COMMENT.trim() ? IG_FIRST_COMMENT : DEFAULT_FIRST_COMMENT;

function assertEnv(name, value) {
  if (!value || !String(value).trim()) {
    throw new Error(`Отсутствует обязательный секрет / переменная окружения: ${name}`);
  }
  return String(value).trim();
}

async function listDriveImages(folderId, apiKey) {
  const q = `'${folderId}' in parents and trashed = false and (mimeType = 'image/jpeg' or mimeType = 'image/png' or name contains '.jpg' or name contains '.jpeg' or name contains '.JPG' or name contains '.JPEG' or name contains '.png' or name contains '.PNG')`;
  const orderBy =
    PHOTO_SORT_ORDER === 'oldest_first'
      ? 'createdTime asc'
      : PHOTO_SORT_ORDER === 'newest_first'
        ? 'createdTime desc'
        : 'name asc';

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,size,createdTime)',
    pageSize: '1000',
    orderBy,
    key: apiKey,
  });

  const resp = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`);
  const data = await resp.json();
  if (!resp.ok || data.error) {
    throw new Error(`Ошибка списка фото Google Drive: ${data.error?.message || resp.status}`);
  }

  return (data.files || []).filter(
    (f) => f.mimeType === 'image/jpeg' || f.mimeType === 'image/png' || /\.(jpe?g|png)$/i.test(f.name)
  );
}

function pickRandomTitle() {
  const list = EFFECTIVE_CAPTIONS.split(/\|\||\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return 'Editorial frame ✨';
  return list[crypto.randomInt(list.length)];
}

function pickRandomHashtags() {
  const pool = EFFECTIVE_HASHTAGS.split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith('#') ? t : `#${t}`));

  if (pool.length === 0) return '';
  const count = Math.max(1, Math.min(pool.length, Number.parseInt(PHOTO_HASHTAGS_COUNT, 10) || 10));
  const copy = [...pool];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count).join(' ');
}

function readState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { posted: [] };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function writeState(state) {
  fs.writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function main() {
  if (!GDRIVE_PHOTOS_FOLDER_ID.trim()) {
    console.log('Секрет GDRIVE_PHOTOS_FOLDER_ID не задан — автопостинг фото пропущен.');
    return;
  }

  const folderId = assertEnv('GDRIVE_PHOTOS_FOLDER_ID', GDRIVE_PHOTOS_FOLDER_ID);
  const apiKey = assertEnv('GOOGLE_API_KEY', GOOGLE_API_KEY);
  const igUserId = assertEnv('IG_USER_ID', IG_USER_ID);
  const igToken = assertEnv('IG_ACCESS_TOKEN', IG_ACCESS_TOKEN);

  const state = readState();
  const postedIds = new Set((state.posted || []).map((item) => item.id));

  const images = await listDriveImages(folderId, apiKey);
  const unposted = images.filter((img) => !postedIds.has(img.id));
  const nextPhoto =
    unposted.length === 0
      ? null
      : PHOTO_SORT_ORDER === 'random'
        ? unposted[crypto.randomInt(unposted.length)]
        : unposted[0];

  if (!nextPhoto) {
    console.log('Новых фото для публикации не найдено. Очередь пуста.');
    return;
  }

  console.log(`Найдено фото для публикации: ${nextPhoto.name} (${nextPhoto.id})`);

  const title = pickRandomTitle();
  const tags = pickRandomHashtags();
  const caption = tags ? `${title}\n\n${tags}` : title;
  const imageUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(nextPhoto.id)}?alt=media&key=${encodeURIComponent(apiKey)}`;

  const createParams = new URLSearchParams({
    image_url: imageUrl,
    caption,
    access_token: igToken,
  });

  const createResp = await fetch(
    `${GRAPH_API}/${encodeURIComponent(igUserId)}/media?${createParams.toString()}`,
    { method: 'POST' }
  );
  const createData = await createResp.json();
  if (!createResp.ok || !createData.id) {
    throw new Error(`Ошибка создания фото-контейнера: ${JSON.stringify(createData)}`);
  }

  let statusCode = 'IN_PROGRESS';
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusResp = await fetch(
      `${GRAPH_API}/${createData.id}?fields=status_code,status&access_token=${encodeURIComponent(igToken)}`
    );
    const statusData = await statusResp.json();
    statusCode = statusData.status_code || 'FINISHED';
    console.log(`Статус фото (${i + 1}/15): ${statusCode}`);
    if (statusCode === 'FINISHED') break;
    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new Error(`Ошибка обработки фото: ${JSON.stringify(statusData)}`);
    }
  }

  if (statusCode !== 'FINISHED') {
    throw new Error(`Таймаут обработки фото: ${statusCode}`);
  }

  const publishParams = new URLSearchParams({
    creation_id: createData.id,
    access_token: igToken,
  });
  const publishResp = await fetch(
    `${GRAPH_API}/${encodeURIComponent(igUserId)}/media_publish?${publishParams.toString()}`,
    { method: 'POST' }
  );
  const publishData = await publishResp.json();
  if (!publishResp.ok || !publishData.id) {
    throw new Error(`Ошибка публикации фото: ${JSON.stringify(publishData)}`);
  }

  console.log(`Фото опубликовано! Media ID: ${publishData.id}`);

  if (EFFECTIVE_FIRST_COMMENT && EFFECTIVE_FIRST_COMMENT.trim()) {
    const commentParams = new URLSearchParams({
      message: EFFECTIVE_FIRST_COMMENT.trim(),
      access_token: igToken,
    });
    const commentResp = await fetch(
      `${GRAPH_API}/${publishData.id}/comments?${commentParams.toString()}`,
      { method: 'POST' }
    );
    const commentData = await commentResp.json();
    if (!commentResp.ok) {
      console.warn(`Предупреждение: не удалось добавить первый комментарий: ${JSON.stringify(commentData)}`);
    } else {
      console.log(`Первый комментарий добавлен! Comment ID: ${commentData.id}`);
    }
  }

  state.posted = state.posted || [];
  state.posted.push({
    id: nextPhoto.id,
    name: nextPhoto.name,
    mediaId: publishData.id,
    caption,
    publishedAt: new Date().toISOString(),
  });
  writeState(state);
  console.log('Файл posted_photos.json обновлён.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
