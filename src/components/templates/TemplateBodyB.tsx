// src/components/templates/TemplateBodyB.tsx
import React from 'react';
import { PageData, Purpose } from '../../types';
import { getTextStyle, ReportFooter, DraggableImage } from './Shared';

export function TemplateBodyB({ page, pageIndex, purpose, onTextSelection, tocLabel }: { page: PageData, pageIndex: number, purpose: Purpose, onTextSelection?: (pageId: string, idx: number) => void, tocLabel?: string }) {
    const displayIndex = purpose === 'report' ? pageIndex - 1 : pageIndex + 1;
    const formattedIndex = Math.max(0, displayIndex).toString().padStart(2, '0');
    const headerLabel = tocLabel ?? `${formattedIndex}  ${page.content.title}`;
    const images = page.content.images || [];
    const text = page.content.text || [];

    return (
        <div className="w-full h-full relative p-0" style={{ display: 'grid', gridTemplateColumns: '21mm 38mm 147mm 8mm 185mm 21mm', gridTemplateRows: '34mm 21mm 17mm 10mm 15mm 6mm 139mm 5mm 21mm 29mm' }}>
            <div
                onMouseUp={() => onTextSelection?.(page.id, -1)}
                onTouchEnd={() => onTextSelection?.(page.id, -1)}
                onContextMenu={(e) => e.preventDefault()}
                data-text-index="-1"
                className="font-black text-black self-start"
                style={{ gridColumn: '2 / 6', gridRow: '2', fontSize: '50pt', ...getTextStyle(page.content.textStyles, -1) }}
            >
                {headerLabel}
            </div>
            <div className="bg-black text-white font-bold flex items-center justify-center self-start justify-self-start" style={{ gridColumn: '2', gridRow: '4', fontSize: '14pt', padding: '4px 15px' }}>Process</div>
            <div
                onMouseUp={() => onTextSelection?.(page.id, 0)}
                onTouchEnd={() => onTextSelection?.(page.id, 0)}
                onContextMenu={(e) => e.preventDefault()}
                data-text-index="0"
                className="pl-[15px] text-[#555] leading-[1.6]"
                style={{ gridColumn: '3 / 6', gridRow: '4 / 6', fontSize: '14pt', wordBreak: 'keep-all', ...getTextStyle(page.content.textStyles, 0) }}
            >
                {text[0]}
            </div>
            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '2 / 4', gridRow: '7' }}>{images[0] && <DraggableImage pageId={page.id} imageIndex={0} src={images[0]} />}</div>
            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '5', gridRow: '7' }}>{images[1] && <DraggableImage pageId={page.id} imageIndex={1} src={images[1]} />}</div>
            <div
                onMouseUp={() => onTextSelection?.(page.id, 1)}
                onTouchEnd={() => onTextSelection?.(page.id, 1)}
                onContextMenu={(e) => e.preventDefault()}
                data-text-index="1"
                className="text-[#555] leading-[1.6] self-end"
                style={{ gridColumn: '2 / 4', gridRow: '9', fontSize: '14pt', wordBreak: 'keep-all', overflowWrap: 'break-word', ...getTextStyle(page.content.textStyles, 1) }}
            >
                {text[1]}
            </div>
            <div
                onMouseUp={() => onTextSelection?.(page.id, 2)}
                onTouchEnd={() => onTextSelection?.(page.id, 2)}
                onContextMenu={(e) => e.preventDefault()}
                data-text-index="2"
                className="text-[#555] leading-[1.6] self-end"
                style={{ gridColumn: '5', gridRow: '9', fontSize: '14pt', wordBreak: 'keep-all', overflowWrap: 'break-word', ...getTextStyle(page.content.textStyles, 2) }}
            >
                {text[2]}
            </div>
            <ReportFooter />
        </div>
    );
}