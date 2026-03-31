// src/components/templates/TemplateBodyA.tsx
import React from 'react';
import { PageData, Purpose } from '../../types';
import { getTextStyle, ReportFooter, DraggableImage, ReportHeader, ReportSubHeader } from './Shared';

export function TemplateBodyA({ page, pageIndex, purpose, onTextSelection, tocLabel }: { page: PageData, pageIndex: number, purpose: Purpose, onTextSelection?: (pageId: string, idx: number) => void, tocLabel?: string }) {
    const images = page.content.images || [];
    const text = page.content.text || [];
    const title = page.content.title;

    return (
        <div className="w-full h-full relative bg-white p-[15mm] flex flex-col box-border font-['Pretendard'] overflow-hidden">
            {/* 1. 공통 헤더 */}
            <ReportHeader 
                title={title} 
                companyName="CRE-TE" 
                pageId={page.id} 
                onTextSelection={onTextSelection} 
                textStyles={page.content.textStyles}
            />

            {/* 2. 공통 서브헤더 */}
            <ReportSubHeader 
                subTitle={text[0] || ""} 
                indexLabel={tocLabel || ""} 
                pageId={page.id} 
                onTextSelection={onTextSelection} 
                textStyles={page.content.textStyles}
                subTitleIdx={0}
            />

            {/* 3. 페이지 요약 영역 */}
            <div
                onMouseUp={() => onTextSelection?.(page.id, 1)}
                onTouchEnd={() => onTextSelection?.(page.id, 1)}
                onContextMenu={(e) => e.preventDefault()}
                data-text-index="1"
                className="editable page-desc-area font-medium border-b border-gray-100 flex items-center"
                style={{ marginBottom: '10mm', fontSize: '11pt', height: '48px', lineHeight: '1.5', ...getTextStyle(page.content.textStyles, 1) }}
            >
                {text[1] || ""}
            </div>

            {/* 4. 본문 콘텐츠 영역 (1개 이미지 + 세로형 설명) */}
            <div className="flex gap-[10mm] flex-1 overflow-hidden">
                <div className="flex flex-col flex-1 h-full">
                    <div className="img-box bg-gray-50 border border-gray-200 flex-1 overflow-hidden">
                        {images[0] && <DraggableImage pageId={page.id} imageIndex={0} src={images[0]} objectFit="contain" />}
                    </div>
                    <div
                        onMouseUp={() => onTextSelection?.(page.id, 2)}
                        onTouchEnd={() => onTextSelection?.(page.id, 2)}
                        onContextMenu={(e) => e.preventDefault()}
                        data-text-index="2"
                        className="editable desc-vertical leading-relaxed mt-[5mm]"
                        style={{ height: '3.2em', fontSize: '11pt', ...getTextStyle(page.content.textStyles, 2) }}
                    >
                        {text[2] || ""}
                    </div>
                </div>
            </div>

            <ReportFooter />
        </div>
    );
}