(function (global) {
  const ANILIST_ENDPOINT = 'https://graphql.anilist.co';
  const API_RETRY_DELAYS = [400, 900, 1600];
  const MAX_API_ATTEMPTS = API_RETRY_DELAYS.length + 1;
  const CACHE = {
    mediaById: {},
    mediaByMalId: {},
    pages: {},
  };

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function request(query, variables) {
    for (let attempt = 0; attempt < MAX_API_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(ANILIST_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json?.errors?.length) {
            return { data: null, error: json.errors.map((e) => e.message).join(', ') };
          }
          return { data: json?.data || null, error: null };
        }
        if (res.status === 429 || res.status >= 500) {
          if (attempt < API_RETRY_DELAYS.length) await sleep(API_RETRY_DELAYS[attempt]);
          continue;
        }
        return { data: null, error: `AniList request failed (${res.status})` };
      } catch (err) {
        if (attempt < API_RETRY_DELAYS.length) {
          await sleep(API_RETRY_DELAYS[attempt]);
          continue;
        }
        return { data: null, error: err?.message || 'AniList request failed' };
      }
    }
    return { data: null, error: 'AniList request failed' };
  }

  const MEDIA_FIELDS = `
    id
    idMal
    title { romaji english native userPreferred }
    description
    coverImage { extraLarge large medium color }
    bannerImage
    genres
    episodes
    status
    format
    averageScore
    season
    seasonYear
    trailer { site id }
    siteUrl
    studios { nodes { name } }
    nextAiringEpisode { episode airingAt timeUntilAiring }
    startDate { year month day }
    endDate { year month day }
    duration
    popularity
  `;

  const PAGE_QUERY = `
    query ($page: Int, $perPage: Int, $search: String, $sort: [MediaSort], $format: MediaFormat, $status: MediaStatus, $genres: [String]) {
      Page(page: $page, perPage: $perPage) {
        pageInfo { currentPage hasNextPage total }
        media(search: $search, type: ANIME, sort: $sort, format: $format, status: $status, genre_in: $genres) {
          ${MEDIA_FIELDS}
        }
      }
    }
  `;

  const DETAIL_QUERY = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        ${MEDIA_FIELDS}
        recommendations(sort: RATING_DESC) {
          nodes {
            mediaRecommendation {
              id
              idMal
              title { romaji english native userPreferred }
              coverImage { large medium }
              averageScore
              seasonYear
              format
            }
          }
        }
      }
    }
  `;

  const MAL_ID_QUERY = `
    query ($idMal: Int) {
      Media(idMal: $idMal, type: ANIME) { id }
    }
  `;

  async function fetchPage(params) {
    const variables = {
      page: params?.page || 1,
      perPage: params?.perPage || 20,
      search: params?.search || null,
      sort: params?.sort || null,
      format: params?.format || null,
      status: params?.status || null,
      genres: params?.genres || null,
    };
    const cacheKey = JSON.stringify(variables);
    if (CACHE.pages[cacheKey]) return CACHE.pages[cacheKey];
    const result = await request(PAGE_QUERY, variables);
    if (result?.data) CACHE.pages[cacheKey] = result;
    return result;
  }

  async function fetchMediaById(id) {
    if (!id) return { data: null, error: 'Missing AniList id' };
    if (CACHE.mediaById[id]) return CACHE.mediaById[id];
    const result = await request(DETAIL_QUERY, { id });
    if (result?.data?.Media) {
      CACHE.mediaById[id] = { data: result.data.Media, error: null };
    }
    return result?.data?.Media ? { data: result.data.Media, error: null } : result;
  }

  async function resolveMediaIdByMalId(idMal) {
    if (!idMal) return { data: null, error: 'Missing MAL id' };
    if (CACHE.mediaByMalId[idMal]?.id) return { data: CACHE.mediaByMalId[idMal].id, error: null };
    const result = await request(MAL_ID_QUERY, { idMal });
    const id = result?.data?.Media?.id || null;
    if (id) {
      CACHE.mediaByMalId[idMal] = { id };
      return { data: id, error: null };
    }
    return { data: null, error: result.error || 'AniList lookup failed' };
  }

  async function fetchMediaByMalId(idMal) {
    if (!idMal) return { data: null, error: 'Missing MAL id' };
    if (CACHE.mediaByMalId[idMal]?.media) {
      return { data: CACHE.mediaByMalId[idMal].media, error: null };
    }
    const resolved = await resolveMediaIdByMalId(idMal);
    if (!resolved?.data) return { data: null, error: resolved.error || 'AniList lookup failed' };
    const result = await fetchMediaById(resolved.data);
    if (result?.data) {
      CACHE.mediaByMalId[idMal] = { id: resolved.data, media: result.data };
    }
    return result;
  }

  global.AniListApi = {
    fetchPage,
    fetchMediaById,
    fetchMediaByMalId,
    resolveMediaIdByMalId,
  };
})(window);
