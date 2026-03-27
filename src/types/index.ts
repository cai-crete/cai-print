// src/types/index.ts

export type Purpose = 'report' | 'drawing' | 'panel' | 'video' | 'image';
export type Orientation = 'landscape' | 'portrait';

export interface PageData {
    id: string;
    type: 'cover' | 'toc' | 'bodyA' | 'bodyB' | 'bodyC' | 'panel' | 'drawing' | 'video' | 'image';
    content: {
        title: string;
        text: string[];
        images: string[];
        imageDimensions?: { width: number, height: number }[];
        imageTags?: string[];
        imageTitles?: string[];
        textStyles?: {
            fontSize?: number;
            fontFamily?: string;
            fontWeight?: string;
            color?: string;
        }[];
        reasoning?: string;
    };
}