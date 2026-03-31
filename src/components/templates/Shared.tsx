// src/components/templates/Shared.tsx
import React from 'react';

// 텍스트 스타일을 가져오는 공통 함수
export const getTextStyle = (styles: any[] | undefined, index: number) => {
    if (!styles || !styles[index + 1]) return {};
    const s = styles[index + 1];
    const result: any = {};
    if (s.fontSize) result.fontSize = `${s.fontSize}pt`;
    if (s.fontFamily) result.fontFamily = s.fontFamily;
    if (s.fontWeight) result.fontWeight = s.fontWeight;
    if (s.color) result.color = s.color;
    return result;
};

// 보고서 상단 헤더 (Main Title + Company Name)
export const ReportHeader = ({ title, companyName = "CRE-TE", onTextSelection, pageId, textStyles }: { title: string, companyName?: string, onTextSelection?: (pageId: string, idx: number) => void, pageId: string, textStyles?: any[] }) => (
    <div className="inner-header flex justify-between items-start" style={{ marginBottom: '5mm' }}>
        <div 
            onMouseUp={() => onTextSelection?.(pageId, -1)}
            onTouchEnd={() => onTextSelection?.(pageId, -1)}
            onContextMenu={(e) => e.preventDefault()}
            data-text-index="-1"
            className="editable main-title font-black"
            style={{ fontSize: '24pt', fontWeight: 800, width: '300mm', maxHeight: '35mm', wordBreak: 'keep-all', overflow: 'hidden', ...getTextStyle(textStyles, -1) }}
        >
            {title}
        </div>
        <div className="editable comp-name font-bold text-right" style={{ fontSize: '14pt', fontWeight: 700, minWidth: '60mm', padding: '2px 5px' }}>
            {companyName}
        </div>
    </div>
);

// 보고서 서브 헤더 (Sub Title + Index Indicator)
export const ReportSubHeader = ({ subTitle, indexLabel, onTextSelection, pageId, textStyles, subTitleIdx }: { subTitle: string, indexLabel: string, onTextSelection?: (pageId: string, idx: number) => void, pageId: string, textStyles?: any[], subTitleIdx: number }) => (
    <div className="inner-sub-header flex justify-between items-start" style={{ marginBottom: '5mm' }}>
        <div 
            onMouseUp={() => onTextSelection?.(pageId, subTitleIdx)}
            onTouchEnd={() => onTextSelection?.(pageId, subTitleIdx)}
            onContextMenu={(e) => e.preventDefault()}
            data-text-index={subTitleIdx}
            className="editable sub-title-box font-semibold"
            style={{ fontSize: '16pt', flex: 1, minHeight: '30px', wordBreak: 'keep-all', ...getTextStyle(textStyles, subTitleIdx) }}
        >
            {subTitle}
        </div>
        <div className="editable index-indicator text-right font-medium" style={{ width: '150mm', fontSize: '12pt' }}>
            {indexLabel}
        </div>
    </div>
);

// 보고서 하단 꼬리말(Footer) 공통 컴포넌트
export const ReportFooter = ({ isCover = false }: { isCover?: boolean }) => (
    <div style={{ position: 'absolute', bottom: '15mm', left: '15mm', right: '15mm', pointerEvents: 'none', userSelect: 'none', height: '20mm' }}>
        {/* 모든 푸터 요소 삭제 (여백 유지) */}
    </div>
);

// 드래그 앤 드롭이 가능한 이미지 컴포넌트
export const DraggableImage = ({ 
    src, 
    pageId, 
    imageIndex, 
    className = "", 
    alt = "",
    objectFit = "cover" as "cover" | "contain"
}: { 
    src: string, 
    pageId: string, 
    imageIndex: number, 
    className?: string, 
    alt?: string,
    objectFit?: "cover" | "contain"
}) => {
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);

    const handleDragStart = (e: React.DragEvent) => {
        setIsDragging(true);
        const data = {
            source: 'preview',
            pageId,
            imageIndex,
            src
        };
        e.dataTransfer.setData('text/plain', JSON.stringify(data));
        e.dataTransfer.effectAllowed = 'move';

        // 전역 상태 연결을 위한 이벤트 전송
        window.dispatchEvent(new CustomEvent('app-dragging-start', { detail: { src } }));
    };

    const handleDragEnd = () => {
        setIsDragging(false);
        window.dispatchEvent(new CustomEvent('app-dragging-end'));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        // library에서 copy, preview에서 move 모두 허용
        e.dataTransfer.dropEffect = e.dataTransfer.effectAllowed === 'copy' ? 'copy' : 'move';
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        let rawData = e.dataTransfer.getData('text/plain');
        if (!rawData) {
            rawData = e.dataTransfer.getData('application/json');
        }
        if (!rawData) return;

        try {
            const dragSource = JSON.parse(rawData);
            // 커스텀 이벤트 발생 시켜 App.tsx에서 처리하도록 함
            const event = new CustomEvent('app-image-drop', {
                detail: {
                    source: dragSource,
                    target: { pageId, imageIndex }
                }
            });
            window.dispatchEvent(event);
        } catch (err) {
            console.error("Drop data parsing failed", err);
        }
    };

    return (
        <div 
            className={`w-full h-full relative group transition-all duration-200 ${isDragOver ? 'ring-4 ring-blue-400 ring-inset bg-blue-50/30 shadow-inner' : ''} ${className}`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <img 
                src={src} 
                alt={alt} 
                className={`w-full h-full cursor-move transition-all pointer-events-none ${objectFit === 'cover' ? 'object-cover' : 'object-contain'} ${isDragging ? 'opacity-40 scale-95 grayscale' : ''}`} 
                crossOrigin="anonymous" 
            />
            {/* 드래그 중인 이미지 표시 (피드백) */}
            {isDragging && (
                <div className="absolute inset-0 border-4 border-blue-500 rounded-lg pointer-events-none animate-pulse" />
            )}
            {/* 호버 시 나타나는 시각적 가이드 (옵션) */}
            {isDragOver && (
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-blue-500 flex items-center justify-center bg-blue-400/10">
                <span className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest shadow-lg">Drop here</span>
              </div>
            )}
        </div>
    );
};