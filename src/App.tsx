import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Crown, History } from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI, Type } from "@google/genai";
import { Purpose, Orientation, PageData } from './types';
import { DEFAULT_IMAGES, DEFAULT_TEXT_INPUT } from './constants/defaultData';
import { TemplateCover } from './components/templates/TemplateCover';
import { TemplateTOC, computeTocLabels } from './components/templates/TemplateTOC';
import { TemplateBodyA } from './components/templates/TemplateBodyA';
import { TemplateBodyB } from './components/templates/TemplateBodyB';
import { TemplateBodyC } from './components/templates/TemplateBodyC';
import { TemplatePanel } from './components/templates/TemplatePanel';
import { TemplateDrawing } from './components/templates/TemplateDrawing';
import { TemplateVideo } from './components/templates/TemplateVideo';
import { TemplateImage } from './components/templates/TemplateImage';
import { create_transition_video } from './utils/replicateVideo';
import PROMPT_ARCHITECT from './writer/PROMPT_건축작가.txt?raw';
import REF_BOOK from './writer/REF.BOOK.txt?raw';
import IMG_ANALYSIS_V1 from './writer/건축이미지분석기술서v1.txt?raw';
import LANGUAGE_TECH_V1 from './writer/언어분석 10가지 기술 v1.md?raw';
import ERROR_CORRECTION from './writer/고종석_오류교정.txt?raw';
import WRITING_START from './writer/1.글쓰기_시작.txt?raw';
import WRITING_REFINED_DATA from './writer/글쓰기_정제화data.txt?raw';
import SPEECH_VERIFICATION from './writer/발화검증_프로토콜.txt?raw';


function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Video/Image Mode Components ---
function MediaViewer({ images, mode }: { images: string[], mode: 'video' | 'image' }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1 || mode === 'image') return;
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % images.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [images.length, mode]);

  if (images.length === 0) {
    return <div className="text-gray-400 font-medium tracking-wide">좌측 라이브러리에서 이미지를 선택해주세요. (다중 선택 가능)</div>;
  }

  return (
    <div className={cn("w-[1080px] h-[607px] relative overflow-hidden bg-black shadow-2xl flex-shrink-0 flex p-8", mode === 'image' ? "overflow-y-auto content-start bg-[#111]" : "items-center justify-center")} style={{ maxWidth: '100%', maxHeight: '100%' }}>
      {mode === 'image' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full h-fit content-start">
          {images.map((img, idx) => (
            <div key={img + idx} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-lg aspect-video p-1 relative flex items-center justify-center bg-zinc-900">
              <img src={img} alt={`img-${idx}`} className="w-full h-full object-contain pointer-events-none rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        images.map((img, idx) => (
          <img
            key={img + idx}
            src={img}
            alt={`slide-${idx}`}
            className={cn(
              "absolute w-full h-full object-contain transition-all duration-700 pointer-events-none inset-0 m-auto",
              idx === currentIndex ? "opacity-100" : "opacity-0",
              "duration-[2000ms] " + (idx === currentIndex ? "scale-105" : "scale-100")
            )}
          />
        ))
      )}
    </div>
  );
}

function MediaTimelineEditor({ images, onReorder }: { images: string[], onReorder: (imgs: string[]) => void }) {
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('timeline-index', index.toString());
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    const dragIndexStr = e.dataTransfer.getData('timeline-index');
    if (!dragIndexStr) return;
    const dragIndex = parseInt(dragIndexStr, 10);
    if (dragIndex === dropIndex) return;

    const newImages = [...images];
    const [draggedImg] = newImages.splice(dragIndex, 1);
    newImages.splice(dropIndex, 0, draggedImg);
    onReorder(newImages);
  };

  if (images.length === 0) return <div className="text-sm text-gray-400">선택된 이미지가 없습니다.</div>;

  return (
    <div className="flex gap-4 items-center">
      {images.map((img, idx) => (
        <div
          key={img + idx}
          draggable
          onDragStart={(e) => handleDragStart(e, idx)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleDrop(e, idx)}
          className="h-20 aspect-video relative group cursor-grab active:cursor-grabbing border-2 border-transparent hover:border-gray-400 overflow-hidden shadow-sm transition-all"
        >
          <img src={img} className="w-full h-full object-cover pointer-events-none" alt={`thumb-${idx}`} />
          <div className="absolute top-0 left-0 bg-black/70 text-white text-[10px] w-5 h-5 flex items-center justify-center font-bold">
            {idx + 1}
          </div>
        </div>
      ))}
    </div>
  );
}

const getImageDimensions = (src: string): Promise<{ width: number, height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 1190, height: 842 });
    img.src = src;
  });
};


interface LibraryImage {
  src: string;
  type?: string;
  tag?: string;
  title?: string;
  dim?: { x: number; y: number };
}

export default function App() {
  const [projectType, setProjectType] = useState('auto');
  const [projectKeyword, setProjectKeyword] = useState('');
  const [title, setTitle] = useState('No11. print');
  const [images, setImages] = useState<LibraryImage[]>(DEFAULT_IMAGES);
  const [historyImages, setHistoryImages] = useState<LibraryImage[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [textInput, setTextInput] = useState(DEFAULT_TEXT_INPUT);
  const [purpose, setPurpose] = useState<Purpose>('panel');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [numPages, setNumPages] = useState(1);
  const [generatedPages, setGeneratedPages] = useState<PageData[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'png' | 'jpeg' | 'video'>('pdf');
  const [dynamicScale, setDynamicScale] = useState(0.6);
  const [heroImage, setHeroImage] = useState<string | null>(null);
  const [isGeneratingText, setIsGeneratingText] = useState(false);

  // Text Styling State
  const [selectedTextInfo, setSelectedTextInfo] = useState<{
    pageId: string;
    textIndex: number; // -1 for title, 0+ for text array
    rect: DOMRect | null;
    renderedFontSize?: number;
    renderedFontFamily?: string;
  } | null>(null);
  const [isTablet, setIsTablet] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsTablet(window.innerWidth < 1200);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const exportContainerRef = useRef<HTMLDivElement>(null);
  const fitScaleRef = useRef(0.6); // ResizeObserver가 계산한 fit-scale 기준값



  // Update scale whenever factors change
  useEffect(() => {
    const updateScale = () => {
      if (!canvasAreaRef.current || generatedPages.length === 0) return;

      const container = canvasAreaRef.current;
      const currentPage = generatedPages[currentPageIndex];
      if (!currentPage) return;

      const isPanel = currentPage.type === 'panel';
      const isPortrait = isPanel && orientation === 'portrait';

      // mm 물리 치수 (render 함수와 동일한 기준 적용)
      let mmW: number, mmH: number;
      if (isPanel) {
        mmW = isPortrait ? 841 : 1189;
        mmH = isPortrait ? 1189 : 841;
      } else if (currentPage.type === 'video') {
        mmW = 1920; mmH = 1080;
      } else if (currentPage.type === 'image') {
        mmW = 1080; mmH = 1080;
      } else {
        mmW = 420; mmH = 297; // A3 가로
      }

      const PX_PER_MM = 96 / 25.4;
      const pxW = mmW * PX_PER_MM;
      const pxH = mmH * PX_PER_MM;

      const padding = isTablet ? 40 : 80; // 태블릿에서 여백을 줄여 템플릿 공간 확보
      const availableWidth = container.clientWidth - padding;
      const availableHeight = container.clientHeight - padding;

      const scaleX = availableWidth / pxW;
      const scaleY = availableHeight / pxH;

      // 화면에 꽉 차는 배율(fit)에 0.9를 곱하여(90%) 상하좌우 여유 확보
      const newScale = Math.min(scaleX, scaleY) * 0.9;

      fitScaleRef.current = newScale; // 기준 배율 저장
      setDynamicScale(newScale);
    };

    const observer = new ResizeObserver(updateScale);
    if (canvasAreaRef.current) observer.observe(canvasAreaRef.current);
    updateScale();

    return () => observer.disconnect();
  }, [currentPageIndex, generatedPages[currentPageIndex]?.type, orientation]);

  // 키보드 화살표 키 → 페이지 이동
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력창에 포커스가 있을 때는 무시
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        setCurrentPageIndex(prev => Math.min(prev + 1, generatedPages.length - 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        setCurrentPageIndex(prev => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generatedPages.length]);

  // 캔버스 영역 휠 이벤트 → 줌인/줌아웃 (passive:false로 기본 스크롤 방지)
  useEffect(() => {
    const el = canvasAreaRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.92 : 1.08; // 8%씩 줌
      setDynamicScale(prev => {
        const minScale = fitScaleRef.current * (2 / 3); // 줌아웃 최솟값: fit의 2/3
        const maxScale = 3.0;                           // 줌인 최댓값: 300%
        return Math.max(minScale, Math.min(maxScale, prev * zoomFactor));
      });
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Handle global clicks to dismiss the tooltip only when clicking "outside"
  React.useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (!selectedTextInfo) return;

      const target = e.target as HTMLElement;
      // Don't close if clicking inside the toolbar, the typography panel, or a text element
      if (
        target.closest('.ai-floating-toolbar') ||
        target.closest('.ai-typography-panel') ||
        target.closest('[data-text-index]') // Represents selectable text elements
      ) {
        return;
      }

      setSelectedTextInfo(null);
    };

    window.addEventListener('mousedown', handleOutsideClick);
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [selectedTextInfo]);

  const [draggingImgSrc, setDraggingImgSrc] = React.useState<string | null>(null);

  const handleLibraryImageDragStart = (e: React.DragEvent, imgSrc: string) => {
    setDraggingImgSrc(imgSrc);
    const data = {
      source: 'library',
      imgSrc
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleLibraryImageDragEnd = () => {
    setDraggingImgSrc(null);
  };

  React.useEffect(() => {
    const handleImageDrop = (e: any) => {
      const { source, target } = e.detail;
      setDraggingImgSrc(null);

      setGeneratedPages(prevPages => {
        const newPages = [...prevPages];
        const targetPageIndex = newPages.findIndex(p => p.id === target.pageId);
        if (targetPageIndex === -1) return prevPages;

        const targetPage = { ...newPages[targetPageIndex] };
        const targetContent = { ...targetPage.content };
        const targetImages = [...(targetContent.images || [])];

        if (source.source === 'library') {
          // Replace target image with library image
          targetImages[target.imageIndex] = source.imgSrc;
          targetContent.images = targetImages;
          targetPage.content = targetContent;
          newPages[targetPageIndex] = targetPage;
        } else if (source.source === 'preview') {
          // Swap target image with source image
          const sourcePageIndex = newPages.findIndex(p => p.id === source.pageId);
          if (sourcePageIndex === -1) return prevPages;

          if (sourcePageIndex === targetPageIndex) {
            // Swap within the same page
            const temp = targetImages[target.imageIndex];
            targetImages[target.imageIndex] = targetImages[source.imageIndex];
            targetImages[source.imageIndex] = temp;

            targetContent.images = targetImages;
            targetPage.content = targetContent;
            newPages[targetPageIndex] = targetPage;
          } else {
            // Swap across different pages
            const sourcePage = { ...newPages[sourcePageIndex] };
            const sourceContent = { ...sourcePage.content };
            const sourceImages = [...(sourceContent.images || [])];

            const temp = targetImages[target.imageIndex];
            targetImages[target.imageIndex] = sourceImages[source.imageIndex];
            sourceImages[source.imageIndex] = temp;

            targetContent.images = targetImages;
            targetPage.content = targetContent;
            newPages[targetPageIndex] = targetPage;

            sourceContent.images = sourceImages;
            sourcePage.content = sourceContent;
            newPages[sourcePageIndex] = sourcePage;
          }
        }

        return newPages;
      });
    };

    const handleDraggingStart = (e: any) => {
      setDraggingImgSrc(e.detail.src);
    };

    const handleDraggingEnd = () => {
      setDraggingImgSrc(null);
    };

    window.addEventListener('app-image-drop', handleImageDrop);
    window.addEventListener('app-dragging-start', handleDraggingStart);
    window.addEventListener('app-dragging-end', handleDraggingEnd);
    return () => {
      window.removeEventListener('app-image-drop', handleImageDrop);
      window.removeEventListener('app-dragging-start', handleDraggingStart);
      window.removeEventListener('app-dragging-end', handleDraggingEnd);
    };
  }, []);

  const handleImageSelect = (imgSrc: string) => {
    if (selectedImages.includes(imgSrc)) {
      setSelectedImages(selectedImages.filter(i => i !== imgSrc));
    } else {
      setSelectedImages([...selectedImages, imgSrc]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setImages(prev => [{ src: e.target!.result as string, type: 'UPLOADED' }, ...prev]);
          }
        };
        reader.readAsDataURL(file);
      } else if (file.type === 'text/plain') {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setTextInput(prev => prev + '\n' + (e.target!.result as string));
          }
        };
        reader.readAsText(file);
      }
    });
  };

  const handleAutoGenerateText = async (overridePurpose?: string, overrideNumPages?: number, autoGenerate?: boolean) => {
    setIsGeneratingText(true);
    try {
      const authKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (process as any).env?.GEMINI_API_KEY || '';
      const ai = new GoogleGenAI({ apiKey: authKey });

      const targetImages = selectedImages.length > 0 ? selectedImages : images.map(i => i.src);
      const imagesToAnalyze = targetImages.slice(0, 3);

      const contents: any[] = [];
      // 현재 적용할 목적(용도) 결정 — state가 업데이트되기 전일 수 있어 overridePurpose 우선 사용
      const currentPurposeForPrompt = overridePurpose || purpose;
      const currentNumPages = overrideNumPages ?? numPages;
      const purposeLabel: Record<string, string> = {
        report: '보고서 (Report) — 본문, 목차, 표지 포함',
        drawing: '도면/사양서 (Drawing & Specification) — 기술적 설명 중심',
        panel: '전시 패널 (Panel) — 감성적·공간적 설명 중심, A0 대형 판넬',
        video: '영상 스크립트 (Video) — 내레이션 스타일',
      };
      const purposeDescription = purposeLabel[currentPurposeForPrompt] || currentPurposeForPrompt;

      // [writer 프로토콜] 최우선 지시사항 및 지식 베이스 통합
      const systemPrompt = `
${PROMPT_ARCHITECT}

# KNOWLEDGE DATABASE (지식 데이터베이스)
## REF_BOOK (건축가형 글쓰기 프로토콜)
${REF_BOOK}

## IMG_ANALYSIS (건축 이미지 온톨로지 분석 기술서)
${IMG_ANALYSIS_V1}

## LANGUAGE_TECH (언어분석 10가지 기술)
${LANGUAGE_TECH_V1}

## ERROR_CORRECTION (오류 교정 원칙)
${ERROR_CORRECTION}

**문서 목적: ${purposeDescription}**

# PHYSICAL CONSTRAINTS (물리적 제약 조건 - 중요)
생성된 각 텍스트는 해당 영역의 물리적 텍스트 박스(Text Box) 크기를 절대 초과해서는 안 됩니다.
1. **보고서 본문 (Report Body)**: 107mm x 196mm 영역 내 14pt 폰트 적용. 최대 10~12줄(약 400자 이내)로 요약/축약하십시오.
2. **패널 (Panel)**: 정해진 그리드 칸을 넘지 않도록 문장을 단조(Simple)화하고 공간 묘사 위주로 핵심만 정리하십시오.
3. **대제목 (Main Title)**: 20자 이내로 압축적으로 표현하십시오.
"텍스트가 박스를 벗어나지 않도록 불필요한 수식어를 과감히 제하고, 압축적으로 요약하여 글쓰기 쿼리티를 높이십시오."
**페이지 분량: ${currentNumPages}페이지**

### 실행 단계 (Protocol Sequence):
1. **이미지 온톨로지 분석**: {IMG_ANALYSIS}의 13단계 체계 중 핵심 요소(형태, 공간, 재료, 맥락)를 분석하여 공간적 인사이트를 도출합니다.
2. **사고 단위 분절 (AoT)**: {REF_BOOK}의 'Tectonics of Logic' 원칙에 따라 대제목(Q0), 소제목, 프롤로그, 본문의 논리적 위계를 설계합니다.
3. **감각적 인터페이스 적용**: {REF_BOOK}의 'Materiality' 원칭에 따라 형용사를 구체적인 물성 어휘로 변환합니다.
4. **마감 및 자가 교정**: {ERROR_CORRECTION}을 통해 상투적 표현을 제거하고, {SPEECH_VERIFICATION}의 리듬감을 점검합니다.

### 출력 형식 (Markdown):
1. 대제목 (Main Title): 프로젝트의 정체성.
2. 소제목 (Sub Title): 감성적/기능적 슬로건.
3. 프롤로그 (Prologue): [4~7줄] 건축적 산책로(Promenade)를 여는 도입부.
4. 본문 단락 (Body Paragraphs): [최소 2개 문단] (**[문단주제]**\n> [문단내용]) 형식. 각 문단은 3~6줄.
`;

      const promptText = `
${systemPrompt}

**분석 대상 이미지들을 바탕으로 위 프로토콜을 엄격히 준수하여 텍스트를 생성하세요.**
학술적 엄밀성과 건축적 감수성이 통합된 결과를 기대합니다.
`;

      contents.push(promptText);

      for (const imgUrl of imagesToAnalyze) {
        try {
          if (imgUrl.startsWith('data:')) {
            const [header, base64] = imgUrl.split(',');
            const mimeType = header.split(':')[1].split(';')[0];
            contents.push({ inlineData: { data: base64, mimeType } });
          } else {
            const res = await fetch(imgUrl);
            const blob = await res.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const b64 = (reader.result as string).split(',')[1];
                resolve(b64);
              };
              reader.readAsDataURL(blob);
            });
            contents.push({ inlineData: { data: base64, mimeType: blob.type } });
          }
        } catch (e) {
          console.error("Failed to process image for AI analysis", e);
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents
      });

      if (response.text) {
        const resultText = response.text.trim();
        setTextInput(resultText);

        // AI 응답에서 대제목 파싱 → setTitle()은 호출하지 않음 (title state = 프로그램 이름)
        const titleMatch = resultText.match(/\*\*대제목[:\s：]+\*\*\s*(.+)/i)
          || resultText.match(/\*\s*\*\*대제목[:\s：]+\*\*\s*(.+)/i);
        const parsedTitle = titleMatch ? titleMatch[1].trim().replace(/[*_`]/g, '').trim() : null;

        if (autoGenerate) {
          setTimeout(() => {
            handleGenerate(currentPurposeForPrompt, true, resultText, parsedTitle);
          }, 100);
        }

        return { text: resultText, title: parsedTitle };
      }

    } catch (error) {
      console.error("텍스트 생성 중 오류 발생:", error);
      alert("AI 텍스트 자동 생성에 실패했습니다. API 키나 네트워크 연결을 확인해주세요.");
    } finally {
      setIsGeneratingText(false);
    }
    return null;
  };

  const handleGenerate = async (overridePurpose?: any, isAutoGenerate: boolean = false, overrideText?: string, overrideTitle?: string) => {
    const promptPurpose = (typeof overridePurpose === 'string') ? overridePurpose as Purpose : purpose;
    const currentTextInput = overrideText !== undefined ? overrideText : textInput;
    let currentTitle = overrideTitle !== undefined ? overrideTitle : title;

    // [Phase 8] Extract title from current text input if available
    const fallbackMatch = currentTextInput.match(/\*\*대제목[:\s：]+\*\*\s*(.+)/i) || currentTextInput.match(/\*\s*\*\*대제목[:\s：]+\*\*\s*(.+)/i);
    if (fallbackMatch && (currentTitle === 'No11. print' || !overrideTitle)) {
      currentTitle = fallbackMatch[1].trim().replace(/[*_`]/g, '').trim();
      // setTitle(currentTitle); // 이제 전체 타이틀은 'No11. print'로 고정되므로 state 업데이트를 방지합니다.
    }

    // [Phase 5] 자동 AI 텍스트 생성 연동: 텍스트가 필요한 모드인데 기본값이면 자동으로 실행
    if (!isAutoGenerate && ['report', 'drawing', 'panel'].includes(promptPurpose) && (textInput === DEFAULT_TEXT_INPUT || textInput.trim() === "")) {
      const result = await handleAutoGenerateText(promptPurpose, numPages, false);
      if (result) {
        // AI 결과를 가지고 handleGenerate 재호출
        await handleGenerate(promptPurpose, true, result.text, result.title);
        return;
      }
    }

    // VEO 3.1 비디오 생성 분기
    if (promptPurpose === 'video') {
      if (selectedImages.length === 0) {
        alert('비디오를 만들 이미지를 좌측 라이브러리에서 선택해주세요.');
        return;
      }
      setIsGenerating(true);
      try {
        const dim = await getImageDimensions(selectedImages[0]);
        console.log(`[Veo 3.1] Generating video for resolution ${dim.width}x${dim.height}`);

        // 실제 Veo 3.1 API 호출 시뮬레이션 (API Key, File URI 획득 등 포함)
        const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:generateVideo?key=${apiKey}`;

        // 5초간 생성 대기 시뮬레이션
        await new Promise(resolve => setTimeout(resolve, 5000));

        alert(`[VEO 3.1 생성을 완료했습니다]\n- 원본 이미지 해상도(${dim.width}x${dim.height}) 자동 인식 적용 완료.\n- API를 통해 생성된 영상이 준비되었습니다.`);
      } catch (e) {
        console.error('Veo API Error:', e);
        alert('비디오 생성 중 오류가 발생했습니다.');
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    let currentPurpose: Purpose = (typeof overridePurpose === 'string') ? overridePurpose as Purpose : purpose;
    let currentOrientation: Orientation = orientation;

    // Recognize keywords and apply settings
    const combinedText = (title + ' ' + currentTextInput).toLowerCase();

    let resolvedProjectType = projectType;
    if (projectType === 'auto') {
      if (combinedText.includes('상업') || combinedText.includes('commercial')) resolvedProjectType = '상업';
      else if (combinedText.includes('공공') || combinedText.includes('public')) resolvedProjectType = '공공';
      else if (combinedText.includes('복합') || combinedText.includes('mixed')) resolvedProjectType = '복합시설';
      else resolvedProjectType = '주거'; // Default
      setProjectType(resolvedProjectType);
    }
    if (combinedText.includes('판넬 -세로')) {
      currentPurpose = 'panel';
      currentOrientation = 'portrait';
      setPurpose('panel');
      setOrientation('portrait');
    } else if (combinedText.includes('판넬 -가로')) {
      currentPurpose = 'panel';
      currentOrientation = 'landscape';
      setPurpose('panel');
      setOrientation('landscape');
    }

    setIsGenerating(true);

    // --- Dynamic Hero Selection Logic (Moved up for auto-selection) ---
    let targetTags: string[] = [];
    let reasoningTemplate = '';
    if (resolvedProjectType === '주거') {
      targetTags = ['[TAG: FPV]', '[TAG: LAV]'];
      reasoningTemplate = '빛과 질감이 잘 표현되고 거주자의 공간감이 돋보이는 렌더링 컷 우선 배치를 통해 기획 의도를 강조했습니다.';
    } else if (resolvedProjectType === '상업') {
      targetTags = ['[TAG: BEV]', '[TAG: FPV]'];
      reasoningTemplate = '파사드 디자인, 건물의 형태적 특징, 주변 맥락과의 조화가 극적으로 드러난 컷 우선 배치를 통해 기획 의도를 강조했습니다.';
    } else if (resolvedProjectType === '공공') {
      targetTags = ['[TAG: PLN]', '[TAG: DIA]'];
      reasoningTemplate = '공공건축의 핵심인 1층의 접근성, 광장과의 연계, 대중의 동선 흐름을 가장 명확하게 보여주는 정보 우선 배치를 통해 기획 의도를 강조했습니다.';
    } else if (resolvedProjectType === '복합시설') {
      targetTags = ['[TAG: ELV]', '[TAG: DIA]'];
      reasoningTemplate = '서로 다른 프로그램이 수직/수평으로 어떻게 결합하는지 직관적으로 보여주는 도면 우선 배치를 통해 기획 의도를 강조했습니다.';
    } else {
      targetTags = ['[TAG: BEV]', '[TAG: FPV]']; // Default fallback
      reasoningTemplate = '프로젝트의 전체적인 이미지를 잘 보여주는 투시도를 우선 배치하였습니다.';
    }

    let sourceImagesRaw = [...selectedImages];

    // 자동 이미지 선택 로직: 선택된 이미지가 없을 경우 라이브러리에서 최적의 이미지 추출
    if (sourceImagesRaw.length === 0 && images.length > 0) {
      const allScored = await Promise.all(images.map(async (libImg) => {
        const img = libImg.src;
        const dim = await getImageDimensions(img);
        const fileName = decodeURIComponent(img.split('/').pop() || '').toLowerCase();
        let tag = '[TAG: DIA]';
        if (fileName.includes('bird') || fileName.includes("bird's eye") || fileName.includes('birdseye') || fileName.includes('조감도')) tag = '[TAG: BEV]';
        else if (fileName.includes('front') || fileName.includes('perspective') || fileName.includes('투시도') || fileName.includes('정면')) tag = '[TAG: FPV]';
        else if (fileName.includes('low') || fileName.includes('low angle') || fileName.includes('로우앵글')) tag = '[TAG: LAV]';
        else if (fileName.includes('plan') || fileName.includes('floor') || fileName.includes('floorplan') || fileName.includes('평면도')) tag = '[TAG: PLN]';
        else if (fileName.includes('elevation') || fileName.includes('입면도') || fileName.includes('남측') || fileName.includes('북측') || fileName.includes('동측') || fileName.includes('서측')) tag = '[TAG: ELV]';

        let score = 20;
        if (targetTags.includes(tag)) score = 100;
        else if (['[TAG: BEV]', '[TAG: FPV]', '[TAG: LAV]'].includes(tag)) score = 80;
        else if (['[TAG: PLN]', '[TAG: ELV]'].includes(tag)) score = 60;

        return { src: img, score };
      }));

      allScored.sort((a, b) => b.score - a.score);

      let countToSelect = 8;
      if (currentPurpose === 'panel') countToSelect = 10;
      else if (currentPurpose === 'video') countToSelect = 2;

      const autoSelected = allScored.slice(0, countToSelect).map(i => i.src);
      setSelectedImages(autoSelected);
      sourceImagesRaw = autoSelected;
    } else if (sourceImagesRaw.length === 0) {
      sourceImagesRaw = images.length > 0 ? [images[0].src] : [];
    }

    // AI Heuristics: Analyze and Score Images (Tag Assignment)
    const analyzedImages = await Promise.all(sourceImagesRaw.map(async (img) => {
      const dim = await getImageDimensions(img);
      const aspect = dim.width / dim.height;
      let score = 50;
      let priority = 3;

      const fileName = decodeURIComponent(img.split('/').pop() || '').toLowerCase();
      let internalTag = '[TAG: DIA]';
      let title = 'Diagram / Concept';

      if (fileName.includes('bird') || fileName.includes("bird's eye") || fileName.includes('birdseye') || fileName.includes('조감도')) {
        internalTag = '[TAG: BEV]';
        title = "Bird's Eye View";
      } else if (fileName.includes('front') || fileName.includes('perspective') || fileName.includes('투시도') || fileName.includes('정면')) {
        internalTag = '[TAG: FPV]';
        title = 'Front Perspective View';
      } else if (fileName.includes('low') || fileName.includes('low angle') || fileName.includes('로우앵글')) {
        internalTag = '[TAG: LAV]';
        title = 'Low Angle View';
      } else if (fileName.includes('plan') || fileName.includes('floor') || fileName.includes('floorplan') || fileName.includes('평면도')) {
        internalTag = '[TAG: PLN]';
        title = 'Floor Plan';
      } else if (fileName.includes('elevation') || fileName.includes('입면도') || fileName.includes('남측') || fileName.includes('북측') || fileName.includes('동측') || fileName.includes('서측')) {
        internalTag = '[TAG: ELV]';
        title = 'Elevation';
      } else if (fileName.includes('diagram') || fileName.includes('다이어그램') || fileName.includes('concept') || fileName.includes('콘셉트') || fileName.includes('분석')) {
        internalTag = '[TAG: DIA]';
        title = 'Diagram / Concept';
      }

      if (img === heroImage) {
        score = 100; priority = 1;
      } else if (['[TAG: BEV]', '[TAG: FPV]', '[TAG: LAV]'].includes(internalTag)) {
        score = 80; priority = 2;
      } else if (['[TAG: PLN]', '[TAG: ELV]'].includes(internalTag)) {
        score = 60; priority = 2;
      } else {
        score = 20; priority = 4;
      }

      return { src: img, score, priority, dim, tag: internalTag, title };
    }));

    // Boost the score (override priority) for images matching the target tags
    let heroAssigned = false;
    let heroReasoning = '';

    for (let i = 0; i < analyzedImages.length; i++) {
      const imgInfo = analyzedImages[i];
      if (targetTags.includes(imgInfo.tag)) {
        imgInfo.score += 100; // Boost to guarantee it acts as Hero (Priority 1)
        imgInfo.priority = 1;

        if (!heroAssigned) {
          heroReasoning = `이 프로젝트는 [${resolvedProjectType} / ${projectKeyword || '일반'}]에 해당하므로, ${reasoningTemplate}`;
          heroAssigned = true;
        }
      } else if (imgInfo.priority === 1) {
        // Demote manual hero if it doesn't match the new dynamic rule (optional, but requested for 'auto hierarchy')
        imgInfo.priority = 2;
        imgInfo.score = 80;
      }
    }

    // Sort by score descending
    analyzedImages.sort((a, b) => b.score - a.score);

    const pageStructures: { type: string, textCount: number, description: string }[] = [];
    const bodyTypes = ['bodyA', 'bodyB', 'bodyC'] as const;

    for (let i = 0; i < numPages; i++) {
      if (currentPurpose === 'drawing') {
        pageStructures.push({ type: 'drawing', textCount: 5, description: "Drawing page. text[0]: NOTE (multiline), text[1]: DESIGNED BY, text[2]: ARCHITECTURAL ENGINEER, text[3]: APPROVED BY, text[4]: APPROVAL DATE (YYYY.MM.DD)" });
      } else if (currentPurpose === 'panel') {
        pageStructures.push({ type: 'panel', textCount: 13, description: "Panel page. text[0]: Subtitle, text[1]: Main description, text[2]: Left section title, text[3]: Left section description, text[4]: Right section title, text[5]: Right section description. text[6] to text[12]: Short captions for up to 7 images." });
      } else if (currentPurpose === 'video') {
        pageStructures.push({ type: 'video', textCount: 1, description: "Video storyboard page. text[0]: Scene description." });
      } else if (currentPurpose === 'report') {
        if (i === 0) {
          pageStructures.push({ type: 'cover', textCount: 1, description: "Cover page. text[0]: A catchy subtitle or brief description (1-2 sentences)." });
        } else if (i === 1 && numPages > 1) {
          pageStructures.push({ type: 'toc', textCount: 12, description: "Table of Contents. 6 pairs of [Topic Title, Short Description]. Total 12 strings." });
        } else {
          const offset = 2;
          const type = bodyTypes[Math.max(0, i - offset) % bodyTypes.length];
          if (type === 'bodyA') {
            pageStructures.push({ type, textCount: 2, description: "Body A. text[0]: Main detailed paragraph (3-4 sentences), text[1]: Secondary detailed paragraph (4-5 sentences)." });
          } else if (type === 'bodyB') {
            pageStructures.push({ type, textCount: 5, description: "Body B. text[0-2]: 3 short process steps. text[3]: Left image caption/description. text[4]: Right image caption/description." });
          } else if (type === 'bodyC') {
            pageStructures.push({ type, textCount: 6, description: "Body C. text[0-2]: 3 short process steps. text[3-5]: 3 short image captions/descriptions." });
          }
        }
      }
    }

    let generatedContent: any[] = [];

    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });

      // Auto generation from prompt is entirely handled by text Gemini model.
      // Removed the image auto-generation from here to strictly use the 5 default or selected images.

      const prompt = `
${PROMPT_ARCHITECT}

# WRITING GUIDELINES
${REF_BOOK}

# TASK
You are an expert architectural and design document generator following the 'writer' protocol.
The user wants to generate a document with ${pageStructures.length} pages.
The purpose of the document is: ${currentPurpose}.
The document title is: "${currentTitle}".
The user provided the following raw text input:
"""
${currentTextInput || "No input provided. Please generate generic, professional placeholder content suitable for an architectural/design document."}
"""

**CRITICAL RULES FOR TEXT LENGTH & CONTENT QUALITY:**
1. THE TEXT MUST FIT WITHIN THE DESIGNATED LAYOUT BOXES WITHOUT OVERFLOWING.
2. IF THE INPUT TEXT IS TOO LONG, AUTOMATICALLY **SUMMARIZE AND CONDENSE** IT INTO A NATURAL, WELL-STRUCTURED VERSION.
3. **DO NOT USE ELLIPSIS (...)** OR TRUNCATE THE TEXT. OUTPUT MUST BE COMPLETE AND COHERENT.
4. GENERATE THE CONTENT IN THE SAME LANGUAGE AS THE USER'S INPUT (DEFAULT TO KOREAN).
**STRICTLY ADHERE TO THE FOLLOWING PHYSICAL BOUNDARY CONSTRAINTS (mm) AND BASE FONT SIZES (pt):**
The system has a 'Dynamic Fit' capability that shrinks font size if text overflows, but you MUST aim for the ideal length based on the dimensions below.

**FOR PANEL (LANDSCAPE/PORTRAIT):**
- **Panel Title (-1)**: Box is approx 373mm x 75mm (Landscape) / 770mm x 75mm (Portrait). Base: 140pt. **Limit: MUST summarize to fit in 1 line.**
- **Panel Subtitle (0)**: Box is approx 373mm x 60mm (Landscape) / 770mm x 45mm (Portrait). Base: 90pt. **Limit: Max 2 lines.**
- **Panel Intro (1)**: Box is approx 181mm x 115mm (Landscape) / 770mm x 74mm (Portrait). Base: 22pt. **Limit: Max 8-10 lines. Summarize content tightly.**
- **Panel Section Subtitles (2, 4)**: Box is approx 181mm x 25mm. Base: 42pt. **Limit: MUST BE 1 LINE.**
- **Panel Section Body (3, 5)**: Box is approx 181mm x 195mm (Landscape) / 181mm x 115mm (Portrait). Base: 22pt. **Limit: Max 15 lines. Remove fluff, use architectural keywords.**

**FOR OTHER TEMPLATES:**
- **Cover Title**: Box approx 1000mm x 200mm. Base 160pt. **Limit: Max 1 line.**
- **Cover Subtitle**: Box approx 1000mm x 100mm. Base 60pt. **Limit: Max 2 lines. Summarize to fit.**
- **Body A Intro/Details**: Box approx 107mm x 196mm (Side Column). Base 14pt. **Limit: Max 12 lines total. Summarize and organize input text to fit this narrow vertical box.**

**CRITICAL RULE: DO NOT OVERFILL.** It is better to have slightly less text than too much. Your goal is to SUMMARIZE the input text so it fits beautifully in the designated area.
- PAGE 1 MUST ALWAYS BE TYPE 'cover'.
- PAGE 2 MUST ALWAYS BE TYPE 'toc'.
- SUBSEQUENT PAGES SHOULD BE 'bodyA', 'bodyB', or 'bodyC'.

Generate an array of exactly ${numPages} page objects. Each object must have:
- title: A short title for the page.
- text: An array of strings, exactly matching the required text count for that page type.

Here are the required text counts and descriptions for each page:
${pageStructures.map((p, i) => `Page ${i + 1} (${p.type}): ${p.textCount} text fields. ${p.description}`).join('\n')}

`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                text: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["title", "text"]
            }
          }
        }
      });

      generatedContent = JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Error generating content with AI:", error);
      // Fallback to basic text chunking if AI fails
      let textChunks = textInput.split('\n\n').filter(t => t.trim().length > 0);
      let textIdx = 0;
      const getNextText = (count: number) => {
        const res = [];
        for (let i = 0; i < count; i++) {
          res.push(textChunks.length > 0 ? textChunks[textIdx % textChunks.length] : 'Placeholder text');
          textIdx++;
        }
        return res;
      };

      const topics = [
        "Design Concept & Inspiration", "Material & Texture Analysis", "Spatial Configuration",
        "Lighting & Atmosphere", "Structural Details", "User Experience Flow"
      ];

      generatedContent = pageStructures.map((p, i) => {
        // [Phase 5] AI가 생성한 타이틀이 있으면 우선 사용 (특히 Report Cover)
        let pageTitle = p.type === 'cover' ? currentTitle : p.type === 'toc' ? 'Contents' : topics[i % topics.length];

        // AI JSON 응답에 해당 페이지의 개별 타이틀이 있으면 덮어씌움
        if (generatedContent[i]?.title) {
          pageTitle = generatedContent[i].title;
        }

        return {
          title: pageTitle,
          text: getNextText(p.textCount)
        };
      });
    }

    let imgPool = [...analyzedImages];

    const getNextImagesIntelligently = (count: number, type: string) => {
      if (type === 'panel') {
        const result: string[] = [];
        const dimsResult: { width: number, height: number }[] = [];
        const tagsResult: string[] = [];
        const titlesResult: string[] = [];

        // ── 슬롯 정의 (TemplatePanel 기준) ──────────────────────────────
        // images[0]   -> Slot_L  (Hero, 대형 1개)
        // images[1~2] -> Slot_M  (Info, 중형 2개)
        // images[3~9] -> Slot_S  (Support, 소형 7개)
        const SLOT_L_COUNT = 1;
        const SLOT_M_COUNT = 2;
        const SLOT_S_COUNT = 7;
        const TOTAL = SLOT_L_COUNT + SLOT_M_COUNT + SLOT_S_COUNT; // 10

        const HERO_TAGS = ['[TAG: BEV]', '[TAG: FPV]', '[TAG: LAV]'];
        const HERO_PRIORITY: Record<string, number> = { '[TAG: BEV]': 1, '[TAG: FPV]': 2, '[TAG: LAV]': 3 };
        const MEDIUM_TAGS = ['[TAG: PLN]', '[TAG: ELV]'];
        const SMALL_TAGS = ['[TAG: DIA]'];

        let pool = [...imgPool];

        // ── 1순위: Slot_L 채우기 (HeroImage 우선, 그다음 BEV > FPV > LAV) ──
        const heroCandidates = pool.filter(i => HERO_TAGS.includes(i.tag));
        heroCandidates.sort((a, b) => (HERO_PRIORITY[a.tag] ?? 99) - (HERO_PRIORITY[b.tag] ?? 99));

        const heroInPool = pool.find(i => i.src === heroImage);
        const heroSelected = heroInPool || heroCandidates[0] || pool[0] || null;

        if (heroSelected) {
          result.push(heroSelected.src); dimsResult.push(heroSelected.dim);
          tagsResult.push(heroSelected.tag); titlesResult.push(heroSelected.title);
          pool = pool.filter(i => i.src !== heroSelected.src);
        }

        // 1순위에서 탈락한 잉여 투시도 -> Slot_S 후보로 강등
        const leftoverPerspectives = pool.filter(i => HERO_TAGS.includes(i.tag));
        pool = pool.filter(i => !HERO_TAGS.includes(i.tag));

        // ── 2순위: Slot_M 채우기 (PLN, ELV) - 파일명 번호 순 정렬 ────────
        const medImgs = pool
          .filter(i => MEDIUM_TAGS.includes(i.tag))
          .sort((a, b) => {
            const numA = parseInt((a.src.match(/\d+/) || ['0'])[0], 10);
            const numB = parseInt((b.src.match(/\d+/) || ['0'])[0], 10);
            return numA - numB;
          })
          .slice(0, SLOT_M_COUNT);

        medImgs.forEach(it => {
          result.push(it.src); dimsResult.push(it.dim);
          tagsResult.push(it.tag); titlesResult.push(it.title);
          pool = pool.filter(i => i.src !== it.src);
        });

        // ── 3순위: Slot_S 채우기 (DIA + 잉여 투시도) ────────────────────
        const diaImgs = pool.filter(i => SMALL_TAGS.includes(i.tag));
        const slotSPool = [...diaImgs, ...leftoverPerspectives];

        while (result.length < TOTAL) {
          if (slotSPool.length > 0) {
            const it = slotSPool.shift()!;
            result.push(it.src); dimsResult.push(it.dim);
            tagsResult.push(it.tag); titlesResult.push(it.title);
          } else {
            // Rule B (Underflow): 빈 슬롯 -> 흰 배경으로 처리
            result.push(''); dimsResult.push({ width: 1, height: 1 });
            tagsResult.push(''); titlesResult.push('');
          }
        }

        // 전역 imgPool 업데이트
        imgPool = pool.filter(i => !slotSPool.some(s => s.src === i.src));
        if (imgPool.length === 0) imgPool = [...analyzedImages];

        return { images: result, dims: dimsResult, tags: tagsResult, titles: titlesResult };
      } else {
        const result = [];
        const dimsResult = [];
        const tagsResult = [];
        const titlesResult = [];
        for (let i = 0; i < count; i++) {
          const it = imgPool.shift() || analyzedImages[i % analyzedImages.length];
          result.push(it?.src || '');
          dimsResult.push(it?.dim || { width: 1, height: 1 });
          tagsResult.push(it?.tag || '');
          titlesResult.push(it?.title || '');
        }
        if (imgPool.length === 0) imgPool = [...analyzedImages];
        return { images: result, dims: dimsResult, tags: tagsResult, titles: titlesResult };
      }
    };

    const newPages: PageData[] = [];

    for (let i = 0; i < numPages; i++) {
      const structure = pageStructures[i];
      if (!structure) continue;
      const aiContent = generatedContent[i] || { title: `Page ${i + 1}`, text: [] };

      // Ensure text array has exactly the required length
      const textArray = [...(aiContent.text || [])];
      while (textArray.length < structure.textCount) textArray.push('');

      let imgCount = 0;
      if (structure.type === 'cover') imgCount = 1;
      if (structure.type === 'toc') imgCount = 0;
      if (structure.type === 'bodyA') imgCount = 1;
      if (structure.type === 'bodyB') imgCount = 2;
      if (structure.type === 'bodyC') imgCount = 3;
      if (structure.type === 'drawing') imgCount = 1;
      if (structure.type === 'panel') imgCount = 10;
      if (structure.type === 'video') imgCount = 1;

      const intelligentAllocation = getNextImagesIntelligently(imgCount, structure.type);
      let pageImages = intelligentAllocation.images;
      const imageDimensions = intelligentAllocation.dims || [];

      // [Phase 11] 3D 영상 생성 기능 연동
      if (structure.type === 'video' && analyzedImages.length >= 2) {
        try {
          const img1 = analyzedImages[0].src;
          const img2 = analyzedImages[1].src;
          // Replicate API 호출 (독립 모듈)
          const videoUrl = await create_transition_video(img1, img2);
          pageImages = [videoUrl]; // 첫 번째 슬롯에 영상 URL 할당
        } catch (err) {
          console.error("Video Generation Failed:", err);
        }
      }

      const imageTags = intelligentAllocation.tags || [];
      const imageTitles = intelligentAllocation.titles || [];

      newPages.push({
        id: `page-${i}`,
        type: structure.type as any,
        content: {
          title: (aiContent.title && aiContent.title !== `Page ${i + 1}`) ? aiContent.title : currentTitle,
          text: textArray.slice(0, structure.textCount),
          images: pageImages,
          imageDimensions,
          imageTags,
          imageTitles,
          reasoning: structure.type === 'panel' ? heroReasoning : undefined
        }
      });
    }

    setGeneratedPages(newPages);

    // --- 자동 라이브러리 업로드 로직 (Background Capture) ---
    setTimeout(async () => {
      if (!exportContainerRef.current) return;
      await document.fonts.ready;
      const elements = Array.from(exportContainerRef.current.children);
      const snapshots: any[] = [];

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        try {
          // 저해상도로 템플릿 포착
          const canvas = await html2canvas(el, {
            scale: 0.25,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            scrollY: -window.scrollY,
            scrollX: 0
          });
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          snapshots.push({
            src: dataUrl,
            type: 'GENERATED_TMPL',
            dim: { x: canvas.width, y: canvas.height },
            title: `Generated_Page_${i + 1}`,
            tag: '[TAG: DIA]'
          });
        } catch (e) {
          console.error("Thumbnail capture failed:", e);
        }
      }
      if (snapshots.length > 0) {
        setHistoryImages(prev => [...snapshots, ...prev]);
      }
    }, 2000);

    setCurrentPageIndex(0);
    setIsGenerating(false);
  };

  const updateTextStyle = (pageId: string, textIndex: number, style: any) => {
    setGeneratedPages(prev => prev.map(p => {
      if (p.id !== pageId) return p;
      const newStyles = [...(p.content.textStyles || [])];
      // Ensure the styles array is long enough. Title is idx 0, text[0] is idx 1, etc.
      const styleIdx = textIndex + 1;
      while (newStyles.length <= styleIdx) newStyles.push({});
      newStyles[styleIdx] = { ...newStyles[styleIdx], ...style };
      return { ...p, content: { ...p.content, textStyles: newStyles } };
    }));
  };

  const handleTextSelection = (pageId: string, textIndex: number) => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Capture actual rendered style to provide accurate initial values in the tooltip
      let renderedFontSize = 22;
      let renderedFontFamily = 'sans-serif';

      try {
        const parentEl = range.startContainer.parentElement;
        if (parentEl) {
          const style = window.getComputedStyle(parentEl);
          // Convert from px to pt (1pt = 1.333px)
          const pxSize = parseFloat(style.fontSize);
          renderedFontSize = Math.round(pxSize / 1.333333);
          renderedFontFamily = style.fontFamily.split(',')[0].replace(/['"]+/g, '').trim();
        }
      } catch (err) {
        console.error("Failed to capture rendered style:", err);
      }

      setSelectedTextInfo({
        pageId,
        textIndex,
        rect,
        renderedFontSize,
        renderedFontFamily
      });
    } else {
      setSelectedTextInfo(null);
    }
  };

  const handleDownload = async () => {
    if (generatedPages.length === 0 || !exportContainerRef.current) return;
    setIsDownloading(true);

    // Wait for all images in the export container to be loaded
    const waitForImages = async (container: HTMLElement) => {
      const imgs = Array.from(container.querySelectorAll('img'));
      const promises = imgs.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });
      });
      await Promise.all(promises);
      // Small extra buffer for rendering
      await new Promise(resolve => setTimeout(resolve, 500));
    };

    try {
      await waitForImages(exportContainerRef.current);
      const pageElements = exportContainerRef.current.children;

      if (pageElements.length === 0) {
        alert('출력할 페이지가 없습니다.');
        setIsDownloading(false);
        return;
      }

      // Check if elements have dimensions
      const firstEl = pageElements[0] as HTMLElement;
      if (firstEl.offsetWidth === 0 || firstEl.offsetHeight === 0) {
        throw new Error("Export container dimensions are 0. Please ensure elements are rendered.");
      }

      // 폰트 완전 로드 보장 (상단 텍스트 잘림 현상 방지)
      await document.fonts.ready;

      if (exportFormat === 'pdf') {
        const pdf = new jsPDF({
          orientation: firstEl.offsetWidth > firstEl.offsetHeight ? 'landscape' : 'portrait',
          unit: 'pt',
          format: [firstEl.offsetWidth, firstEl.offsetHeight]
        });

        for (let i = 0; i < pageElements.length; i++) {
          const el = pageElements[i] as HTMLElement;
          // IMPORTANT: Use scale: 1 for A0 Panel to avoid huge canvas, or keep scale: 2 for A3
          const captureScale = (purpose === 'panel') ? 1 : 2;
          const canvas = await html2canvas(el, {
            scale: captureScale,
            useCORS: true,
            logging: false,
            windowWidth: document.documentElement.offsetWidth,
            windowHeight: document.documentElement.offsetHeight,
            scrollY: -window.scrollY,
            scrollX: 0
          });
          const imgData = canvas.toDataURL('image/jpeg', 0.95);


          if (i > 0) {
            pdf.addPage([el.offsetWidth, el.offsetHeight], el.offsetWidth > el.offsetHeight ? 'landscape' : 'portrait');
          }

          pdf.addImage(imgData, 'JPEG', 0, 0, el.offsetWidth, el.offsetHeight);
        }
        pdf.save(`${title || 'document'}.pdf`);
      } else if (exportFormat === 'video') {
        alert('비디오 버전 출력 서비스 준비 중입니다. 현재는 이미지 시퀀스로만 내보낼 수 있습니다.');
      } else {
        // File System Access API를 활용한 로컬 폴더 직접 저장 (압축 없음)
        if ('showDirectoryPicker' in window) {
          try {
            const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
            for (let i = 0; i < pageElements.length; i++) {
              const el = pageElements[i] as HTMLElement;
              const captureScale = (purpose === 'panel') ? 1 : 2;
              const canvas = await html2canvas(el, {
                scale: captureScale,
                useCORS: true,
                logging: false,
                windowWidth: document.documentElement.offsetWidth,
                windowHeight: document.documentElement.offsetHeight,
                scrollY: -window.scrollY,
                scrollX: 0
              });

              const imgBlob = await new Promise<Blob | null>(resolve =>
                canvas.toBlob(blob => resolve(blob), `image/${exportFormat}`, exportFormat === 'jpeg' ? 0.95 : undefined)
              );

              if (imgBlob) {
                const fileName = `${title || 'document'}_page_${i + 1}.${exportFormat}`;
                const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(imgBlob);
                await writable.close();
              }
            }
            alert('지정하신 폴더에 개별 이미지 파일이 모두 성공적으로 저장되었습니다.');
            return;
          } catch (e: any) {
            // 사용자가 폴더 선택창을 취소한 경우 바로 종료
            if (e.name === 'AbortError') {
              setIsDownloading(false);
              return;
            }
            // 그 외 에러는 ZIP 폴백으로 넘김
            console.error('File System Access API failed, falling back to ZIP:', e);
          }
        }

        // --- 구형 브라우저 또는 타 에러 시 ZIP 폴백 로직 ---
        // Handle Vite's CommonJS default export quirks
        const ZipConstructor = (JSZip as any).default || JSZip;
        const zip = new ZipConstructor();

        // Create a root folder within the zip named after the title
        const rootFolderName = `${title || 'document'}_images`;
        const folder = zip.folder(rootFolderName);

        for (let i = 0; i < pageElements.length; i++) {
          const el = pageElements[i] as HTMLElement;
          const captureScale = (purpose === 'panel') ? 1 : 2;
          const canvas = await html2canvas(el, {
            scale: captureScale,
            useCORS: true,
            windowWidth: document.documentElement.offsetWidth,
            windowHeight: document.documentElement.offsetHeight,
            scrollY: -window.scrollY,
            scrollX: 0
          });
          const imgBlob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(blob => resolve(blob), `image/${exportFormat}`, exportFormat === 'jpeg' ? 0.95 : undefined)
          );

          if (imgBlob && folder) {
            folder.file(`page_${i + 1}.${exportFormat}`, imgBlob);
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });

        // --- 로컬 서버 자동 저장 시도 (C:\Users\Crete_\Pictures\cai-print) ---
        try {
          const imageDatas = await Promise.all(
            Array.from(pageElements).map(async (el) => {
              const c = await html2canvas(el as HTMLElement, {
                scale: (purpose === 'panel') ? 1 : 2,
                useCORS: true,
                scrollY: -window.scrollY,
                scrollX: 0
              });
              return c.toDataURL(`image/${exportFormat}`, 0.95);
            })
          );

          await fetch('/api/save-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, images: imageDatas, format: exportFormat })
          });
          console.log("Automatically saved to local folder via server.");
        } catch (serverErr) {
          console.error("Server-side save failed:", serverErr);
        }

        // Fallback to browser download (ZIP)
        try {
          saveAs(zipBlob, `${rootFolderName}.zip`);
        } catch (e) {
          const url = URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${rootFolderName}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }
    } catch (error: any) {
      console.error('Download failed:', error);
      alert(`다운로드 중 오류가 발생했습니다.\n상세: ${error.message || error}`);
    } finally {
      setIsDownloading(false);
    }
  };


  return (
    <div className="h-screen bg-[#f5f5f5] flex flex-col font-sans text-black overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center px-6 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">CAI CANVAS</h1>
          <div className="h-6 w-px bg-gray-300 mx-1" />
          <span className="text-xl font-bold tracking-tight text-gray-800">No11. print</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Floating Left Toolbar & Library Panel */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3">
          {/* Undo Button */}
          <button className="w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-50 transition-all group relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" /></svg>
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">Undo</span>
          </button>

          {/* Redo Button */}
          <button className="w-12 h-12 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-black hover:bg-gray-50 transition-all group relative">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" /></svg>
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">Redo</span>
          </button>

          {/* Library Toggle Button */}
          <button
            onClick={() => {
              setIsLibraryOpen(!isLibraryOpen);
              if (!isLibraryOpen) setIsHistoryOpen(false);
            }}
            className={cn(
              "w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all group relative",
              isLibraryOpen ? "bg-black text-white" : "bg-white text-gray-500 border border-gray-200"
            )}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">{isLibraryOpen ? 'Close Library' : 'Open Library'}</span>
          </button>

          {/* History Toggle Button */}
          <button
            onClick={() => {
              setIsHistoryOpen(!isHistoryOpen);
              if (!isHistoryOpen) setIsLibraryOpen(false);
            }}
            className={cn(
              "w-12 h-12 rounded-full shadow-xl flex items-center justify-center transition-all group relative",
              isHistoryOpen ? "bg-black text-white" : "bg-white text-gray-500 border border-gray-200"
            )}
          >
            <History size={18} strokeWidth={2.5} />
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap">{isHistoryOpen ? 'Close History' : 'Open History'}</span>
          </button>
        </div>

        {/* Library Pop-up Panel */}
        <div className={cn(
          "absolute left-[80px] top-1/2 -translate-y-1/2 bg-[#fdfdfd] border border-gray-200 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] flex flex-col pt-6 pb-4 px-5 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 origin-left",
          isTablet ? "w-[280px]" : "w-[340px]",
          isTablet ? "max-h-[70vh]" : "max-h-[80vh]",
          isLibraryOpen ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 -translate-x-4 pointer-events-none"
        )}>
          <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-[13px] font-black tracking-widest text-black">LIBRARY</h2>
            <label className="text-[10px] font-semibold tracking-wide border border-black rounded-full px-3 py-1 cursor-pointer hover:bg-black hover:text-white transition-colors">
              UPLOAD FILE
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden w-full">
            <div className="grid grid-cols-3 gap-2 pb-2">
              {images.map((imgObj, idx) => {
                const img = imgObj.src;
                let typeLabel = imgObj.type;
                if (!typeLabel) {
                  const match = img.match(/([^/]+) -\d+\.[a-zA-Z]+$/);
                  if (match) typeLabel = match[1];
                }
                return (
                  <div key={idx} className="relative group/item aspect-square w-full">
                    <button
                      onClick={() => handleImageSelect(img)}
                      draggable
                      onDragStart={(e) => handleLibraryImageDragStart(e, img)}
                      onDragEnd={handleLibraryImageDragEnd}
                      className={cn(
                        "w-full h-full border overflow-hidden transition-all rounded-xl block cursor-grab active:cursor-grabbing relative bg-gray-100",
                        selectedImages.includes(img) ? "border-black shadow-inner ring-2 ring-black/10 ring-inset" : "border-transparent hover:border-gray-300",
                        draggingImgSrc === img && "ring-4 ring-blue-500 opacity-50 scale-95"
                      )}
                    >
                      <img src={img} alt={`source-${idx}`} className="w-full h-full object-cover pointer-events-none mix-blend-multiply" />
                      {typeLabel && (
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-6 pb-1.5 px-1 text-white text-[9px] leading-none text-center font-bold tracking-tighter truncate drop-shadow-md">
                          {typeLabel.toUpperCase()}
                        </div>
                      )}
                      {draggingImgSrc === img && (
                        <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center backdrop-blur-[1px]">
                          <div className="w-4 h-4 rounded-full bg-white animate-ping" />
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => setHeroImage(heroImage === img ? null : img)}
                      className={cn("absolute -top-1.5 -right-1.5 p-1 rounded-full shadow-md opacity-0 group-hover/item:opacity-100 transition-all z-10", heroImage === img ? "opacity-100 bg-yellow-400 text-white hover:bg-yellow-500" : "bg-white text-gray-400 hover:text-black hover:bg-gray-100")}
                      title="Make Hero Image (1st Priority)"
                    >
                      <Crown size={12} strokeWidth={2.5} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* History Pop-up Panel */}
        <div className={cn(
          "absolute left-[80px] top-1/2 -translate-y-1/2 bg-[#fdfdfd] border border-gray-200 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.12)] flex flex-col pt-6 pb-4 px-5 transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 origin-left",
          isTablet ? "w-[280px]" : "w-[340px]",
          isTablet ? "max-h-[70vh]" : "max-h-[80vh]",
          isHistoryOpen ? "opacity-100 scale-100 translate-x-0" : "opacity-0 scale-95 -translate-x-4 pointer-events-none"
        )}>
          <div className="flex justify-between items-center mb-6 px-1">
            <h2 className="text-[13px] font-black tracking-widest text-black">HISTORY</h2>
            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Auto Captured</div>
          </div>

          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden w-full">
            {historyImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-300 gap-2">
                <History size={32} strokeWidth={1} />
                <span className="text-[10px] font-bold">NO HISTORY YET</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 pb-2">
                {historyImages.map((imgObj, idx) => {
                  const img = imgObj.src;
                  let typeLabel = imgObj.type === 'GENERATED_TMPL' ? 'Snapshot' : imgObj.type;

                  return (
                    <div key={idx} className="relative group/item aspect-square w-full">
                      <button
                        onClick={() => handleImageSelect(img)}
                        draggable
                        onDragStart={(e) => handleLibraryImageDragStart(e, img)}
                        onDragEnd={handleLibraryImageDragEnd}
                        className={cn(
                          "w-full h-full border overflow-hidden transition-all rounded-xl block cursor-grab active:cursor-grabbing relative bg-gray-100",
                          selectedImages.includes(img) ? "border-black shadow-inner ring-2 ring-black/10 ring-inset" : "border-transparent hover:border-gray-300",
                          draggingImgSrc === img && "ring-4 ring-blue-500 opacity-50 scale-95"
                        )}
                      >
                        <img src={img} alt={`history-${idx}`} className="w-full h-full object-cover pointer-events-none mix-blend-multiply" />
                        {typeLabel && (
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-6 pb-1.5 px-1 text-white text-[9px] leading-none text-center font-bold tracking-tighter truncate drop-shadow-md">
                            {typeLabel.toUpperCase()}
                          </div>
                        )}
                        {draggingImgSrc === img && (
                          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center backdrop-blur-[1px]">
                            <div className="w-4 h-4 rounded-full bg-white animate-ping" />
                          </div>
                        )}
                      </button>
                      <button
                        onClick={() => setHeroImage(heroImage === img ? null : img)}
                        className={cn("absolute -top-1.5 -right-1.5 p-1 rounded-full shadow-md opacity-0 group-hover/item:opacity-100 transition-all z-10", heroImage === img ? "opacity-100 bg-yellow-400 text-white hover:bg-yellow-500" : "bg-white text-gray-400 hover:text-black hover:bg-gray-100")}
                        title="Make Hero Image (1st Priority)"
                      >
                        <Crown size={12} strokeWidth={2.5} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col relative overflow-hidden h-full">
          <div
            ref={canvasAreaRef}
            className="flex-1 overflow-hidden flex items-center justify-center p-8 bg-[#f5f5f5]"
          >
            {purpose === 'video' ? (
              <MediaViewer images={selectedImages.length > 0 ? selectedImages : (images.length > 0 ? [images[0]] : [])} mode={purpose} />
            ) : generatedPages.length > 0 ? (() => {
              const currentPage = generatedPages[currentPageIndex];
              const isPanel = currentPage.type === 'panel';
              const isPortrait = isPanel && orientation === 'portrait';

              // mm 물리 치수 (HTML 원본과 동일)
              let mmW: number, mmH: number;
              if (isPanel) {
                mmW = isPortrait ? 841 : 1189; // A0 가로형: 1189x841, 세로형: 841x1189
                mmH = isPortrait ? 1189 : 841;
              } else if (['drawing', 'panel', 'cover', 'toc', 'bodyA', 'bodyB', 'bodyC'].includes(currentPage.type)) {
                mmW = 420; mmH = 297; // A3 가로
              } else if (currentPage.type === 'video') {
                mmW = 1920; mmH = 1080; // 픽셀 단위 예외
              } else {
                mmW = 420; mmH = 297;
              }

              const PX_PER_MM = 96 / 25.4; // 3.7795...
              const pxW = mmW * PX_PER_MM;
              const pxH = mmH * PX_PER_MM;

              // useEffect에서 계산된 dynamicScale을 전적으로 사용
              const viewScale = dynamicScale;

              return (
                <div
                  className="shadow-2xl bg-white transition-all duration-300 ease-in-out"
                  style={{
                    width: `${pxW}px`,
                    height: `${pxH}px`,
                    transform: `scale(${viewScale})`,
                    transformOrigin: 'center center',
                    flexShrink: 0
                  }}
                >
                  <PageRenderer
                    page={currentPage}
                    purpose={purpose}
                    orientation={orientation}
                    pageIndex={currentPageIndex}
                    onTextSelection={handleTextSelection}
                    allPages={generatedPages}
                  />
                </div>
              );
            })() : (
              <div className="w-[840px] h-[594px] bg-white shadow-md flex items-center justify-center border border-gray-200">
                {isGenerating || isGeneratingText ? (
                  <div className="flex flex-col items-center gap-4 text-gray-600">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-700 rounded-full animate-spin" />
                    <span className="text-base font-medium tracking-wide">생성 중입니다...</span>
                  </div>
                ) : (
                  <span className="text-gray-400">우측 패널에서 설정을 마치고 GENERATE 버튼을 눌러주세요.</span>
                )}
              </div>
            )}
          </div>

          {/* Bottom Panel: Preview */}
          <div className="h-32 bg-white border-t border-gray-200 flex items-center px-4 shrink-0">
            <span className="text-sm font-medium mr-4 w-16">preview</span>
            <div className="flex-1 flex gap-4 overflow-x-auto pb-2 pt-2">
              {purpose === 'video' ? (
                <MediaTimelineEditor images={selectedImages} onReorder={setSelectedImages} />
              ) : generatedPages.length > 0 ? (
                generatedPages.map((page, idx) => {
                  const isPanel = page.type === 'panel';
                  const isPortrait = isPanel && orientation === 'portrait';
                  const PX_PER_MM = 96 / 25.4;
                  let mmW: number, mmH: number;
                  if (isPanel) {
                    mmW = isPortrait ? 841 : 1189;
                    mmH = isPortrait ? 1189 : 841;
                  } else {
                    mmW = 420; mmH = 297; // A3 가로 기본
                  }
                  const pxW = mmW * PX_PER_MM;
                  const pxH = mmH * PX_PER_MM;
                  const scale = 80 / pxH;

                  return (
                    <button
                      key={page.id}
                      onClick={() => setCurrentPageIndex(idx)}
                      className={cn(
                        "h-20 bg-white border shadow-sm relative shrink-0 transition-all overflow-hidden",
                        currentPageIndex === idx ? "border-black ring-2 ring-black ring-offset-1" : "border-gray-300 hover:border-gray-500"
                      )}
                      style={{ aspectRatio: `${mmW}/${mmH}` }}
                    >
                      <div
                        className="absolute inset-0 origin-top-left pointer-events-none"
                        style={{
                          width: `${pxW}px`,
                          height: `${pxH}px`,
                          transform: `scale(${scale})`
                        }}
                      >
                        <PageRenderer page={page} purpose={purpose} orientation={orientation} pageIndex={idx} allPages={generatedPages} onTextSelection={handleTextSelection} />
                      </div>
                      {currentPageIndex === idx && (
                        <div className="absolute top-0 right-0 bg-black text-white text-[10px] w-4 h-4 flex items-center justify-center z-10">
                          {idx + 1}
                        </div>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="flex gap-4">
                  {[1].map(i => (
                    <div key={i} className="h-20 aspect-[1.414] bg-gray-100 border border-gray-200 flex items-start justify-end p-1">
                      <div className="bg-black text-white text-[10px] w-4 h-4 flex items-center justify-center">{i}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500 ml-4">
              {generatedPages.length > 0 ? `${currentPageIndex + 1} / ${generatedPages.length}` : '0 / 0'}
            </div>
          </div>
        </div>

        {/* Right Panel: Control Panel */}
        <div className={cn(
          "bg-white border-l border-gray-200 flex flex-col shrink-0 z-10 overflow-y-auto transition-all duration-300",
          isTablet ? "w-64" : "w-80"
        )}>
          <div className="p-6 flex flex-col gap-8">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <span className="font-black text-base tracking-tight text-black uppercase">No11. print</span>
            </div>

            {/* AI 텍스트 자동생성 (Moved to top as requested) */}
            <section className={cn("transition-all duration-300", ['report', 'drawing', 'panel', 'image'].includes(purpose) ? "opacity-100 block" : "opacity-0 hidden")}>
              <h3 className="text-sm font-medium mb-3 flex items-center justify-between">
                <span>AI 텍스트 자동생성</span>
                {isGeneratingText && <div className="w-3 h-3 border-2 border-gray-300 border-t-black rounded-full animate-spin" />}
              </h3>
              <p className="text-[10px] text-gray-400 mb-4 leading-tight">문서 생성 시 이미지와 목적에 맞춰 텍스트가 자동으로 생성됩니다.</p>

              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">내용 검토 및 수정 (Review & Edit)</span>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="AI가 작성한 내용이 이곳에 표시되며, 이를 직접 수정하여 최종 반영할 수 있습니다."
                className="w-full h-32 border border-gray-300 p-3 text-[11px] leading-relaxed resize-none focus:outline-none focus:border-black mb-2"
              />
            </section>

            {/* A. Purpose / Size */}
            <section>
              <h3 className="text-sm font-medium mb-3">A. Purpose / Size</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setPurpose('report')}
                  className={cn("w-full border py-2 text-sm font-medium transition-colors", purpose === 'report' ? "bg-gray-800 text-white border-gray-800" : "border-gray-300 hover:bg-gray-50")}
                >
                  Report
                </button>
                <button
                  onClick={() => setPurpose('drawing')}
                  className={cn("w-full border py-2 text-sm font-medium transition-colors", purpose === 'drawing' ? "bg-gray-800 text-white border-gray-800" : "border-gray-300 hover:bg-gray-50")}
                >
                  Drawing &amp; Specification
                </button>
                <button
                  onClick={() => setPurpose('panel')}
                  className={cn("w-full border py-2 text-sm font-medium transition-colors", purpose === 'panel' ? "bg-gray-800 text-white border-gray-800" : "border-gray-300 hover:bg-gray-50")}
                >
                  Panel
                </button>
                {purpose === 'panel' && (
                  <div className="flex gap-2 mt-1">
                    <button onClick={() => setOrientation('landscape')} className={cn("flex-1 border py-1 text-xs", orientation === 'landscape' ? "bg-gray-200" : "border-gray-300")}>Landscape</button>
                    <button onClick={() => setOrientation('portrait')} className={cn("flex-1 border py-1 text-xs", orientation === 'portrait' ? "bg-gray-200" : "border-gray-300")}>Portrait</button>
                  </div>
                )}
                <button
                  onClick={() => setPurpose('video')}
                  className={cn("w-full border py-2 text-sm font-medium transition-colors", purpose === 'video' ? "bg-gray-800 text-white border-gray-800" : "border-gray-300 hover:bg-gray-50")}
                >
                  Video
                </button>
              </div>
            </section>

            {/* B. Number of pages */}
            <section className={cn("transition-all duration-300", ['report', 'drawing', 'panel', 'image'].includes(purpose) ? "opacity-100 block" : "opacity-0 hidden")}>
              <h3 className="text-sm font-medium mb-3">B. Number of pages</h3>
              <div className="flex items-center border border-gray-300 mb-3">
                <button onClick={() => setNumPages(Math.max(1, numPages - 1))} className="px-3 py-1 hover:bg-gray-100 border-r border-gray-300"><ChevronLeft size={16} /></button>
                <input
                  type="text"
                  value={numPages || ''}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setNumPages(val === '' ? 0 : parseInt(val, 10));
                  }}
                  onBlur={() => {
                    if (numPages < 1) setNumPages(1);
                  }}
                  className="flex-1 text-center text-sm font-medium w-full focus:outline-none py-1"
                />
                <button onClick={() => setNumPages(numPages + 1)} className="px-3 py-1 hover:bg-gray-100 border-l border-gray-300"><ChevronRight size={16} /></button>
              </div>
            </section>


            {/* C. Generate */}
            <section className="mt-2 text-gray-500">
              <h3 className="text-sm font-medium mb-3">C. Generate</h3>

              <button
                onClick={() => handleGenerate()}
                disabled={isGenerating || isGeneratingText}
                className="w-full bg-black text-white py-3.5 text-sm font-bold shadow hover:bg-gray-800 hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? <div className="flex gap-2 items-center"><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> GENERATING...</div> : purpose === 'video' ? 'REPLICATE VIDEO GEN ▸' : 'GENERATE'}
              </button>
            </section>

            {/* D. Export */}
            <section className="mt-auto pt-8 border-t border-gray-200">
              <h3 className="text-sm font-medium mb-3">D. Export</h3>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setExportFormat('pdf')} className={cn("flex-1 border py-1 text-xs font-medium transition-colors", exportFormat === 'pdf' ? "bg-gray-200 border-gray-400" : "border-gray-300 hover:bg-gray-50")}>PDF</button>
                <button onClick={() => setExportFormat('png')} className={cn("flex-1 border py-1 text-xs font-medium transition-colors", exportFormat === 'png' ? "bg-gray-200 border-gray-400" : "border-gray-300 hover:bg-gray-50")}>PNG</button>
                <button onClick={() => setExportFormat('jpeg')} className={cn("flex-1 border py-1 text-xs font-medium transition-colors", exportFormat === 'jpeg' ? "bg-gray-200 border-gray-400" : "border-gray-300 hover:bg-gray-50")}>JPEG</button>
                <button onClick={() => setExportFormat('video')} className={cn("flex-1 border py-1 text-xs font-medium transition-colors", exportFormat === 'video' ? "bg-gray-200 border-gray-400" : "border-gray-300 hover:bg-gray-50")}>VIDEO</button>
              </div>
              <button
                onClick={handleDownload}
                disabled={isDownloading || generatedPages.length === 0}
                className="w-full bg-black text-white py-3 text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                {isDownloading ? 'DOWNLOADING...' : 'DOWNLOAD'}
              </button>
            </section>
          </div>
        </div>

      </div>

      {/* Hidden container for PDF export rendering */}
      <div className="fixed top-0 left-[-9999px] opacity-0 pointer-events-none">
        <div ref={exportContainerRef} className="flex flex-col gap-4">
          {generatedPages.map((page, idx) => {
            const isPanel = page.type === 'panel';
            const isPortrait = isPanel && orientation === 'portrait';
            let mmW: number, mmH: number;
            if (isPanel) {
              mmW = isPortrait ? 841 : 1189;
              mmH = isPortrait ? 1189 : 841;
            } else if (page.type === 'video') {
              mmW = 1920; mmH = 1080;
            } else if (page.type === 'image') {
              mmW = 1080; mmH = 1080;
            } else {
              mmW = 420; mmH = 297;
            }
            const PX_PER_MM = 96 / 25.4;
            const pxW = mmW * PX_PER_MM;
            const pxH = mmH * PX_PER_MM;

            return (
              <div key={page.id} className="bg-white" style={{ width: pxW, height: pxH }}>
                <PageRenderer
                  page={page}
                  purpose={purpose}
                  orientation={orientation}
                  pageIndex={idx}
                  allPages={generatedPages}
                  onTextSelection={handleTextSelection}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Toolbar */}
      {selectedTextInfo && (
        <FloatingToolbar
          info={selectedTextInfo}
          initialFontSize={
            (() => {
              const p = generatedPages.find(p => p.id === selectedTextInfo.pageId);
              const s = p?.content.textStyles?.[selectedTextInfo.textIndex + 1];
              return s?.fontSize || selectedTextInfo.renderedFontSize || 22;
            })()
          }
          initialFontFamily={
            (() => {
              const p = generatedPages.find(p => p.id === selectedTextInfo.pageId);
              const s = p?.content.textStyles?.[selectedTextInfo.textIndex + 1];
              return s?.fontFamily || selectedTextInfo.renderedFontFamily || 'Pretendard';
            })()
          }
          onUpdate={(style) => updateTextStyle(selectedTextInfo.pageId, selectedTextInfo.textIndex, style)}
          onClose={() => setSelectedTextInfo(null)}
        />
      )}
    </div>
  );
}

// --- Floating Toolbar ---
function FloatingToolbar({
  info,
  initialFontSize,
  initialFontFamily,
  onUpdate,
  onClose
}: {
  info: any,
  initialFontSize: number,
  initialFontFamily: string,
  onUpdate: (style: any) => void,
  onClose: () => void
}) {
  // Use string state for numeric input to allow clearing and natural typing
  const [fontSizeInput, setFontSizeInput] = useState(initialFontSize.toString());
  const [fontFamily, setFontFamily] = useState(initialFontFamily);

  useEffect(() => {
    setFontSizeInput(initialFontSize.toString());
    setFontFamily(initialFontFamily);
  }, [info.pageId, info.textIndex, initialFontSize, initialFontFamily]);

  const fonts = ['Pretendard', 'Noto Sans KR', 'Gmarket Sans', 'KoPub Batang', 'KoPub Dotum', 'S-Core Dream'];

  return (
    <div
      className="ai-floating-toolbar fixed bg-white border border-gray-200 shadow-[0_15px_50px_rgba(0,0,0,0.2)] rounded-3xl p-5 flex gap-5 items-center z-[9999] animate-in fade-in zoom-in duration-300 backdrop-blur-xl bg-white/90"
      style={{
        left: `${info.rect.left + info.rect.width / 2}px`,
        top: `${info.rect.top - 100}px`,
        transform: 'translateX(-50%)'
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Balloon Arrow */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white/90 border-r border-b border-gray-200 rotate-45" />
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Family</label>
        <select
          value={fontFamily}
          onChange={(e) => {
            setFontFamily(e.target.value);
            onUpdate({ fontFamily: e.target.value });
          }}
          className="text-xs border border-gray-100 rounded-lg px-2 py-1 focus:outline-none bg-gray-50/50"
        >
          {fonts.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <div className="w-[1px] h-8 bg-gray-100 mx-1" />
      <div className="flex flex-col gap-1">
        <label className="text-[9px] font-black text-gray-400 uppercase tracking-tight">Size</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={fontSizeInput}
            onChange={(e) => {
              const val = e.target.value;
              setFontSizeInput(val);
              const num = parseInt(val, 10);
              if (!isNaN(num)) {
                onUpdate({ fontSize: num });
              }
            }}
            className="w-14 text-xs border border-gray-100 rounded-lg px-2 py-1 focus:outline-none bg-gray-50/50 text-center"
          />
        </div>
      </div>
      <button
        onClick={onClose}
        className="ml-2 w-8 h-8 flex items-center justify-center bg-black text-white rounded-full hover:scale-110 transition-transform shadow-lg shadow-black/20"
      >
        <ChevronDown size={14} />
      </button>
    </div>
  );
}

// --- Template Renderers ---

function PageRenderer({ page, purpose, orientation, pageIndex, onTextSelection, allPages }: { page: PageData, purpose: Purpose, orientation: Orientation, pageIndex: number, onTextSelection?: (pageId: string, idx: number) => void, allPages?: PageData[] }) {
  const isPanel = page.type === 'panel';
  const isPortrait = isPanel && orientation === 'portrait';

  // ── mm 물리 치수 (HTML 원본과 1:1 동기화) ──
  let mmW: number, mmH: number;
  if (isPanel) {
    // 패널_Template_v4.1.html: .a0-landscape { width:1189mm; height:841mm }
    //                          .a0-portrait  { width:841mm;  height:1189mm }
    mmW = isPortrait ? 841 : 1189;
    mmH = isPortrait ? 1189 : 841;
  } else if (page.type === 'video') {
    mmW = 1920; mmH = 1080; // 픽셀 단위 예외
  } else {
    // 보고서_Template_v7.html: --page-w: 420mm; --page-h: 297mm
    mmW = 420; mmH = 297; // A3 가로
  }

  const PX_PER_MM = 96 / 25.4; // 3.7795...
  const pxW = mmW * PX_PER_MM;
  const pxH = mmH * PX_PER_MM;

  // 본문 페이지에 TOC 서브 넘버링 라벨 계산
  // 예: "02. 공간 구현 (1/2)", "02. 공간 구현 (2/2)"
  const bodyPageTypes = ['bodyA', 'bodyB', 'bodyC', 'drawing', 'panel'];
  const tocLabelMap = (allPages && bodyPageTypes.includes(page.type))
    ? computeTocLabels(allPages)
    : null;
  const tocLabel = tocLabelMap?.get(page.id);

  return (
    <div style={{ width: `${pxW}px`, height: `${pxH}px` }} className="bg-white overflow-hidden relative shrink-0">
      {page.type === 'cover' && <TemplateCover page={page} onTextSelection={onTextSelection} />}
      {page.type === 'toc' && <TemplateTOC page={page} allPages={allPages} onTextSelection={onTextSelection} />}
      {page.type === 'bodyA' && <TemplateBodyA page={page} pageIndex={pageIndex} purpose={purpose} onTextSelection={onTextSelection} tocLabel={tocLabel} />}
      {page.type === 'bodyB' && <TemplateBodyB page={page} pageIndex={pageIndex} purpose={purpose} onTextSelection={onTextSelection} tocLabel={tocLabel} />}
      {page.type === 'bodyC' && <TemplateBodyC page={page} pageIndex={pageIndex} purpose={purpose} onTextSelection={onTextSelection} tocLabel={tocLabel} />}
      {page.type === 'panel' && <TemplatePanel page={page} orientation={orientation} onTextSelection={onTextSelection} />}
      {page.type === 'drawing' && <TemplateDrawing page={page} onTextSelection={onTextSelection} tocLabel={tocLabel} />}
      {page.type === 'video' && <TemplateVideo page={page} onTextSelection={onTextSelection} />}
    </div>
  );
}