import { NextRequest, NextResponse } from "next/server";

export type KakaoPlace = {
  id: string;
  place_name: string;
  category_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
};

const REGIONS = {
  hadong: {
    label: "하동",
    lat: "35.0672",
    lng: "127.7513",
    keywords: {
      all: ["하동 다원", "하동 찻집", "하동 명소"],
      teaGarden: ["하동 다원", "하동 차밭"],
      teaHouse: ["하동 찻집", "하동 전통찻집", "하동 녹차 카페"],
      attraction: ["하동 명소", "화개장터", "쌍계사"],
    },
  },
  boseong: {
    label: "보성",
    lat: "34.7715",
    lng: "127.0800",
    keywords: {
      all: ["보성 다원", "보성 찻집", "보성 명소"],
      teaGarden: ["보성 다원", "보성 차밭", "보성 녹차밭"],
      teaHouse: ["보성 찻집", "보성 녹차 카페", "보성 전통찻집"],
      attraction: ["보성 명소", "대한다원", "율포해수욕장"],
    },
  },
} as const;

type Region = keyof typeof REGIONS;
type Category = keyof (typeof REGIONS)["hadong"]["keywords"];

function getRegion(value: string | null): Region {
  return value === "boseong" ? "boseong" : "hadong";
}

function getCategory(value: string | null): Category {
  if (
    value === "all" ||
    value === "teaGarden" ||
    value === "teaHouse" ||
    value === "attraction"
  ) {
    return value;
  }

  return "all";
}

async function searchKeyword({
  keyword,
  lat,
  lng,
}: {
  keyword: string;
  lat: string;
  lng: string;
}) {
  try {
    const params = new URLSearchParams({
      query: keyword,
      x: lng,
      y: lat,
      radius: "20000",
      size: "15",
      sort: "distance",
    });

    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?${params.toString()}`,
      {
        headers: {
          Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Kakao Local API error: ${response.status}`);
    }

    const data = await response.json();
    return (data.documents ?? []) as KakaoPlace[];
  } catch (error) {
    console.error("Failed to search Kakao keyword", error);
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!process.env.KAKAO_REST_API_KEY) {
      return NextResponse.json(
        { message: "Kakao REST API Key가 설정되지 않았습니다.", places: [] },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const region = getRegion(searchParams.get("region"));
    const category = getCategory(searchParams.get("category"));
    const regionConfig = REGIONS[region];
    const lat = searchParams.get("lat") ?? regionConfig.lat;
    const lng = searchParams.get("lng") ?? regionConfig.lng;

    const results = await Promise.all(
      regionConfig.keywords[category].map((keyword) =>
        searchKeyword({ keyword, lat, lng })
      )
    );

    const places = Array.from(
      new Map(results.flat().map((place) => [place.id, place])).values()
    );

    if (places.length === 0) {
      return NextResponse.json(
        {
          message: `주변에 검색된 장소가 없습니다. ${regionConfig.label} 중심으로 이동합니다.`,
          places: [],
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ places });
  } catch {
    return NextResponse.json(
      { message: "데이터를 불러오는 중 오류가 발생했습니다.", places: [] },
      { status: 500 }
    );
  }
}
