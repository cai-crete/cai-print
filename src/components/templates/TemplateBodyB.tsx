// src/components/templates/TemplateBodyB.tsx
import React from 'react';
import { PageData, Purpose } from '../../types';
import { getTextStyle, ReportFooter, DraggableImage, ReportHeader, ReportSubHeader } from './Shared';

export function TemplateBodyB({ page, pageIndex, purpose, onTextSelection, tocLabel }: { page: PageData, pageIndex: number, purpose: Purpose, onTextSelection?: (pageId: string, idx: number) => void, tocLabel?: string }) {
    const images = page.content.images || [];
    const text = page.content.text || [];
    const title = page.content.title;

    return (
        <div className="w-full h-full relative bg-white p-[15mm] flex flex-col box-border font-['Pretendard'] overflow-hidden">
            {/* 1. 공통 헤더 (읽기 전용, CRE-TE 고정) */}
            <ReportHeader
                title={title}
                textStyles={page.content.textStyles}
            />

            {/* 2. 공통 서브헤더 (읽기 전용) */}
            <ReportSubHeader
                subTitle={text[0] || ""}
                indexLabel={tocLabel || ""}
                textStyles={page.content.textStyles}
                subTitleIdx={0}
            />

            {/* 3. 페이지 요약 영역 — text[1] */}
            <div
                className="page-desc-area font-medium border-b border-gray-100 flex items-center"
                style={{ marginBottom: '10mm', fontSize: '11pt', height: '48px', lineHeight: '1.5', ...getTextStyle(page.content.textStyles, 1) }}
            >
                {text[1] || ""}
            </div>

            {/* 4. 본문 콘텐츠 영역 (2개 이미지. 각 이미지 하단에 이미지 스토리) */}
            {/* text[2] = 이미지1 스토리, text[3] = 이미지2 스토리 */}
            <div className="flex gap-[10mm] flex-1 overflow-hidden">
                {[0, 1].map((idx) => (
                    <div key={idx} className="flex flex-col flex-1 h-full">
                        <div className="img-box bg-gray-50 border border-gray-200 flex-1 overflow-hidden">
                            {images[idx] && <DraggableImage pageId={page.id} imageIndex={idx} src={images[idx]} objectFit="contain" />}
                        </div>
                        <div
                            className="desc-vertical leading-relaxed mt-[5mm]"
                            style={{ height: '3.2em', fontSize: '11pt', ...getTextStyle(page.content.textStyles, idx + 2) }}
                        >
                            {text[idx + 2] || ""}
                        </div>
                    </div>
                ))}
            </div>

            <ReportFooter />
        </div>
    );
}