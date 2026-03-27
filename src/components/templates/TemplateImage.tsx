// src/components/templates/TemplateImage.tsx
import React from 'react';
import { PageData } from '../../types';
import { getTextStyle, DraggableImage } from './Shared';

export function TemplateImage({ page, onTextMouseUp }: { page: PageData, onTextMouseUp?: (pageId: string, idx: number) => void }) {
    return (
        <div className="w-full h-full bg-white relative overflow-hidden">
            {page.content.images[0] && (
                <DraggableImage
                    pageId={page.id}
                    imageIndex={0}
                    src={page.content.images[0]}
                    objectFit="cover"
                    className="w-full h-full"
                />
            )}
        </div>
    );
}