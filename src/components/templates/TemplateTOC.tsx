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
  title: string;              // 대표 제목 (첫 번째 페이지 title 사용)
  description: string;        // 대표 설명 (첫 번째 페이지 text[0])
}

export function computeTocGroups(contentPages: PageData[]): TocGroup[] {
  const total = contentPages.length;
  if (total === 0) return [];

  const slots = Math.min(total, MAX_TOC_SLOTS);
  const base = Math.floor(total / slots);
  const remainder = total % slots;

  const groups: TocGroup[] = [];
  let pageIdx = 0;

  for (let s = 0; s < slots; s++) {
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
 * 목차 번호 체계 개선: [번호]. [대주제]: [소주제] 형식 적용
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
      group.pages.forEach((page) => {
        labelMap.set(page.id, `${num}. ${group.title}: ${page.content.title}`);
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

export function TemplateTOC({ page, allPages, onTextSelection }: TemplateTOCProps) {
  const text = page.content.text || [];
  const contentPages = allPages ? allPages.filter(p => p.type !== 'cover' && p.type !== 'toc') : [];
  const useDynamic = contentPages.length > 0;
  
  // 동적 그룹 추출
  const tocGroups = useDynamic ? computeTocGroups(contentPages) : [];
  
  // 렌더링할 아이템 리스트 결정 (사용자 요청: 6개 미만 시 유휴 항목 삭제)
  const renderItems = useDynamic 
    ? tocGroups 
    : Array.from({ length: 6 }).map((_, i) => ({
        slotIndex: i + 1,
        title: text[i * 2],
        description: text[i * 2 + 1]
      })).filter(item => item.title); // Fallback 시에도 제목 없는 슬롯은 삭제

  return (
    <div className="w-full h-full relative bg-white p-[15mm] flex flex-col box-border font-['Pretendard'] overflow-hidden">
      {/* 1. 헤더 영역 */}
      <div className="inner-header flex justify-between items-start" style={{ marginBottom: '15mm' }}>
        <div 
          className="editable font-black leading-none" 
          style={{ fontSize: '60pt', height: '60mm', width: '300mm', display: 'flex', alignItems: 'center' }}
        >
          CONTENTS
        </div>
        <div className="editable comp-name font-bold text-right" style={{ fontSize: '14pt', minWidth: '60mm', padding: '2px 5px' }}>
          COMPANY NAME
        </div>
      </div>

      {/* 2. 목차 그리드 (3열) - 유동적 레이아웃 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20mm 15mm', flexGrow: 1, alignContent: 'end' }}>
        {renderItems.map((item, i) => {
          const num = String(item.slotIndex).padStart(2, '0');
          let itemTitle = item.title || "";
          let itemDesc = item.description || "";

          // 동적 생성 시 서브 페이지 번호 자동화 (01. 02. 형식)
          if (useDynamic && (item as TocGroup).pages) {
            const group = item as TocGroup;
            itemDesc = group.pages.map((p, idx) => `${String(idx + 1).padStart(2, '0')} ${p.content.title}`).join('\n');
          }

          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '60mm' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5mm', marginBottom: '3mm' }}>
                <span className="editable font-black leading-none tracking-tighter" style={{ fontSize: '32pt', minWidth: '15mm' }}>{num}</span>
                <span 
                  onMouseUp={() => !useDynamic && onTextSelection?.(page.id, i * 2)}
                  onTouchEnd={() => !useDynamic && onTextSelection?.(page.id, i * 2)}
                  onContextMenu={(e) => e.preventDefault()}
                  data-text-index={i * 2}
                  className="editable font-bold" 
                  style={{ fontSize: '18pt', ...getTextStyle(page.content.textStyles, i * 2) }}
                >
                  {itemTitle}
                </span>
              </div>
              <div 
                onMouseUp={() => !useDynamic && onTextSelection?.(page.id, i * 2 + 1)}
                onTouchEnd={() => !useDynamic && onTextSelection?.(page.id, i * 2 + 1)}
                onContextMenu={(e) => e.preventDefault()}
                data-text-index={i * 2 + 1}
                className="editable text-gray-500 leading-relaxed whitespace-pre-wrap" 
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