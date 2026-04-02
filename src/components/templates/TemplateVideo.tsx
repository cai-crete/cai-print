// src/components/templates/TemplateVideo.tsx
import React from 'react';
import { PageData } from '../../types';

export function TemplateVideo({ page }: { page: PageData, onTextSelection?: (pageId: string, idx: number) => void }) {
    const videoSrc = page.content.images?.[0] || '/image library/V/video-example-1.mp4';

    return (
        <div className="w-full h-full bg-black relative flex items-center justify-center overflow-hidden">
            {/* video-example.mp4 를 직접 미리보기 */}
            <video
                key={videoSrc}
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                controls
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                }}
            />
        </div>
    );
}