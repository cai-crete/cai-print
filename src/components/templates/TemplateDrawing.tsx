// src/components/templates/TemplateDrawing.tsx
import React from 'react';
import { PageData } from '../../types';
import { DraggableImage } from './Shared';

export function TemplateDrawing({ page, onTextSelection, tocLabel: _tocLabel }: { page: PageData, onTextSelection?: (pageId: string, idx: number) => void, tocLabel?: string }) {
    const TB_BORDER_THICK = '1.5pt solid #000';
    const TB_BORDER_THIN = '0.5pt solid #000';

    const text = page.content.text || [];

    // 도각(Title Block) 슬롯 정의 — text[1]~text[7]:
    // text[1]: DESIGNED BY, text[2]: ENGINEER, text[3]: APPROVED BY
    // text[4]: SCALE, text[5]: DRAWING NO., text[6]: SHEET NO., text[7]: FILE NAME
    const metaRows = [
        { label: 'DESIGNED BY',         value: text[1] || 'CRE-TE',      isLarge: false },
        { label: 'ARCHITECTURAL ENGINEER', value: text[2] || 'K.H. KIM', isLarge: false },
        { label: 'APPROVED BY',          value: text[3] || 'CRE-TE GROUP', isLarge: false },
        { label: 'SCALE',                value: text[4] || 'N.T.S',       isLarge: false },
        { label: 'DRAWING NO.',          value: text[5] || 'A-101',        isLarge: true  },
        { label: 'SHEET NO.',            value: text[6] || '01 / 01',      isLarge: false },
        { label: 'FILE NAME',            value: text[7] || '-',            isLarge: false },
    ];

    return (
        <div className="w-full h-full bg-white font-['S-Core_Dream']" style={{ padding: '7mm' }}>
            <div className="w-full h-full flex" style={{ border: TB_BORDER_THICK, boxSizing: 'border-box' }}>
                {/* 도면 영역 (좌측) */}
                <div className="flex-1 relative flex items-center justify-center overflow-hidden" style={{ borderRight: TB_BORDER_THICK }}>
                    {page.content.images[0] ? (
                        <DraggableImage pageId={page.id} imageIndex={0} src={page.content.images[0]} objectFit="contain" />
                    ) : (
                        <div className="text-gray-200 font-black text-4xl uppercase tracking-[0.5em] select-none text-center opacity-40">Drawing Area</div>
                    )}
                </div>

                {/* 도각 영역 (우측) */}
                <div className="flex flex-col shrink-0" style={{ width: '40mm', background: '#fff' }}>
                    {/* PROJECT TITLE — text[-1] / page.content.title (5~16자 영문 대문자) */}
                    <div className="flex flex-col shrink-0" style={{ height: '12mm', borderBottom: TB_BORDER_THICK, padding: '2mm 3mm' }}>
                        <div style={{ fontFamily: 'S-CoreDream-8Heavy', fontSize: '5.5pt', color: '#000', textTransform: 'uppercase', marginBottom: '1mm' }}>PROJECT TITLE</div>
                        <div style={{ fontFamily: 'S-CoreDream-5Medium', fontSize: '8pt', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {page.content.title || 'PROJECT TITLE'}
                        </div>
                    </div>

                    {/* CRE-TE 로고 섹션 (고정, 수정 불가) */}
                    <div className="flex flex-col items-center justify-center text-center shrink-0" style={{ height: '35mm', borderBottom: TB_BORDER_THICK, padding: '0 2mm' }}>
                        <div style={{ fontFamily: 'S-CoreDream-8Heavy', fontSize: '20pt', lineHeight: 1, letterSpacing: '-1.5px', marginBottom: '2mm' }}>
                            CRE-TE
                        </div>
                        <div style={{ fontSize: '5pt', fontWeight: 900, marginBottom: '2mm', textTransform: 'uppercase' }}>CREATIVE TEMPERATURE</div>
                        <div style={{ fontSize: '4pt', lineHeight: 1.4, color: '#333' }}>24-1, NONHYUN-RO 123GIL,<br />GANGNAM-GU, SEOUL, KOREA<br />WWW.CRE-TE.COM</div>
                    </div>

                    {/* NOTE 섹션 — text[0] */}
                    <div className="flex flex-col" style={{ flex: 1, borderBottom: TB_BORDER_THICK, padding: '2mm 3mm' }}>
                        <div style={{ fontFamily: 'S-CoreDream-8Heavy', fontSize: '5.5pt', color: '#000', textTransform: 'uppercase', marginBottom: '1mm' }}>NOTE</div>
                        <div style={{ fontFamily: 'S-CoreDream-5Medium', fontSize: '6pt', lineHeight: 1.5, color: '#000', whiteSpace: 'pre-line' }}>
                            {text[0] || '1. ALL DIMENSIONS ARE IN MM.\n2. DO NOT SCALE DRAWINGS.'}
                        </div>
                    </div>

                    {/* 메타데이터 행 — text[1]~text[7] */}
                    {metaRows.map((item, i) => {
                        const isLast = i === metaRows.length - 1;
                        const borderStyle = isLast ? TB_BORDER_THICK : TB_BORDER_THIN;
                        return (
                            <div key={i} className="flex flex-col shrink-0" style={{ borderBottom: borderStyle, padding: '1.5mm 3mm' }}>
                                <div style={{ fontFamily: 'S-CoreDream-8Heavy', fontSize: '5pt', color: '#000', textTransform: 'uppercase' }}>{item.label}</div>
                                <div style={{
                                    fontFamily: item.isLarge ? 'S-CoreDream-8Heavy' : 'S-CoreDream-5Medium',
                                    fontSize: item.isLarge ? '14pt' : '7.5pt',
                                    color: '#000',
                                    outline: 'none',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                }}>
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