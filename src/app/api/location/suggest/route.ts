import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json([]);
  }

  try {
    // Photon API is built on top of OpenStreetMap data and uses Elasticsearch for high quality,
    // fuzzy point-of-interest and address search. It is 100% free and requires no API key.
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lat=7.8731&lon=80.7718`;
    const response = await fetch(photonUrl);
    const data = await response.json();

    if (data && Array.isArray(data.features)) {
      const mapped = data.features.map((feature: any) => {
        const props = feature.properties || {};
        const name = props.name || props.street || "Location";

        // Build a detailed display name for the address details
        const addressParts = [
          props.street && props.street !== name ? props.street : null,
          props.city || props.town || props.village || props.district,
          props.state,
          props.country
        ].filter(Boolean);

        const display_name = addressParts.length > 0
          ? `${name}, ${addressParts.join(", ")}`
          : name;

        return {
          name,
          display_name
        };
      });

      return NextResponse.json(mapped);
    }
  } catch (err) {
    console.error("Photon API geocoding error:", err);
  }

  return NextResponse.json([]);
}
