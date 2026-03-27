// src/components/templates/TemplatePanel.tsx
import React, { useRef } from 'react';
import { PageData, Orientation } from '../../types';
import { getTextStyle, DraggableImage } from './Shared';
import { useAutoFitText } from '../../hooks/useAutoFitText';

export function TemplatePanel({ page, orientation, onTextMouseUp }: { page: PageData, orientation: Orientation, onTextMouseUp?: (pageId: string, idx: number) => void }) {
    const images = page.content.images || [];
    const tags = page.content.imageTags || [];
    const titles = page.content.imageTitles || [];
    const heroImg = images[0] ? { src: images[0], tag: tags[0], title: titles[0] } : null;
    const subImgs = images.slice(1).map((src, i) => ({ src, tag: tags[i + 1], title: titles[i + 1] }));

    const textDeps = [page.content.text, page.id];

    if (orientation === 'landscape') {
        return (
            <div className="w-full h-full bg-white relative font-['S-Core_Dream'] text-justify"
                style={{
                    display: 'grid', padding: '20mm 25mm', gap: '10mm',
                    gridTemplateColumns: '373mm 373mm 181.5mm 181.5mm',
                    gridTemplateRows: '75mm 60mm 115mm 25mm 195mm 281mm'
                }}>
                <div className="bg-gray-100 relative group overflow-hidden" style={{ gridColumn: '1 / 3', gridRow: '1 / 6' }}>
                    {heroImg && <DraggableImage pageId={page.id} imageIndex={0} src={heroImg.src} />}
                    {page.content.reasoning && (
                        <div className="absolute top-[8mm] left-[8mm] bg-white/95 px-[6mm] py-[4mm] font-medium text-gray-800 shadow-xl border-l-[4px] border-black opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontSize: '19pt' }}>{page.content.reasoning}</div>
                    )}
                </div>

                <div className="text-cell overflow-hidden flex flex-col" style={{ gridColumn: '3 / 5', gridRow: '1' }}>
                    <div
                        onMouseUp={() => onTextMouseUp?.(page.id, -1)}
                        data-text-index="-1"
                        className="font-black text-black leading-[1.0] tracking-[-4px] whitespace-nowrap"
                        style={{ fontSize: '140pt', alignSelf: 'start', ...getTextStyle(page.content.textStyles, -1) }}
                    >
                        {page.content.title}
                    </div>
                </div>
                <div className="text-cell overflow-hidden flex flex-col" style={{ gridColumn: '3 / 5', gridRow: '2' }}>
                    <div
                        onMouseUp={() => onTextMouseUp?.(page.id, 0)}
                        data-text-index="0"
                        className="font-medium text-gray-500 leading-[1.1]"
                        style={{ fontSize: '90pt', alignSelf: 'start', wordBreak: 'keep-all', whiteSpace: 'pre-wrap', ...getTextStyle(page.content.textStyles, 0) }}
                    >
                        {page.content.text[0] || 'Subtitle'}
                    </div>
                </div>

                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, 1)}
                    data-text-index="1"
                    className="font-extralight text-gray-700 leading-[1.6] overflow-hidden"
                    style={{ gridColumn: '3 / 5', gridRow: '3', fontSize: '22pt', alignSelf: 'stretch', ...getTextStyle(page.content.textStyles, 1) }}
                >
                    {page.content.text[1]}
                </div>

                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, 2)}
                    data-text-index="2"
                    className="font-medium text-black"
                    style={{ gridColumn: '3 / 4', gridRow: '4', fontSize: '42pt', alignSelf: 'start', ...getTextStyle(page.content.textStyles, 2) }}
                >
                    {page.content.text[2] || '소제목 A'}
                </div>
                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, 4)}
                    data-text-index="4"
                    className="font-medium text-black"
                    style={{ gridColumn: '4 / 5', gridRow: '4', fontSize: '42pt', alignSelf: 'start', ...getTextStyle(page.content.textStyles, 4) }}
                >
                    {page.content.text[4] || '소제목 B'}
                </div>

                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, 3)}
                    data-text-index="3"
                    className="font-extralight text-gray-600 leading-[1.6] overflow-hidden"
                    style={{ gridColumn: '3 / 4', gridRow: '5', fontSize: '22pt', alignSelf: 'stretch', ...getTextStyle(page.content.textStyles, 3) }}
                >
                    {page.content.text[3]}
                </div>
                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, 5)}
                    data-text-index="5"
                    className="font-extralight text-gray-600 leading-[1.6] overflow-hidden"
                    style={{ gridColumn: '4 / 5', gridRow: '5', fontSize: '22pt', alignSelf: 'stretch', ...getTextStyle(page.content.textStyles, 5) }}
                >
                    {page.content.text[5]}
                </div>

                <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '3', gridRow: '6' }}>{subImgs[0] && <DraggableImage pageId={page.id} imageIndex={1} src={subImgs[0].src} />}</div>
                <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '4', gridRow: '6' }}>{subImgs[1] && <DraggableImage pageId={page.id} imageIndex={2} src={subImgs[1].src} />}</div>
                <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '1', gridRow: '6' }}>{subImgs[2] && <DraggableImage pageId={page.id} imageIndex={3} src={subImgs[2].src} />}</div>
                <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '2', gridRow: '6' }}>{subImgs[3] && <DraggableImage pageId={page.id} imageIndex={4} src={subImgs[3].src} />}</div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-white relative font-['S-Core_Dream'] text-justify"
            style={{
                display: 'grid', padding: '25mm 20mm', gap: '10mm',
                gridTemplateColumns: 'repeat(4, 192.5mm)',
                gridTemplateRows: '75mm 45mm 74mm 25mm 115mm 25mm 115mm 190mm 395mm'
            }}>
            <div className="text-cell overflow-hidden flex flex-col" style={{ gridColumn: '1 / 5', gridRow: '1' }}>
                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, -1)}
                    data-text-index="-1"
                    className="font-black text-black leading-[1.0] tracking-[-4px] whitespace-nowrap"
                    style={{ fontSize: '140pt', alignSelf: 'start', ...getTextStyle(page.content.textStyles, -1) }}
                >
                    {page.content.title}
                </div>
            </div>
            <div className="text-cell overflow-hidden flex flex-col" style={{ gridColumn: '1 / 5', gridRow: '2' }}>
                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, 0)}
                    data-text-index="0"
                    className="font-medium text-gray-500 leading-[1.1]"
                    style={{ fontSize: '90pt', alignSelf: 'start', ...getTextStyle(page.content.textStyles, 0) }}
                >
                    {page.content.text[0] || 'Subtitle'}
                </div>
            </div>

            {/* text[1]: 메인 설명 — 22pt 강제 고정 */}
            <div className="overflow-hidden" style={{ gridColumn: '1 / 5', gridRow: '3' }}>
                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, 1)}
                    data-text-index="1"
                    className="font-extralight text-gray-700 leading-[1.6]"
                    style={{ fontSize: '22pt', wordBreak: 'keep-all', overflowWrap: 'break-word', ...getTextStyle(page.content.textStyles, 1) }}
                >
                    {page.content.text[1]}
                </div>
            </div>

            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '1 / 4', gridRow: '4 / 8' }}>{heroImg && <DraggableImage pageId={page.id} imageIndex={0} src={heroImg.src} />}</div>

            <div
                onMouseUp={() => onTextMouseUp?.(page.id, 2)}
                data-text-index="2"
                className="font-medium text-black"
                style={{ gridColumn: '4', gridRow: '4', fontSize: '42pt', alignSelf: 'start', ...getTextStyle(page.content.textStyles, 2) }}
            >
                {page.content.text[2] || '소제목 A'}
            </div>

            {/* text[3]: 섹션 A 상세설명 — 22pt 강제 고정 */}
            <div className="overflow-hidden" style={{ gridColumn: '4', gridRow: '5' }}>
                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, 3)}
                    data-text-index="3"
                    className="font-extralight text-gray-600 leading-[1.6]"
                    style={{ fontSize: '22pt', wordBreak: 'keep-all', overflowWrap: 'break-word', ...getTextStyle(page.content.textStyles, 3) }}
                >
                    {page.content.text[3]}
                </div>
            </div>

            <div
                onMouseUp={() => onTextMouseUp?.(page.id, 4)}
                data-text-index="4"
                className="font-medium text-black"
                style={{ gridColumn: '4', gridRow: '6', fontSize: '42pt', alignSelf: 'start', ...getTextStyle(page.content.textStyles, 4) }}
            >
                {page.content.text[4] || '소제목 B'}
            </div>

            {/* text[5]: 섹션 B 상세설명 — 22pt 강제 고정 */}
            <div className="overflow-hidden" style={{ gridColumn: '4', gridRow: '7' }}>
                <div
                    onMouseUp={() => onTextMouseUp?.(page.id, 5)}
                    data-text-index="5"
                    className="font-extralight text-gray-600 leading-[1.6]"
                    style={{ fontSize: '22pt', wordBreak: 'keep-all', overflowWrap: 'break-word', ...getTextStyle(page.content.textStyles, 5) }}
                >
                    {page.content.text[5]}
                </div>
            </div>

            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '1', gridRow: '8' }}>{subImgs[0] && <DraggableImage pageId={page.id} imageIndex={1} src={subImgs[0].src} />}</div>
            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '2', gridRow: '8' }}>{subImgs[1] && <DraggableImage pageId={page.id} imageIndex={2} src={subImgs[1].src} />}</div>
            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '3', gridRow: '8' }}>{subImgs[2] && <DraggableImage pageId={page.id} imageIndex={3} src={subImgs[2].src} />}</div>
            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '4', gridRow: '8' }}>{subImgs[3] && <DraggableImage pageId={page.id} imageIndex={4} src={subImgs[3].src} />}</div>

            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '1 / 3', gridRow: '9' }}>{subImgs[4] && <DraggableImage pageId={page.id} imageIndex={5} src={subImgs[4].src} />}</div>
            <div className="bg-gray-100 overflow-hidden" style={{ gridColumn: '3 / 5', gridRow: '9' }}>{subImgs[5] && <DraggableImage pageId={page.id} imageIndex={6} src={subImgs[5].src} />}</div>
        </div>
    );
}