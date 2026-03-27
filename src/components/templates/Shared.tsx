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

// 보고서 하단 꼬리말(Footer) 공통 컴포넌트
export const ReportFooter = ({ isCover = false }: { isCover?: boolean }) => (
    <div style={{ position: 'absolute', top: '281mm', left: 0, right: 0, pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{ position: 'absolute', left: '13mm', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13pt', fontWeight: 900, letterSpacing: '-1px', color: '#000' }}>CRE-TE</span>
        </div>
        <div style={{ position: 'absolute', left: '287mm', width: '119mm', textAlign: 'right', lineHeight: 1.4 }}>
            <div style={{ fontSize: '10pt', color: '#999', textTransform: 'uppercase', letterSpacing: '0.5px' }}>COPYRIGHTS 2026. CRETE CO.,LTD. ALL RIGHTS RESERVED.</div>
        </div>
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