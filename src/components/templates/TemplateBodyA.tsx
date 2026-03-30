// src/components/templates/TemplateBodyA.tsx
import React from 'react';
import { PageData, Purpose } from '../../types';
import { getTextStyle, ReportFooter, DraggableImage } from './Shared';

export function TemplateBodyA({ page, pageIndex, purpose, onTextSelection, tocLabel }: { page: PageData, pageIndex: number, purpose: Purpose, onTextSelection?: (pageId: string, idx: number) => void, tocLabel?: string }) {
    const displayIndex = purpose === 'report' ? pageIndex - 1 : pageIndex + 1;
    const formattedIndex = Math.max(0, displayIndex).toString().padStart(2, '0');
    // tocLabel이 있으면 균등분배된 TOC 서브 넘버 사용, 없으면 기존 방식
    const headerLabel = tocLabel ?? `${formattedIndex}  ${page.content.title}`;
    const images = page.content.images || [];
    const text = page.content.text || [];

    return (
        <div className="w-full h-full relative p-0" style={{ display: 'grid', gridTemplateColumns: '21mm 261mm 10mm 107mm 21mm', gridTemplateRows: '34mm 21mm 17mm 196mm 29mm' }}>
            <div
                onMouseUp={() => onTextSelection?.(page.id, -1)}
                onTouchEnd={() => onTextSelection?.(page.id, -1)}
                data-text-index="-1"
                className="font-black text-black self-start"
                style={{ gridColumn: '2 / 5', gridRow: '2', fontSize: '50pt', ...getTextStyle(page.content.textStyles, -1) }}
            >
                {headerLabel}
            </div>
            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '2', gridRow: '4' }}>
                {images[0] && <DraggableImage pageId={page.id} imageIndex={0} src={images[0]} />}
            </div>
            <div className="flex flex-col justify-end gap-[20px] overflow-hidden" style={{ gridColumn: '4', gridRow: '4' }}>
                <div
                    onMouseUp={() => onTextSelection?.(page.id, 0)}
                    onTouchEnd={() => onTextSelection?.(page.id, 0)}
                    onContextMenu={(e) => e.preventDefault()}
                    data-text-index="0"
                    className="font-bold text-black leading-[1.5]"
                    style={{ fontSize: '14pt', wordBreak: 'keep-all', overflowWrap: 'break-word', ...getTextStyle(page.content.textStyles, 0) }}
                >
                    {text[0]}
                </div>
                <div
                    onMouseUp={() => onTextSelection?.(page.id, 1)}
                    onTouchEnd={() => onTextSelection?.(page.id, 1)}
                    onContextMenu={(e) => e.preventDefault()}
                    data-text-index="1"
                    className="text-[#555] leading-[1.6]"
                    style={{ fontSize: '14pt', wordBreak: 'keep-all', overflowWrap: 'break-word', ...getTextStyle(page.content.textStyles, 1) }}
                >
                    {text[1]}
                </div>
            </div>
            <ReportFooter />
        </div>
    );
}