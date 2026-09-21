// Fetch real companies using Overture Maps API
// Uses api.overturemapsapi.com - works in Next.js!

export interface OverturePlace {
  name: string;
  category: string;
  website: string;
  city: string;
  state: string;
  address?: string;
  phone?: string;
  email?: string;
}

// US State coordinates (center of a major metro in that state — the API
// takes a single lat/lng + radius, not a state boundary, so this covers
// one metro area per state, not the whole state).
// radius is in METERS (per api.overturemapsapi.com's OpenAPI spec) and
// capped at 25000 (25km), the max allowed on this plan.
const STATE_COORDS: Record<string, { lat: number; lon: number; radius: number }> = {
  OH: { lat: 39.9612, lon: -82.9988, radius: 25000 }, // Columbus
  CA: { lat: 34.0522, lon: -118.2437, radius: 25000 }, // Los Angeles
  TX: { lat: 29.7604, lon: -95.3698, radius: 25000 }, // Houston
  NY: { lat: 40.7128, lon: -74.006, radius: 25000 }, // New York City
  FL: { lat: 25.7617, lon: -80.1918, radius: 25000 }, // Miami
  TEST: { lat: 40.712, lon: -74.006, radius: 2000 },
};

/**
 * Fetch REAL companies from Overture Maps API
 * Works in Next.js - no DuckDB needed!
 */
export async function fetchCompaniesFromOverture(
  state: string = "TEST",
  category: string = "plumbing",
  limit: number = 1,
  page: number = 0
): Promise<OverturePlace[]> {
  try {
    console.log(`🌍 Fetching REAL companies from Overture Maps API: state=${state}, category=${category}, page=${page}`);

    const stateInfo = STATE_COORDS[state];
    if (!stateInfo) {
      console.warn(`Unknown state: ${state}, using sample data`);
      return getSampleDataForState(state, category, limit);
    }

    const { lat, lon, radius } = stateInfo;

    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lon.toString(),
      radius: radius.toString(),
      limit: limit.toString(),
      page: page.toString(),
      has_contact: "website",
    });

    const response = await fetch(`https://api.overturemapsapi.com/places?${params}`, {
      method: "GET",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-API-Key": process.env.OVERTURE_API_KEY || "DEMO-API-KEY",
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      console.warn(`Overture API returned ${response.status}, using sample data`);
      return getSampleDataForState(state, category, limit);
    }

    const data = await response.json();
    const places: OverturePlace[] = [];
    const seenWebsites = new Set<string>();

    const features = Array.isArray(data)
      ? data
      : data.features || data.places || data.results || [];
    
    for (const feature of features) {
      const props = feature.properties || feature;

      let website = props.website || props.websites?.[0] || props.url;
      if (!website) continue;
      website = website.replace(/^https?:\/\//, "").replace(/\/$/, "");

      if (seenWebsites.has(website)) continue;
      seenWebsites.add(website);

      const name = props.name ||
                   props.names?.common?.[0]?.value ||
                   props.names?.primary ||
                   "Unknown";

      const address = props.address?.freeform ||
                     props.addresses?.[0]?.freeform ||
                     [props.address?.street, props.address?.housenumber].filter(Boolean).join(" ") ||
                     "";

      const city = props.address?.locality ||
                  props.addresses?.[0]?.locality ||
                  props.city ||
                  "";

      const placeState = props.address?.region ||
                        props.addresses?.[0]?.region ||
                        props.state ||
                        state;

      // props.category doesn't exist on the real API response — the
      // category lives at props.categories.primary (or basic_category).
      const placeCategory = props.categories?.primary || props.basic_category || category;

      const phone = props.phones?.[0] || props.phone;
      const email = props.emails?.[0] || props.email;

      places.push({
        name,
        category: placeCategory,
        website,
        city,
        state: placeState,
        address,
        phone,
        email,
      });
      
      if (places.length >= limit) break;
    }

    if (places.length > 0) {
      console.log(`✅ Found ${places.length} real companies from Overture Maps API`);
      return places;
    }

    console.log(`⚠️ No Overture results, using sample data`);
    return getSampleDataForState(state, category, limit);
    
  } catch (error) {
    console.error("Error fetching companies:", error);
    return getSampleDataForState(state, category, limit);
  }
}

export async function fetchCompaniesByMultipleCategories(
  categories: string[],
  states: string[] = ["OH", "CA", "TX"],
  perCategory: number = 10
): Promise<OverturePlace[]> {
  // Guard against a bare string slipping in where string[] is expected
  // (e.g. a caller passing "plumb" instead of ["plumb"]) — for...of over a
  // string silently iterates its characters instead of throwing, which is
  // much harder to notice than a real error.
  const categoryList = Array.isArray(categories) ? categories : [categories];

  const allPlaces: OverturePlace[] = [];
  const seen = new Set<string>();

  for (const state of states) {
    let page = 0;
    for (const category of categoryList) {
      try {
        const places = await fetchCompaniesFromOverture(state, category, perCategory, page++);
        
        for (const place of places) {
          if (!seen.has(place.website)) {
            seen.add(place.website);
            allPlaces.push(place);
          }
        }
        
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Error fetching ${category} in ${state}:`, error);
      }
    }
  }

  return allPlaces;
}

function getSampleDataForState(
  state: string,
  category: string,
  limit: number
): OverturePlace[] {
  const filtered = OVERTURE_SAMPLE_DATA.filter((place) => {
    const matchesState = place.state === state;
    const matchesCategory = place.category
      .toLowerCase()
      .includes(category.toLowerCase().replace(/%/g, ""));
    return matchesState && matchesCategory;
  });

  return filtered.slice(0, limit);
}

// Sample data for fallback (when API is unavailable)
const OVERTURE_SAMPLE_DATA: OverturePlace[] = [
  // Ohio - Plumbing
  { name: "ABC Plumbing Services", category: "plumbing", website: "abcplumbingoh.com", city: "Columbus", state: "OH", address: "123 Main St" },
  { name: "Quick Fix Plumbing", category: "plumbing", website: "quickfixplumbing.com", city: "Cleveland", state: "OH", address: "456 Oak Ave" },
  
  // California - HVAC
  { name: "Cool Air Solutions", category: "hvac", website: "coolairsolutions.com", city: "Los Angeles", state: "CA", address: "789 Palm Dr" },
  { name: "Valley Heating & Air", category: "hvac", website: "valleyhvac.com", city: "San Francisco", state: "CA", address: "321 Market St" },
  
  // Texas - Landscaping
  { name: "Green Thumb Landscaping", category: "landscaping", website: "greenthumblandscape.com", city: "Houston", state: "TX", address: "567 Garden Ln" },
  { name: "Texas Lawn Care Pros", category: "landscaping", website: "texaslawnpros.com", city: "Austin", state: "TX", address: "890 Cedar Rd" },
  
  // More sample companies...
  { name: "Empire Roofing", category: "roofing", website: "empireroofingny.com", city: "New York", state: "NY", address: "234 Broadway" },
  { name: "Sunshine Electric", category: "electrical", website: "sunshineelectric.com", city: "Miami", state: "FL", address: "901 Beach Blvd" },
  { name: "Sparkle Clean Commercial", category: "cleaning", website: "sparklecleanoh.com", city: "Akron", state: "OH", address: "234 Clean Way" },
  { name: "Coastal Pet Hospital", category: "veterinary", website: "coastalpethospital.com", city: "Santa Monica", state: "CA", address: "901 Pet Care Dr" },
  { name: "Smile Bright Dental", category: "dental", website: "smilebrightdental.com", city: "Irvine", state: "CA", address: "234 Tooth Ln" },
  { name: "Artisan Bread Co", category: "bakery", website: "artisanbreadoh.com", city: "Columbus", state: "OH", address: "123 Baker St" },
];
