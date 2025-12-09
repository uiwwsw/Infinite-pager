# Infinite Paper 📜

[![npm version](https://img.shields.io/npm/v/@uiwwsw/infinite-paper.svg)](https://www.npmjs.com/package/@uiwwsw/infinite-paper)
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
- **⚡ All-in-One Mode**: Simply provide `itemHeight`, and the hook automatically handles scroll listeners, spacers, and infinite loading triggers.
- **🚀 Performance Optimized**: Batched state updates and efficient re-rendering strategies.
- **🧩 Headless & Flexible**: Works with `react-window`, `react-virtual`, or standard CSS overflow scrolling.
- **🛒 Amazon-style Pagination**: Includes logic for "1 ... 4 5 6 ... 100" style pagination controls.

### Installation

```bash
npm install @uiwwsw/infinite-paper
# or
yarn add @uiwwsw/infinite-paper
# or
pnpm add @uiwwsw/infinite-paper
```

### Usage (Recommended: All-in-One Mode)

Simply verify your item height and pass it to the hook. It will give you `containerRef`, `topSpacerHeight`, and `bottomSpacerHeight` to render.

```tsx
import useInfinitePaper, { Pagination } from "@uiwwsw/infinite-paper";

function App() {
  const { 
    items, 
    paginationItems, 
    setPage, 
    containerRef, 
    topSpacerHeight, 
    bottomSpacerHeight 
  } = useInfinitePaper({
    pageSize: 20,
    totalPages: 100,
    itemHeight: 50, // Providing this enables Auto-Scroll & Spacers
    fetchPage: async (page) => {
      const res = await fetch(`/api/items?page=${page}`);
      return res.json();
    }
  });

  return (
    <div>
      {/* Scroll Container */}
      <div 
        ref={containerRef} 
        style={{ height: 500, overflow: 'auto', overflowAnchor: 'none' }}
      >
        <div style={{ height: topSpacerHeight }} />
        
        {items.map(item => (
           <div key={item.globalIndex} style={{ height: 50 }}>
             {item.item}
           </div>
        ))}
        
        <div style={{ height: bottomSpacerHeight }} />
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
- **⚡ 올인원 모드 (All-in-One)**: `itemHeight`만 제공하면 스크롤 감지, 여백 계산, 무한 스크롤 트리거를 자동으로 처리합니다.
- **🚀 성능 최적화**: 상태 업데이트 배치 처리 및 효율적인 리렌더링 전략이 적용되었습니다.
- **🧩 헤드리스 & 유연성**: `react-window`, `react-virtual` 또는 일반 CSS 스크롤과 완벽하게 호환됩니다.
- **🛒 아마존 스타일 페이지네이션**: "1 ... 4 5 6 ... 100" 형태의 페이지네이션 로직을 내장하고 있습니다.

### 설치 방법

```bash
npm install @uiwwsw/infinite-paper
# 또는
yarn add @uiwwsw/infinite-paper
# 또는
pnpm add @uiwwsw/infinite-paper
```

### 사용 예시 (권장: 올인원 모드)

항목의 높이(`itemHeight`)만 알면 가장 쉽게 사용할 수 있습니다.

```tsx
import useInfinitePaper, { Pagination } from "@uiwwsw/infinite-paper";

function App() {
  const { 
    items, 
    paginationItems, 
    setPage, 
    containerRef, 
    topSpacerHeight, 
    bottomSpacerHeight 
  } = useInfinitePaper({
    pageSize: 20,
    totalPages: 100,
    itemHeight: 50, // 이 값을 넣으면 자동 스크롤 및 여백 계산이 켜집니다
    fetchPage: async (page) => {
      const res = await fetch(`/api/items?page=${page}`);
      return res.json();
    }
  });

  return (
    <div>
      {/* 스크롤 컨테이너 */}
      <div 
        ref={containerRef} 
        style={{ height: 500, overflow: 'auto', overflowAnchor: 'none' }}
      >
        {/* 상단 여백 (스크롤 위치 유지용) */}
        <div style={{ height: topSpacerHeight }} />
        
        {items.map(item => (
           <div key={item.globalIndex} style={{ height: 50 }}>
             {item.item}
           </div>
        ))}
        
        {/* 하단 여백 (전체 스크롤 길이 유지용) */}
        <div style={{ height: bottomSpacerHeight }} />
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
