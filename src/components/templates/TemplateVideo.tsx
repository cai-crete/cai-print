// src/components/templates/TemplateVideo.tsx
import React from 'react';
import { PageData } from '../../types';
import { getTextStyle, DraggableImage } from './Shared';

export function TemplateVideo({ page, onTextMouseUp }: { page: PageData, onTextMouseUp?: (pageId: string, idx: number) => void }) {
    return (
        <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden">
            {page.content.images[0] && (
                <DraggableImage
                    pageId={page.id}
                    imageIndex={0}
                    src={page.content.images[0]}
                    objectFit="cover"
                    className="opacity-60"
                />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-16 text-center">
                <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm mb-12 shadow-2xl border border-white/30">
                    <div className="w-0 h-0 border-t-[20px] border-t-transparent border-l-[32px] border-l-white border-b-[20px] border-b-transparent ml-3" />
                </div>
                <h1
                    onMouseUp={() => onTextMouseUp?.(page.id, -1)}
                    data-text-index="-1"
                    className="text-7xl font-black tracking-tighter mb-8 max-w-5xl line-clamp-2 overflow-hidden text-ellipsis drop-shadow-lg"
                    style={{ fontSize: undefined, ...getTextStyle(page.content.textStyles, -1) }}
                >
                    {page.content.title || ''}
                </h1>
                <p
                    onMouseUp={() => onTextMouseUp?.(page.id, 0)}
                    data-text-index="0"
                    className="text-3xl text-white/90 max-w-4xl leading-relaxed line-clamp-3 overflow-hidden text-ellipsis drop-shadow-md"
                    style={{ fontSize: undefined, ...getTextStyle(page.content.textStyles, 0) }}
                >
                    {page.content.text[0] || ''}
                </p>
            </div>
        </div>
    );
}