// src/components/templates/TemplateCover.tsx
import React from 'react';
import { PageData } from '../../types';
import { getTextStyle, ReportFooter } from './Shared';

export function TemplateCover({ page, onTextSelection }: { page: PageData, onTextSelection?: (pageId: string, idx: number) => void }) {
  const text = page.content.text || [];

  return (
    <div className="w-full h-full relative p-0" style={{ display: 'grid', gridTemplateColumns: '118mm 16mm 266mm 7mm 13mm', gridTemplateRows: '34mm 89mm 7mm 25mm 111mm 12mm 19mm' }}>
      <div style={{ gridColumn: '2 / 5', gridRow: '2', textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
        <h1
          onMouseUp={() => onTextSelection?.(page.id, -1)}
          onTouchEnd={() => onTextSelection?.(page.id, -1)}
          onContextMenu={(e) => e.preventDefault()}
          data-text-index="-1"
          className="font-black text-black leading-[0.9] tracking-[-3px] font-[Pretendard]"
          style={{ fontSize: '110pt', wordBreak: 'keep-all', ...getTextStyle(page.content.textStyles, -1) }}
        >
          {page.content.title}
        </h1>
      </div>
      <div style={{ gridColumn: '2 / 5', gridRow: '4', textAlign: 'right' }}>
        <h2
          onMouseUp={() => onTextSelection?.(page.id, 0)}
          onTouchEnd={() => onTextSelection?.(page.id, 0)}
          onContextMenu={(e) => e.preventDefault()}
          data-text-index="0"
          className="font-medium text-black tracking-[-1px] font-[Pretendard]"
          style={{ fontSize: '42pt', wordBreak: 'keep-all', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', ...getTextStyle(page.content.textStyles, 0) }}
        >
          {text[0] || "There's a subtitle, too"}
        </h2>
      </div>
      <div style={{ gridColumn: '3 / 5', gridRow: '6', textAlign: 'right' }}>
        <p
          data-text-index="1"
          onMouseUp={() => onTextSelection?.(page.id, 1)}
          onTouchEnd={() => onTextSelection?.(page.id, 1)}
          onContextMenu={(e) => e.preventDefault()}
          className="font-bold text-black font-[Pretendard]"
          style={{ fontSize: '15pt', ...getTextStyle(page.content.textStyles, 1) }}
        >
          {text[1] || 'CAI (CRETE-AI)  |  info@cre-te.com'}
        </p>
      </div>
      <ReportFooter isCover={true} />
    </div>
  );
}