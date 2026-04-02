const EARTH_RADIUS_KM = 6371;

const toRadians = (value) => (value * Math.PI) / 180;

const distanceKm = (lat1, lng1, lat2, lng2) => {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

const getKeyword = (filterType) => {
  if (filterType === "cardiology") {
    return "cardiology";
  }

  if (filterType === "neurology") {
    return "neurology";
  }

  if (filterType === "multi-speciality") {
    return "multispeciality";
  }

  return "hospital";
};

const buildOverpassQuery = (latitude, longitude, radiusMeters) => `
  [out:json][timeout:25];
  (
    node["amenity"="hospital"](around:${radiusMeters},${latitude},${longitude});
    way["amenity"="hospital"](around:${radiusMeters},${latitude},${longitude});
    relation["amenity"="hospital"](around:${radiusMeters},${latitude},${longitude});
    node["healthcare"="hospital"](around:${radiusMeters},${latitude},${longitude});
    way["healthcare"="hospital"](around:${radiusMeters},${latitude},${longitude});
    relation["healthcare"="hospital"](around:${radiusMeters},${latitude},${longitude});
  );
  out center tags;
`;

const fetchJsonWithTimeout = async (url, options = {}, timeoutMs = 12000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await response.json() : null;

    return { response, payload };
  } finally {
    clearTimeout(timeoutId);
  }
};

const normalizeHospitals = (results, latitude, longitude, keyword, filterType) => {
  return results
    .map((item) => {
      const placeLat = item.lat ?? item.center?.lat;
      const placeLng = item.lon ?? item.center?.lon;
      const name = item.tags?.name || item.tags?.operator || "Unknown hospital";
      const nameMatches = keyword === "hospital" || name.toLowerCase().includes(keyword.toLowerCase());

      if (!nameMatches && filterType !== "general") {
        return null;
      }

      const km =
        Number.isFinite(placeLat) && Number.isFinite(placeLng)
          ? distanceKm(latitude, longitude, placeLat, placeLng)
          : null;

      return {
        name,
        rating: item.tags?.rating ? Number(item.tags.rating) : null,
        distanceKm: km !== null ? Number(km.toFixed(2)) : null,
        address:
          item.tags?.addr_full ||
          item.tags?.addr_street ||
          item.tags?.description ||
          "Address not available",
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.distanceKm ?? 9999) - (b.distanceKm ?? 9999))
    .slice(0, 20);
};

const fetchHospitalsFromOverpass = async (latitude, longitude, radiusMeters) => {
  const overpassQuery = buildOverpassQuery(latitude, longitude, radiusMeters);
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.nchc.org.tw/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      const { response, payload } = await fetchJsonWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "Design-Thinking-Hospital-SOS/1.0",
          },
          body: `data=${encodeURIComponent(overpassQuery)}`,
        },
        12000,
      );

      if (response.ok && payload?.elements) {
        return Array.isArray(payload.elements) ? payload.elements : [];
      }
    } catch (error) {
      continue;
    }
  }

  return null;
};

const fetchHospitalsFromNominatim = async (latitude, longitude, keyword) => {
  const viewboxSize = 0.06;
  const left = longitude - viewboxSize;
  const right = longitude + viewboxSize;
  const top = latitude + viewboxSize;
  const bottom = latitude - viewboxSize;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", keyword);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "20");
  url.searchParams.set("bounded", "1");
  url.searchParams.set("viewbox", `${left},${top},${right},${bottom}`);

  const { response, payload } = await fetchJsonWithTimeout(
    url.toString(),
    {
      headers: {
        "User-Agent": "Design-Thinking-Hospital-SOS/1.0",
        Accept: "application/json",
      },
    },
    12000,
  );

  if (!response.ok || !Array.isArray(payload)) {
    return [];
  }

  return payload.map((item) => ({
    lat: Number(item.lat),
    lon: Number(item.lon),
    tags: {
      name: item.display_name?.split(",")[0] || item.name || "Unknown hospital",
      description: item.display_name || "Address not available",
    },
  }));
};

export const getNearbyHospitals = async (req, res) => {
  try {
    const latitude = Number(req.query.lat);
    const longitude = Number(req.query.lng);
    const filterType = String(req.query.filter || "general").toLowerCase();

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return res.status(400).json({ message: "Valid lat and lng are required" });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: "Latitude or longitude is out of range" });
    }

    const keyword = getKeyword(filterType);
    const radiusMeters = 5000;
    let results = await fetchHospitalsFromOverpass(latitude, longitude, radiusMeters);

    if (!results) {
      results = await fetchHospitalsFromNominatim(latitude, longitude, keyword);
    }

    const hospitals = normalizeHospitals(results, latitude, longitude, keyword, filterType);

    return res.status(200).json(hospitals);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch nearby hospitals" });
  }
};
