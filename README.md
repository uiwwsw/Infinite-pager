# Infinite Paper 📜

[![npm version](https://img.shields.io/npm/v/@uiwwsw/infinitePaper.svg)](https://www.npmjs.com/package/@uiwwsw/infinitePaper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/uiwwsw/Infinite-pager/actions/workflows/ci.yml/badge.svg)](https://github.com/uiwwsw/Infinite-pager/actions/workflows/ci.yml)

**Infinite Paper** is a powerful, headless React hook that seamlessly bridges the gap between **infinite scrolling** and **numbered pagination**. It allows you to maintain a sliding window of contiguous pages in memory, ensuring high performance even with massive datasets.

> **Note**: This library is headless. You provide the UI (buttons, scroll container), and `useInfinitePaper` handles the logic.

---

## 🌏 Language / 언어

- [English](#english)
- [한국어 (Korean)](#한국어-korean)

---

<a name="english"></a>
## English

### Features

- **🧠 Smart Memory Management**: Keeps only a configurable "window" of pages in memory. No more crashing the browser with 10,000 DOM nodes.
- **🔄 Bi-directional Sync**: Scrolling updates the pagination; clicking pagination updates the scroll position.
- **🚀 Performance Optimized**: Batched state updates and efficient re-rendering strategies.
- **🧩 Headless & Flexible**: Works with `react-window`, `react-virtual`, or standard CSS overflow scrolling.
- **🛒 Amazon-style Pagination**: Includes logic for "1 ... 4 5 6 ... 100" style pagination controls.

### Installation

```bash
npm install @uiwwsw/infinitePaper
# or
yarn add @uiwwsw/infinitePaper
# or
pnpm add @uiwwsw/infinitePaper
```

### Usage

```tsx
import useInfinitePaper, { Pagination } from "@uiwwsw/infinitePaper";

function App() {
  const { 
    items, 
    paginationItems, 
    handleVisibleRange, 
    setPage,
    infiniteScrollOptions 
  } = useInfinitePaper({
    pageSize: 20,
    totalPages: 100,
    fetchPage: async (page) => {
      const res = await fetch(`/api/items?page=${page}`);
      return res.json();
    }
  });

  return (
    <div>
      {/* Your Virtual List or Scroll Container */}
      <div onScroll={(e) => {
         // Calculate visible range and call handleVisibleRange
      }}>
        {items.map(item => <div key={item.globalIndex}>{item.item}</div>)}
      </div>

      {/* Pagination Controls */}
      <Pagination 
        items={paginationItems} 
        onPageChange={setPage} 
      />
    </div>
  );
}
```

---

<a name="한국어-korean"></a>
## 한국어 (Korean)

### 주요 기능

- **🧠 스마트 메모리 관리**: 설정된 "윈도우" 크기만큼의 페이지만 메모리에 유지합니다. 대용량 데이터도 브라우저 부하 없이 처리할 수 있습니다.
- **🔄 양방향 동기화**: 스크롤하면 페이지네이션이 업데이트되고, 페이지네이션을 클릭하면 스크롤 위치가 이동합니다.
- **🚀 성능 최적화**: 상태 업데이트 배치 처리 및 효율적인 리렌더링 전략이 적용되었습니다.
- **🧩 헤드리스 & 유연성**: `react-window`, `react-virtual` 또는 일반 CSS 스크롤과 완벽하게 호환됩니다.
- **🛒 아마존 스타일 페이지네이션**: "1 ... 4 5 6 ... 100" 형태의 페이지네이션 로직을 내장하고 있습니다.

### 설치 방법

```bash
npm install @uiwwsw/infinitePaper
# 또는
yarn add @uiwwsw/infinitePaper
# 또는
pnpm add @uiwwsw/infinitePaper
```

### 사용 예시

```tsx
import useInfinitePaper, { Pagination } from "@uiwwsw/infinitePaper";

function App() {
  const { 
    items, 
    paginationItems, 
    handleVisibleRange, 
    setPage,
    infiniteScrollOptions 
  } = useInfinitePaper({
    pageSize: 20,
    totalPages: 100,
    fetchPage: async (page) => {
      const res = await fetch(`/api/items?page=${page}`);
      return res.json();
    }
  });

  return (
    <div>
      {/* 가상 리스트 또는 스크롤 컨테이너 */}
      <div onScroll={(e) => {
         // 보이는 범위를 계산하여 handleVisibleRange 호출
      }}>
        {items.map(item => <div key={item.globalIndex}>{item.item}</div>)}
      </div>

      {/* 페이지네이션 컨트롤 */}
      <Pagination 
        items={paginationItems} 
        onPageChange={setPage} 
      />
    </div>
  );
}
```

## License

MIT © [uiwwsw](https://github.com/uiwwsw)
