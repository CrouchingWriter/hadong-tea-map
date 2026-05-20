# 남도 로컬 투어 & 다원 맵

Kakao Maps API와 Kakao Local API를 이용해 하동과 보성의 다원, 찻집, 명소를 지도에 표시하는 Next.js App Router 프로젝트입니다.

## 실행 준비

```bash
npm install
```

`.env.local` 파일을 만들고 아래 값을 채워 주세요.

```env
NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY=your_kakao_javascript_key
KAKAO_REST_API_KEY=your_kakao_rest_api_key
```

## 로컬 실행

```bash
npm run dev
```

## Kakao Developers 설정

Web 플랫폼에 로컬과 배포 도메인을 등록해야 지도가 정상적으로 표시됩니다.

- `http://localhost:3000`
- Vercel 배포 후 발급되는 도메인

## 구현 범위

- 지역 필터: 하동, 보성
- 카테고리 필터: 전체, 다원, 찻집, 명소
- Kakao Maps API 지도 렌더링
- Kakao Local API 키워드 검색 서버 라우트
- async/await 기반 비동기 장소 로딩
- Skeleton 로딩 상태
- API 실패 또는 빈 결과 Toast 알림
- 예외 발생 시 선택 지역 중심 좌표로 `panTo` 복귀
- 마커 클릭 시 Sheet 상세 패널 표시
