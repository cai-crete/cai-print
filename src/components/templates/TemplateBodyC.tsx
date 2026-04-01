// src/components/templates/TemplateBodyC.tsx
import React from 'react';
import { PageData, Purpose } from '../../types';
import { getTextStyle, ReportFooter, DraggableImage, ReportHeader, ReportSubHeader, getImageObjectFit } from './Shared';

export function TemplateBodyC({ page, pageIndex, purpose, onTextSelection, tocLabel }: { page: PageData, pageIndex: number, purpose: Purpose, onTextSelection?: (pageId: string, idx: number) => void, tocLabel?: string }) {
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

            {/* 4. 본문 콘텐츠 영역 (혼합형: 좌측 세로 / 우측 가로 2단) */}
            {/* text[2] = 이미지1 스토리, text[4] = 이미지2 스토리, text[3] = "CRE-TE" (회사명 슬롯, 렌더링 생략) */}
            <div className="flex gap-[10mm] flex-1 overflow-hidden">
                {/* 좌측: 세로형 레이아웃 — 이미지0 + 이미지 스토리 text[2] */}
                <div className="flex flex-col flex-1 h-full">
                    <div className="img-box bg-gray-50 border border-gray-200 flex-1 overflow-hidden">
                        {images[0] && <DraggableImage pageId={page.id} imageIndex={0} src={images[0]} objectFit={getImageObjectFit(images[0])} />}
                    </div>
                    <div
                        className="desc-vertical leading-relaxed mt-[5mm]"
                        style={{ height: '3.2em', fontSize: '11pt', ...getTextStyle(page.content.textStyles, 2) }}
                    >
                        {text[2] || ""}
                    </div>
                </div>

                {/* 우측: 가로형 2단 레이아웃 — 이미지1,2 + 이미지 스토리 text[4] */}
                <div className="flex flex-col flex-1 gap-[10mm] h-full">
                    {[1, 2].map((imgIdx, loopIdx) => (
                        <div key={imgIdx} className="flex flex-1 gap-[10mm] overflow-hidden">
                            <div className="img-box bg-gray-50 border border-gray-200 flex-[1.36] overflow-hidden">
                                {images[imgIdx] && <DraggableImage pageId={page.id} imageIndex={imgIdx} src={images[imgIdx]} objectFit={getImageObjectFit(images[imgIdx])} />}
                            </div>
                            <div
                                className="desc-horizontal leading-relaxed flex-[0.64] h-full flex items-center border-b border-gray-200"
                                style={{ padding: '0 5mm', fontSize: '11pt', ...getTextStyle(page.content.textStyles, loopIdx === 0 ? 4 : 5) }}
                            >
                                {/* loopIdx 0 -> text[4], loopIdx 1 -> text[5] (text[3]은 로고용으로 보호) */}
                                {text[loopIdx === 0 ? 4 : 5] || ""}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <ReportFooter />
        </div>
    );
}