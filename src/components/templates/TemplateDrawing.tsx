// src/components/templates/TemplateDrawing.tsx
import React from 'react';
import { PageData } from '../../types';
import { getTextStyle, DraggableImage } from './Shared';

export function TemplateDrawing({ page, onTextSelection, tocLabel: _tocLabel }: { page: PageData, onTextSelection?: (pageId: string, idx: number) => void, tocLabel?: string }) {
    const TB_BORDER_THICK = '1.5pt solid #000';
    const TB_BORDER_THIN = '0.5pt solid #000';

    const metaRows = [
        { label: 'DESIGNED BY', value: page.content.text[1] || 'CRETE-AI' },
        { label: 'ARCHITECTURAL ENGINEER', value: page.content.text[2] || 'YONGSU. LEE' },
        { label: 'APPROVED BY', value: page.content.text[3] || 'CRETE GROUP' },
        { label: 'SCALE', value: page.content.text[4] || '1/100' },
        { label: 'DRAWING NO.', value: page.content.text[5] || 'A-101' },
        { label: 'SHEET NO.', value: page.content.text[6] || '01 / 10' },
        { label: 'FILE NAME', value: page.content.text[7] || '-' },
    ];

    return (
        <div className="w-full h-full bg-white font-['S-Core_Dream']" style={{ padding: '7mm' }}>
            <div className="w-full h-full flex" style={{ border: TB_BORDER_THICK, boxSizing: 'border-box' }}>
                <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ borderRight: TB_BORDER_THICK }}>
                    {page.content.images[0] ? (
                        <DraggableImage pageId={page.id} imageIndex={0} src={page.content.images[0]} objectFit="contain" />
                    ) : (
                        <div className="text-gray-200 font-black text-4xl uppercase tracking-[0.5em] select-none text-center opacity-40">Drawing Area</div>
                    )}
                </div>
                <div className="flex flex-col shrink-0" style={{ width: '40mm', background: '#fff' }}>
                    <div className="flex flex-col shrink-0" style={{ height: '12mm', borderBottom: TB_BORDER_THICK, padding: '2mm 3mm' }}>
                        <div style={{ fontFamily: 'S-CoreDream-8Heavy', fontSize: '5.5pt', color: '#000', textTransform: 'uppercase', marginBottom: '1mm' }}>PROJECT TITLE</div>
                        <div
                            onMouseUp={() => onTextSelection?.(page.id, -1)}
                            onTouchEnd={() => onTextSelection?.(page.id, -1)}
                            onContextMenu={(e) => e.preventDefault()}
                            data-text-index="-1"
                            style={{ fontFamily: 'S-CoreDream-5Medium', fontSize: '8pt', ...getTextStyle(page.content.textStyles, -1) }}
                        >
                            {page.content.title || 'AI ARCHITECTURE HUB 2026'}
                        </div>
                    </div>
                    <div className="flex flex-col items-center justify-center text-center shrink-0" style={{ height: '35mm', borderBottom: TB_BORDER_THICK, padding: '0 2mm' }}>
                        <div style={{ fontFamily: 'S-CoreDream-8Heavy', fontSize: '20pt', lineHeight: 1, letterSpacing: '-1.5px', marginBottom: '2mm' }}>CRE-TE</div>
                        <div style={{ fontSize: '5pt', fontWeight: 900, marginBottom: '2mm', textTransform: 'uppercase' }}>CREATIVE TEMPERATURE</div>
                        <div style={{ fontSize: '4pt', lineHeight: 1.4, color: '#333' }}>24-1, NONHYUN-RO 123GIL,<br />GANGNAM-GU, SEOUL, KOREA<br />WWW.CRE-TE.COM</div>
                    </div>
                    <div className="flex flex-col" style={{ flex: 1, borderBottom: TB_BORDER_THICK, padding: '2mm 3mm' }}>
                        <div style={{ fontFamily: 'S-CoreDream-8Heavy', fontSize: '5.5pt', color: '#000', textTransform: 'uppercase', marginBottom: '1mm' }}>NOTE</div>
                        <div
                            onMouseUp={() => onTextSelection?.(page.id, 0)}
                            onTouchEnd={() => onTextSelection?.(page.id, 0)}
                            onContextMenu={(e) => e.preventDefault()}
                            data-text-index="0"
                            style={{ fontFamily: 'S-CoreDream-5Medium', fontSize: '6pt', lineHeight: 1.5, color: '#000', ...getTextStyle(page.content.textStyles, 0) }}
                        >
                            {page.content.text[0] || '1. ALL DIMENSIONS ARE IN MM.\n2. DO NOT SCALE DRAWINGS.'}
                        </div>
                    </div>
                    {metaRows.map((item, i) => {
                        const isLast = i === metaRows.length - 1;
                        const isDrawingNo = item.label === 'DRAWING NO.';
                        const borderStyle = isLast ? TB_BORDER_THICK : TB_BORDER_THIN;
                        const textIdx = i + 1; // 1 to 7
                        return (
                            <div key={i} className="flex flex-col shrink-0" style={{ borderBottom: borderStyle, padding: '1.5mm 3mm' }}>
                                <div style={{ fontFamily: 'S-CoreDream-8Heavy', fontSize: '5pt', color: '#000', textTransform: 'uppercase' }}>{item.label}</div>
                                <div
                                    onMouseUp={() => onTextSelection?.(page.id, textIdx)}
                                    onTouchEnd={() => onTextSelection?.(page.id, textIdx)}
                                    onContextMenu={(e) => e.preventDefault()}
                                    data-text-index={textIdx}
                                    style={{
                                        fontFamily: isDrawingNo ? 'S-CoreDream-8Heavy' : 'S-CoreDream-5Medium',
                                        fontSize: isDrawingNo ? '14pt' : '7.5pt',
                                        color: '#000',
                                        outline: 'none',
                                        ...getTextStyle(page.content.textStyles, textIdx)
                                    }}
                                >
                                    {item.value}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}