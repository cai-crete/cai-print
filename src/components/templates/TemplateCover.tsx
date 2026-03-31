// src/components/templates/TemplateCover.tsx
import React from 'react';
import { PageData } from '../../types';
import { getTextStyle, ReportFooter } from './Shared';

export function TemplateCover({ page, onTextSelection }: { page: PageData, onTextSelection?: (pageId: string, idx: number) => void }) {
  const text = page.content.text || [];
  
  // 오늘 날짜 계산 (YYYY.MM.DD)
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\s/g, '').replace(/\.$/, '');

  return (
    <div className="w-full h-full relative bg-white p-[15mm] flex flex-col box-border font-['Pretendard'] overflow-hidden">
      {/* 1. 상단 키워드 영역 (원본 HTML: height 20mm, text-align center) */}
      <div
        onMouseUp={() => onTextSelection?.(page.id, 2)}
        onTouchEnd={() => onTextSelection?.(page.id, 2)}
        onContextMenu={(e) => e.preventDefault()}
        data-text-index="2"
        className="editable keyword-area font-bold text-black flex items-center justify-center text-center"
        style={{ fontSize: '12pt', height: '20mm', letterSpacing: '0.2em', width: '100%', ...getTextStyle(page.content.textStyles, 2) }}
      >
        {text[2] || "KEYWORD / KEYWORD / KEYWORD / KEYWORD"}
      </div>

      {/* 2. 중앙 타이틀 및 서브타이틀 영역 (원본 HTML: flex 1, justify-center, gap 10mm) */}
      <div className="flex-1 flex flex-col items-center justify-center gap-[10mm]">
        {/* 메인 타이틀 (원본 HTML: 72pt, height 100mm, width 350mm) */}
        <div 
          onMouseUp={() => onTextSelection?.(page.id, -1)}
          onTouchEnd={() => onTextSelection?.(page.id, -1)}
          onContextMenu={(e) => e.preventDefault()}
          data-text-index="-1"
          className="editable font-black leading-[1.1] text-center break-keep flex items-center justify-center" 
          style={{ fontSize: '72pt', width: '350mm', height: '100mm', ...getTextStyle(page.content.textStyles, -1) }}
        >
          {page.content.title}
        </div>
        
        {/* 서브 타이틀 (원본 HTML: 28pt, height 40mm, width 350mm) */}
        <div 
          onMouseUp={() => onTextSelection?.(page.id, 0)}
          onTouchEnd={() => onTextSelection?.(page.id, 0)}
          onContextMenu={(e) => e.preventDefault()}
          data-text-index="0"
          className="editable font-bold text-gray-800 break-keep text-center flex items-center justify-center" 
          style={{ fontSize: '28pt', width: '350mm', height: '40mm', lineHeight: '1.4', ...getTextStyle(page.content.textStyles, 0) }}
        >
          {text[0] || ""}
        </div>
      </div>

      {/* 3. 하단 정보 영역 (날짜 및 기업명 - 원본 HTML: height 20mm, flex-between, align-end) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%', height: '20mm' }}>
        <div 
          onMouseUp={() => onTextSelection?.(page.id, 1)}
          onTouchEnd={() => onTextSelection?.(page.id, 1)}
          onContextMenu={(e) => e.preventDefault()}
          data-text-index="1"
          className="editable font-medium text-gray-800 flex items-end" 
          style={{ fontSize: '14pt', minWidth: '50mm', height: '100%', ...getTextStyle(page.content.textStyles, 1) }}
        >
          {text[1] || today}
        </div>
        <div 
          onMouseUp={() => onTextSelection?.(page.id, 3)}
          onTouchEnd={() => onTextSelection?.(page.id, 3)}
          onContextMenu={(e) => e.preventDefault()}
          data-text-index="3"
          className="editable comp-name font-bold text-gray-800 text-right flex items-end justify-end" 
          style={{ fontSize: '14pt', fontWeight: 700, minWidth: '60mm', height: '100%', ...getTextStyle(page.content.textStyles, 3) }}
        >
          {text[3] || "CRE-TE"}
        </div>
      </div>

      <ReportFooter isCover={true} />
    </div>
  );
}