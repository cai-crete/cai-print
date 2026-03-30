// src/components/templates/TemplateTOC.tsx
import React from 'react';
import { PageData } from '../../types';
import { ReportFooter } from './Shared';

// ──────────────────────────────────────────────────────────────────────────────
// TOC 그룹 분배 알고리즘
// - total_pages <= 6  : 1:1 매핑 (빈 슬롯 숨김)
// - total_pages > 6   : 몫+나머지 균등 분배
//
// 예시: 9페이지 → [1,2,2,3,3,4,5,6,6] (각 페이지가 속하는 TOC 인덱스, 1-based)
// ──────────────────────────────────────────────────────────────────────────────
export const MAX_TOC_SLOTS = 6;

export interface TocGroup {
  slotIndex: number;          // 1-based TOC 슬롯 번호 (1~6)
  pages: PageData[];          // 이 슬롯에 속한 본문 페이지들
  title: string;              // 대표 제목 (첫 번째 페이지 title 사용)
  description: string;        // 대표 설명 (첫 번째 페이지 text[0])
}

/**
 * contentPages(본문 페이지 배열)를 최대 6개 TOC 슬롯으로 균등 분배한다.
 * 반환값: TocGroup 배열 (최대 6개)
 */
export function computeTocGroups(contentPages: PageData[]): TocGroup[] {
  const total = contentPages.length;
  if (total === 0) return [];

  const slots = Math.min(total, MAX_TOC_SLOTS);
  const base = Math.floor(total / slots);      // 슬롯당 기본 할당
  const remainder = total % slots;             // 추가 1페이지를 받을 슬롯 수

  // 검증용 콘솔 로그 (total 7, 9, 14 케이스)
  if ([7, 9, 14].includes(total)) {
    const assignment: number[] = [];
    let pageIdx = 0;
    for (let s = 0; s < slots; s++) {
      const count = base + (s < remainder ? 1 : 0);
      for (let k = 0; k < count; k++) {
        assignment.push(s + 1);
        pageIdx++;
      }
    }
    console.log(`[TOC 분배 검증] total=${total}, slots=${slots}, base=${base}, remainder=${remainder}`);
    console.log(`  → TOC 인덱스 배열:`, assignment);
  }

  const groups: TocGroup[] = [];
  let pageIdx = 0;

  for (let s = 0; s < slots; s++) {
    // 나머지 페이지: 앞쪽 'remainder'개의 슬롯에 1개씩 추가 배분
    const count = base + (s < remainder ? 1 : 0);
    const slotPages = contentPages.slice(pageIdx, pageIdx + count);
    pageIdx += count;

    const firstPage = slotPages[0];
    groups.push({
      slotIndex: s + 1,
      pages: slotPages,
      title: firstPage?.content.title || `Page ${s + 1}`,
      description: firstPage?.content.text?.[0]?.slice(0, 60) || '',
    });
  }

  return groups;
}

/**
 * 각 본문 페이지의 page.id → 서브 넘버링 라벨 맵을 반환한다.
 * 예: "02. 공간 구현 (1/2)", "02. 공간 구현 (2/2)"
 * 1페이지짜리 슬롯은 서브 넘버링 생략: "01. 외관 디자인"
 */
export function computeTocLabels(allPages: PageData[]): Map<string, string> {
  const contentPages = allPages.filter(p => p.type !== 'cover' && p.type !== 'toc');
  const groups = computeTocGroups(contentPages);
  const labelMap = new Map<string, string>();

  for (const group of groups) {
    const num = String(group.slotIndex).padStart(2, '0');
    if (group.pages.length === 1) {
      labelMap.set(group.pages[0].id, `${num}. ${group.title}`);
    } else {
      group.pages.forEach((page, subIdx) => {
        labelMap.set(page.id, `${num}. ${group.title} (${subIdx + 1}/${group.pages.length})`);
      });
    }
  }

  return labelMap;
}

// ──────────────────────────────────────────────────────────────────────────────
// TemplateTOC 컴포넌트
// ──────────────────────────────────────────────────────────────────────────────
interface TemplateTOCProps {
  page: PageData;
  allPages?: PageData[];  // 전체 페이지 배열 (동적 목차 생성용)
  onTextSelection?: (pageId: string, idx: number) => void;
}

export function TemplateTOC({ page, allPages, onTextSelection }: TemplateTOCProps) {
  const text = page.content.text || [];

  // 표지(cover)와 목차(toc) 자신을 제외한 순수 본문 페이지 추출
  const contentPages = allPages
    ? allPages.filter(p => p.type !== 'cover' && p.type !== 'toc')
    : [];

  // 동적 그룹 vs 정적 fallback 분기
  const useDynamic = contentPages.length > 0;
  const tocGroups = useDynamic ? computeTocGroups(contentPages) : null;
  const itemCount = tocGroups ? tocGroups.length : 6;

  // 그리드 배치: 3열 × 2행 구조 (최대 6개)
  // col: 2, 4, 6 / row: 4(상단 3개), 6(하단 3개)
  const getGridPos = (i: number) => ({
    gridColumn: i % 3 === 0 ? 2 : i % 3 === 1 ? 4 : 6,
    gridRow: i < 3 ? 4 : 6,
  });

  return (
    <div
      className="w-full h-full relative p-0"
      style={{
        display: 'grid',
        gridTemplateColumns: '22mm 118mm 11mm 118mm 12mm 118mm 21mm',
        gridTemplateRows: '34mm 21mm 151mm 23mm 12mm 23mm 33mm',
      }}
    >
      <div
        className="font-black text-black self-start"
        style={{ gridColumn: '2 / 7', gridRow: '2', fontSize: '50pt' }}
      >
        Contents
      </div>

      {Array.from({ length: itemCount }, (_, i) => {
        const pos = getGridPos(i);
        const num = String(i + 1).padStart(2, '0');

        let itemTitle: string;
        let itemDesc: string;

        if (tocGroups) {
          // 동적 모드: 그룹 데이터 사용
          const group = tocGroups[i];
          itemTitle = group.title;
          // 여러 페이지가 묶인 경우 페이지 수 표시
          itemDesc = group.pages.length > 1
            ? `${group.description}  (${group.pages.length}p 묶음)`
            : group.description;
        } else {
          // Fallback: AI가 생성한 text[] 기반 (최대 6개)
          itemTitle = text[i * 2] || 'Topic title';
          itemDesc = text[i * 2 + 1] || 'Brief description';
        }

        return (
          <div
            key={i}
            style={{ ...pos, display: 'flex', gap: '15px', alignSelf: 'start' }}
          >
            <div
              className="font-black leading-[0.75] tracking-[-2px] text-black"
              style={{ fontSize: '45pt' }}
            >
              {num}
            </div>
            <div>
              <div
                onMouseUp={() => !useDynamic && onTextSelection?.(page.id, i * 2)}
                onTouchEnd={() => !useDynamic && onTextSelection?.(page.id, i * 2)}
                onContextMenu={(e) => e.preventDefault()}
                data-text-index={i * 2}
                className="font-black text-black max-w-[110mm] overflow-hidden break-keep"
                style={{ fontSize: '18pt', ...(useDynamic ? {} : {}) }}
              >
                {itemTitle}
              </div>
              <div
                onMouseUp={() => !useDynamic && onTextSelection?.(page.id, i * 2 + 1)}
                onTouchEnd={() => !useDynamic && onTextSelection?.(page.id, i * 2 + 1)}
                onContextMenu={(e) => e.preventDefault()}
                data-text-index={i * 2 + 1}
                className="text-gray-400 max-w-[110mm] overflow-hidden break-keep"
                style={{ fontSize: '12pt' }}
              >
                {itemDesc}
              </div>
            </div>
          </div>
        );
      })}

      <ReportFooter />
    </div>
  );
}