"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

declare global {
  interface Window {
    kakao?: {
      maps: KakaoMapsApi;
    };
  }
}

type KakaoLatLng = {
  getLat: () => number;
  getLng: () => number;
};

type KakaoBounds = {
  extend: (latLng: KakaoLatLng) => void;
};

type KakaoMap = {
  getCenter: () => KakaoLatLng;
  panTo: (latLng: KakaoLatLng) => void;
  setBounds: (bounds: KakaoBounds) => void;
};

type KakaoMarker = {
  setMap: (map: KakaoMap | null) => void;
};

type KakaoMapsApi = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  LatLngBounds: new () => KakaoBounds;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number }
  ) => KakaoMap;
  Marker: new (options: {
    map: KakaoMap;
    position: KakaoLatLng;
    title: string;
  }) => KakaoMarker;
  event: {
    addListener: (
      target: KakaoMarker,
      type: "click",
      callback: () => void
    ) => void;
  };
};

type Region = "hadong" | "boseong";
type Category = "all" | "teaGarden" | "teaHouse" | "attraction";

type KakaoPlace = {
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

const REGIONS: Record<
  Region,
  { label: string; subtitle: string; center: { lat: number; lng: number } }
> = {
  hadong: {
    label: "하동",
    subtitle: "섬진강과 화개장터 주변 다원 탐색",
    center: { lat: 35.0672, lng: 127.7513 },
  },
  boseong: {
    label: "보성",
    subtitle: "녹차밭과 율포권 찻집 탐색",
    center: { lat: 34.7715, lng: 127.0800 },
  },
};

const CATEGORIES: Array<{ value: Category; label: string }> = [
  { value: "all", label: "전체" },
  { value: "teaGarden", label: "다원" },
  { value: "teaHouse", label: "찻집" },
  { value: "attraction", label: "명소" },
];

function loadKakaoMapScript() {
  return new Promise<void>((resolve, reject) => {
    try {
      if (window.kakao?.maps) {
        window.kakao.maps.load(resolve);
        return;
      }

      const existingScript = document.querySelector<HTMLScriptElement>(
        "script[data-kakao-map-script]"
      );

      if (existingScript) {
        existingScript.addEventListener("load", () => {
          window.kakao?.maps.load(resolve);
        });
        existingScript.addEventListener("error", () => {
          reject(new Error("Kakao Maps SDK를 불러오지 못했습니다."));
        });
        return;
      }

      const key = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;

      if (!key) {
        reject(new Error("Kakao JavaScript Key가 설정되지 않았습니다."));
        return;
      }

      const script = document.createElement("script");
      script.dataset.kakaoMapScript = "true";
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&autoload=false`;
      script.onload = () => window.kakao?.maps.load(resolve);
      script.onerror = () => {
        reject(new Error("Kakao Maps SDK를 불러오지 못했습니다."));
      };

      document.head.appendChild(script);
    } catch (error) {
      reject(error);
    }
  });
}

export default function HomePage() {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoMarker[]>([]);

  const [region, setRegion] = useState<Region>("hadong");
  const [category, setCategory] = useState<Category>("all");
  const [places, setPlaces] = useState<KakaoPlace[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<KakaoPlace | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();
  const currentRegion = REGIONS[region];

  const panToRegionCenter = useCallback(
    (targetRegion: Region = region) => {
      if (!mapRef.current || !window.kakao?.maps) return;

      const target = REGIONS[targetRegion].center;
      const center = new window.kakao.maps.LatLng(target.lat, target.lng);
      mapRef.current.panTo(center);
    },
    [region]
  );

  const showRecoverableError = useCallback(
    (
      targetRegion: Region,
      description = `주변에 검색된 장소가 없습니다. ${REGIONS[targetRegion].label} 중심으로 이동합니다.`
    ) => {
      toast({
        variant: "destructive",
        title: "검색 결과를 불러오지 못했습니다.",
        description,
      });
      panToRegionCenter(targetRegion);
    },
    [panToRegionCenter, toast]
  );

  const fetchPlaces = useCallback(
    async (nextRegion: Region, nextCategory: Category) => {
      if (!mapRef.current) return;

      try {
        setIsLoading(true);

        const center = mapRef.current.getCenter();
        const params = new URLSearchParams({
          region: nextRegion,
          category: nextCategory,
          lat: String(center.getLat()),
          lng: String(center.getLng()),
        });

        const response = await fetch(`/api/kakao/places?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ?? "데이터를 불러오는 중 오류가 발생했습니다."
          );
        }

        if (!data.places || data.places.length === 0) {
          setPlaces([]);
          showRecoverableError(nextRegion);
          return;
        }

        setPlaces(data.places);
      } catch (error) {
        setPlaces([]);
        showRecoverableError(
          nextRegion,
          error instanceof Error
            ? error.message
            : "데이터를 불러오는 중 오류가 발생했습니다."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [showRecoverableError]
  );

  useEffect(() => {
    async function initializeMap() {
      try {
        await loadKakaoMapScript();

        if (!mapContainerRef.current || !window.kakao?.maps) return;

        const center = new window.kakao.maps.LatLng(
          REGIONS.hadong.center.lat,
          REGIONS.hadong.center.lng
        );

        const map = new window.kakao.maps.Map(mapContainerRef.current, {
          center,
          level: 8,
        });

        mapRef.current = map;
        setIsMapReady(true);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "지도를 불러오지 못했습니다.",
          description:
            error instanceof Error
              ? error.message
              : "Kakao Maps 설정을 확인해 주세요.",
        });
      }
    }

    initializeMap();
  }, [toast]);

  useEffect(() => {
    if (!isMapReady) return;

    panToRegionCenter(region);
    void Promise.resolve().then(() => fetchPlaces(region, category));
  }, [category, fetchPlaces, isMapReady, panToRegionCenter, region]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current || !window.kakao?.maps) return;

    const kakaoMaps = window.kakao.maps;
    const map = mapRef.current;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    places.forEach((place) => {
      const position = new kakaoMaps.LatLng(
        Number(place.y),
        Number(place.x)
      );

      const marker = new kakaoMaps.Marker({
        map,
        position,
        title: place.place_name,
      });

      kakaoMaps.event.addListener(marker, "click", () => {
        setSelectedPlace(place);
      });

      markersRef.current.push(marker);
    });

    if (places.length > 0) {
      const bounds = new kakaoMaps.LatLngBounds();
      places.forEach((place) => {
        bounds.extend(
          new kakaoMaps.LatLng(Number(place.y), Number(place.x))
        );
      });
      map.setBounds(bounds);
    }
  }, [isMapReady, places]);

  return (
    <main className="min-h-screen bg-background">
      <div className="flex min-h-screen flex-col">
        <header className="z-10 border-b bg-background/95 px-4 py-4 shadow-sm backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-primary">
                Hadong & Boseong Tea Garden Map
              </p>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                남도 로컬 투어 & 다원 맵
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentRegion.label} 지역의 다원, 찻집, 명소를 카카오 데이터로 탐색합니다.
              </p>
            </div>

            <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
              <Tabs
                value={region}
                onValueChange={(value) => {
                  setSelectedPlace(null);
                  setPlaces([]);
                  setRegion(value as Region);
                }}
              >
                <TabsList className="grid w-full grid-cols-2 sm:w-[220px]">
                  {Object.entries(REGIONS).map(([value, item]) => (
                    <TabsTrigger key={value} value={value}>
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <Tabs
                value={category}
                onValueChange={(value) => {
                  setSelectedPlace(null);
                  setCategory(value as Category);
                }}
              >
                <TabsList className="grid w-full grid-cols-4 sm:w-auto">
                  {CATEGORIES.map((item) => (
                    <TabsTrigger key={item.value} value={item.value}>
                      {item.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <Button
                variant="outline"
                onClick={() => fetchPlaces(region, category)}
                disabled={!isMapReady || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                현 위치 재검색
              </Button>
            </div>
          </div>
        </header>

        <section className="relative flex-1">
          <div
            ref={mapContainerRef}
            className="h-[calc(100vh-190px)] w-full md:h-[calc(100vh-145px)] lg:h-[calc(100vh-121px)]"
          />

          {!isMapReady ? (
            <div className="absolute inset-0 p-4">
              <Skeleton className="h-full w-full rounded-lg" />
            </div>
          ) : null}

          {isLoading ? (
            <Card className="absolute left-4 top-4 w-[min(calc(100vw-2rem),360px)]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  장소를 불러오는 중
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ) : null}

          <Card className="absolute bottom-4 left-4 w-[min(calc(100vw-2rem),380px)]">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-semibold">
                  {currentRegion.label} 추천 장소
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentRegion.subtitle}
                </p>
              </div>
              <div className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
                {places.length}곳
              </div>
            </CardContent>
          </Card>
        </section>
      </div>

      <Sheet
        open={Boolean(selectedPlace)}
        onOpenChange={(open) => {
          if (!open) setSelectedPlace(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[78vh] max-w-3xl overflow-y-auto rounded-t-lg"
        >
          {selectedPlace ? (
            <div className="mx-auto max-w-2xl">
              <SheetHeader>
                <SheetTitle className="text-2xl">
                  {selectedPlace.place_name}
                </SheetTitle>
                <SheetDescription>
                  카카오 로컬 API에서 가져온 장소 정보입니다.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Navigation className="h-4 w-4 text-primary" />
                      방문 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <p className="font-medium">도로명 주소</p>
                      <p className="mt-1 text-muted-foreground">
                        {selectedPlace.road_address_name || "정보 없음"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">지번 주소</p>
                      <p className="mt-1 text-muted-foreground">
                        {selectedPlace.address_name || "정보 없음"}
                      </p>
                    </div>
                    <div>
                      <p className="font-medium">전화번호</p>
                      <p className="mt-1 flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        {selectedPlace.phone || "정보 없음"}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MapPin className="h-4 w-4 text-primary" />
                      탐색 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div>
                      <p className="font-medium">카테고리</p>
                      <p className="mt-1 text-muted-foreground">
                        {selectedPlace.category_name || "정보 없음"}
                      </p>
                    </div>
                    <p className="text-muted-foreground">
                      사진과 리뷰는 카카오맵 상세 페이지에서 바로 확인할 수 있습니다.
                    </p>
                    <Button asChild className="w-full">
                      <a
                        href={selectedPlace.place_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        카카오맵 상세보기
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </main>
  );
}
