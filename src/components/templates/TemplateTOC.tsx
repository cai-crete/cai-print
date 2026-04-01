// src/components/templates/TemplateTOC.tsx
import React from 'react';
import { PageData } from '../../types';
import { getTextStyle, ReportFooter } from './Shared';

// ──────────────────────────────────────────────────────────────────────────────
// TOC 그룹 분배 알고리즘
// ──────────────────────────────────────────────────────────────────────────────
export const MAX_TOC_SLOTS = 6;

export interface TocGroup {
  slotIndex: number;          // 1-based TOC 슬롯 번호 (1~6)
  pages: PageData[];          // 이 슬롯에 속한 본문 페이지들
  title: string;              // 대표 제목 — text[0] (페이지 테마)를 사용
  description: string;        // 대표 설명 — text[1] (페이지 요약)을 사용
}

export function computeTocGroups(contentPages: PageData[]): TocGroup[] {
  // [수정] 이미지가 하나도 없는 진짜 빈 페이지는 제외 (이미 App.tsx에서 텍스트가 지워졌으므로)
  const filteredPages = contentPages.filter(p => 
    p.content.images && p.content.images.some(img => img && img.trim() !== '')
  );
  const total = filteredPages.length;
  if (total === 0) return [];

  const slots = Math.min(total, MAX_TOC_SLOTS);
  const base = Math.floor(total / slots);
  const remainder = total % slots;

  const groups: TocGroup[] = [];
  let pageIdx = 0;

  for (let s = 0; s < slots; s++) {
    const count = base + (s < remainder ? 1 : 0);
    const slotPages = filteredPages.slice(pageIdx, pageIdx + count);
    pageIdx += count;

    const firstPage = slotPages[0];
    // [수정] title 소스: content.title(프로젝트명) → content.text[0](페이지 테마)
    // [수정] description 소스: content.text[0] → content.text[1](페이지 요약)
    groups.push({
      slotIndex: s + 1,
      pages: slotPages,
      title: firstPage?.content.text?.[0] || `Chapter ${s + 1}`,
      description: firstPage?.content.text?.[1]?.slice(0, 60) || '',
    });
  }

  return groups;
}

/**
 * 목차 번호 체계: [번호]. [대주제]: [소주제] 형식 적용
 */
export function computeTocLabels(allPages: PageData[]): Map<string, string> {
  const contentPages = allPages.filter(p => 
    p.type !== 'cover' && 
    p.type !== 'toc' && 
    p.content.images && 
    p.content.images.some(img => img && img.trim() !== '')
  );
  const groups = computeTocGroups(contentPages);
  const labelMap = new Map<string, string>();

  for (const group of groups) {
    const num = String(group.slotIndex).padStart(2, '0');
    if (group.pages.length === 1) {
      labelMap.set(group.pages[0].id, `${num}. ${group.title}`);
    } else {
      group.pages.forEach((page) => {
        labelMap.set(page.id, `${num}. ${group.title}: ${page.content.text?.[0] || ''}`);
      });
    }
  }

  return labelMap;
}

interface TemplateTOCProps {
  page: PageData;
  allPages?: PageData[];
  onTextSelection?: (pageId: string, idx: number) => void;
}

export function TemplateTOC({ page, allPages }: TemplateTOCProps) {
  const contentPages = allPages ? allPages.filter(p => 
    p.type !== 'cover' && 
    p.type !== 'toc' && 
    p.content.images && 
    p.content.images.some(img => img && img.trim() !== '')
  ) : [];
  const useDynamic = contentPages.length > 0;

  // 동적 그룹 추출
  const tocGroups = useDynamic ? computeTocGroups(contentPages) : [];

  // 렌더링할 아이템 리스트
  const renderItems = useDynamic
    ? tocGroups
    : [];  // 동적 페이지가 없으면 목차 항목 없음

  return (
    <div className="w-full h-full relative bg-white p-[15mm] flex flex-col box-border font-['Pretendard'] overflow-hidden">
      {/* 1. 헤더 영역 (읽기 전용) */}
      <div className="inner-header flex justify-between items-start" style={{ marginBottom: '15mm' }}>
        <div
          className="font-black leading-none"
          style={{ fontSize: '60pt', height: '60mm', width: '300mm', display: 'flex', alignItems: 'center' }}
        >
          CONTENTS
        </div>
        {/* [수정] COMPANY NAME → CRE-TE 고정 */}
        <div className="comp-name font-bold text-right" style={{ fontSize: '14pt', minWidth: '60mm', padding: '2px 5px' }}>
          CRE-TE
        </div>
      </div>

      {/* 2. 목차 그리드 (3열) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20mm 15mm', flexGrow: 1, alignContent: 'end' }}>
        {renderItems.map((item, i) => {
          const num = String(item.slotIndex).padStart(2, '0');
          // 동적: text[0] 기반 제목, 각 페이지 제목 목록
          const itemTitle = (item as TocGroup).title || '';
          // 서브 페이지가 2개 이상인 경우에만 서브 목차 표시
          const group = item as TocGroup;
          const itemDesc = (useDynamic && group.pages && group.pages.length > 1)
            ? group.pages.map((p, idx) =>
                `${String(idx + 1).padStart(2, '0')} ${p.content.text?.[0] || ''}`
              ).join('\n')
            : '';


          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '60mm' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5mm', marginBottom: '3mm' }}>
                <span className="font-black leading-none tracking-tighter" style={{ fontSize: '32pt', minWidth: '15mm' }}>
                  {num}
                </span>
                <span
                  className="font-bold"
                  style={{ fontSize: '18pt', ...getTextStyle(page.content.textStyles, i * 2) }}
                >
                  {itemTitle}
                </span>
              </div>
              <div
                className="text-gray-500 leading-relaxed whitespace-pre-wrap"
                style={{ fontSize: '11pt', paddingLeft: '20mm', height: '40mm', overflow: 'hidden', ...getTextStyle(page.content.textStyles, i * 2 + 1) }}
              >
                {itemDesc}
              </div>
            </div>
          );
        })}
      </div>

      <ReportFooter />
    </div>
  );
}