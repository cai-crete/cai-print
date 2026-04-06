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

const initialLibraryData = {
  A: DEFAULT_IMAGES.filter(img => img.src.includes('/A/')),
  B: DEFAULT_IMAGES.filter(img => img.src.includes('/B/')),
  C: DEFAULT_IMAGES.filter(img => img.src.includes('/C/')),
  D: []
};

export default function App() {
  const [projectType, setProjectType] = useState('auto');
  const [projectKeyword, setProjectKeyword] = useState('');
  const [title, setTitle] = useState('No11. print');
  const [libraryData, setLibraryData] = useState<Record<string, LibraryImage[]>>(initialLibraryData);
  const [images, setImages] = useState<LibraryImage[]>(initialLibraryData['A']);
  const [currentCategory, setCurrentCategory] = useState<'A' | 'B' | 'C' | 'D'>('A');
  const [historyImages, setHistoryImages] = useState<LibraryImage[]>([]);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [textInput, setTextInput] = useState(''); // Initial state is empty string to show placeholder
  const [purpose, setPurpose] = useState<Purpose | null>(null);
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

  // Fetch Image Library from Server
  useEffect(() => {
    fetch('http://localhost:3001/api/list-images')
      .then(res => res.json())
      .then(data => {
        setLibraryData(data);
        if (data[currentCategory]) {
          setImages(data[currentCategory]);
        }
      })
      .catch(err => console.error("Failed to fetch library images:", err));
  }, []);

  // Update displayed images when category changes
  useEffect(() => {
    if (libraryData[currentCategory]) {
      setImages(libraryData[currentCategory]);
    } else {
      setImages([]);
    }
  }, [currentCategory, libraryData]);

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
        const drawingTags = ['[TAG: PLN]', '[TAG: ELV]', '[TAG: SEC]'];

        // Helper to check if image is allowed in drawing
        const isAllowedInDrawing = (src: string) => {
          if (!src) return true;
          const libImg = [...libraryData.A, ...libraryData.B, ...libraryData.C, ...images].find(i => i.src === src);
          return libImg ? drawingTags.includes(libImg.tag || '') : false;
        };

        if (source.source === 'library') {
          // Check drawing restriction
          if (targetPage.type === 'drawing' && !isAllowedInDrawing(source.imgSrc)) {
            alert('도면집에는 평면, 입면, 단면(Floor plan, Elevation, Section) 이미지인 것만 삽입할 수 있습니다.');
            return prevPages;
          }
          // Replace target image with library image
          targetImages[target.imageIndex] = source.imgSrc;
          targetContent.images = targetImages;
          targetPage.content = targetContent;
          newPages[targetPageIndex] = targetPage;
        } else if (source.source === 'preview') {
          // Swap target image with source image
          const sourcePageIndex = newPages.findIndex(p => p.id === source.pageId);
          if (sourcePageIndex === -1) return prevPages;

          const sourcePage = { ...newPages[sourcePageIndex] };
          const sourceContent = { ...sourcePage.content };
          const sourceImages = [...(sourceContent.images || [])];
          const sourceImgSrc = sourceImages[source.imageIndex];

          // Check drawing restriction for both ends if necessary
          if (targetPage.type === 'drawing' && !isAllowedInDrawing(sourceImgSrc)) {
             alert('도면집에는 평면, 입면, 단면(Floor plan, Elevation, Section) 이미지만 삽입할 수 있습니다.');
             return prevPages;
          }
          if (sourcePage.type === 'drawing' && !isAllowedInDrawing(targetImages[target.imageIndex])) {
             alert('도면집에는 평면, 입면, 단면(Floor plan, Elevation, Section) 이미지만 삽입할 수 있습니다.');
             return prevPages;
          }

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
            const newImg = { src: e.target!.result as string, type: 'UPLOADED' };
            setLibraryData(prev => ({
              ...prev,
              D: [newImg, ...(prev.D || [])]
            }));
            setCurrentCategory('D');
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

      const targetImages = selectedImages.length > 0 
        ? selectedImages 
        : (libraryData['A']?.length > 0 ? libraryData['A'].map(i => i.src) : images.map(i => i.src));
      
      // 분석 대상 이미지의 메타데이터(Tag) 포함
      const imagesToAnalyze = targetImages.slice(0, 20);

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

      // ========================================================
      // [SYSTEM PROMPT] 목적별 완전 분리형 프롬프트 구성
      // ========================================================
      const todayDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\s/g, '').replace(/\.$/, '');

      // 영상 모드: 텍스트 생성 완전 차단
      if (currentPurposeForPrompt === 'video') {
        setTextInput('');
        setIsGeneratingText(false);
        return null;
      }

      // --------------- 목적별 프롬프트 분기 ---------------
      let purposeSpecificInstructions = '';

      if (currentPurposeForPrompt === 'report') {
        purposeSpecificInstructions = `
# 문서 목적: 건축 보고서 (Report) — A3 Landscape
당신은 대한민국 최고의 건축 비평 작가입니다. 아래 규칙을 절대 어기지 마십시오.

## 절대 금지 사항
- 'No11. print', 'page 01', 'PAGE', 'P.01' 등 시스템/페이지 번호 텍스트를 절대 포함하지 마십시오.
- 'CRE-TE'를 일반 텍스트 내용에 포함하지 마십시오. (기업명 슬롯 전용)
- **[강제 사항] 리포트 내지 생성 시, 이미지 배열('images')의 해당 칸이 비어 있거나 이미지가 할당되지 않은 경우, 그에 대응하는 이미지 설명(text[2], text[4], text[5] 등) 슬롯은 반드시 빈 문자열("")로 제출해야 합니다. 허위로 작성하거나 상상해서 묘사하는 것을 엄격히 금지합니다.**

## 생성 페이지 수: ${currentNumPages}

## 각 페이지별 텍스트 슬롯 엄격 정의

### [페이지 1: 표지 - cover]
- title: 전체 프로젝트 명칭. 이미지에서 파악한 건축 개념을 기반으로 한 강렬한 영문 제목 (3~6단어).
- text[0]: 28pt 서브타이틀 - 프로젝트 위치 및 핵심 공간 철학 (30자 이내, 영문).
- text[1]: 날짜 - "${todayDate}"
- text[2]: 12pt 키워드 바 - 분석한 핵심 건축 키워드 4개를 ' / ' 로 구분 (예: URBAN / GRID / VOID / LIGHT).
- text[3]: 기업명 - 반드시 "CRE-TE" 고정.

### [페이지 2: 목차 - toc] (${currentNumPages} > 1 인 경우에만 생성)
- title: 표지와 동일한 프로젝트명 (반드시 일치).
- text[0]: 목차 챕터 1 제목 (예: 01 INTRODUCTION)
- text[1]: 목차 챕터 1 소항목 (2줄, 영문)
- text[2] ~ text[11]: 나머지 목차 항목 반복 (챕터 2~6까지, 공백으로 채워도 됨)
- text[3]: 기업명 - 반드시 "CRE-TE" 고정.

### [페이지 3~N: 내지 Body A / B / C]
(페이지 수에 따라 bodyA, bodyB, bodyC 순환)

**모든 내지 공통:**
- title: 반드시 표지(cover)의 title과 동일한 텍스트 (헤더 고정).
- text[3]: 기업명 - 반드시 "CRE-TE" 고정 (우측 상단 로고용).

**Body A (이미지 1개):**
- text[0]: 16pt 페이지 테마 - 이 페이지의 건축 주제 (예: "Site Topology", "Massing Strategy"). 30자 이내.
- text[1]: 11pt 페이지 요약 - 페이지 전체 내용의 학술적 초록. 최대 75자.
- text[2]: 11pt 이미지 스토리 - 이미지의 물성, 빛, 구조를 비평적 시선으로 설명. 3~4줄.

**Body B (이미지 2개):**
- text[0]: 16pt 페이지 테마 (30자 이내)
- text[1]: 11pt 페이지 요약 (최대 75자)
- text[2]: 11pt 좌측 이미지 1 스토리 (3~4줄)
- text[3]: 기업명 - 반드시 "CRE-TE" 고정.
- text[4]: 11pt 우측 이미지 2 스토리 (3~4줄)

**Body C (이미지 3~4개):**
- text[0]: 16pt 페이지 테마 (30자 이내)
- text[1]: 11pt 페이지 요약 (최대 75자)
- text[2]: 11pt 좌측 메인 이미지 스토리 (3~4줄)
- text[3]: 기업명 - 반드시 "CRE-TE" 고정.
- text[4]: 11pt 우측 상단 이미지 스토리 (3~4줄)
- text[5]: 11pt 우측 하단 이미지 스토리 (3~4줄)
`;
      } else if (currentPurposeForPrompt === 'drawing') {
        purposeSpecificInstructions = `
# 문서 목적: 건축 도면집 (Drawing) — A3 Landscape, 도각(Title Block) 포함
당신은 건축사무소의 도면 담당 실무자입니다. 수사적 표현을 완전히 배제하고 기술적 정확성만을 추구합니다.

## 절대 금지 사항
- 'No11. print', 'PAGE', 'page' 등 시스템/페이지 번호 텍스트를 절대 포함하지 마십시오.

## 각 도면 페이지의 텍스트 슬롯 (8개 고정)
각 페이지마다 아래 8개 슬롯을 생성하십시오 (이미지의 종류를 분석하여 채울 것):

- title: 프로젝트명 — **반드시 5~16자 이내의 영문 대문자** (예: "CRE-TE COMPLEX", "URBAN HUB"). 절대 이 범위를 벗어나지 마십시오.
- text[0] (NOTE): 이미지 유형에 맞는 기술적 유의사항, 2~4줄. (예: "1. ALL DIMENSIONS IN MM.\n2. VERIFY ALL CONDITIONS ON SITE.\n3. DO NOT SCALE DRAWINGS.")
- text[1] (DESIGNED BY): 반드시 "CRE-TE" 고정. 다른 값 절대 불가.
- text[2] (ENGINEER): 가상의 한국인 엔지니어 성명 이니셜 (예: "K.H. KIM", "J.W. PARK", "S.Y. LEE")
- text[3] (APPROVED BY): 반드시 "CRE-TE GROUP" 고정.
- text[4] (SCALE): 이미지 유형에 따른 도면 척도. 평면·입면·단면은 "1/100" 또는 "1/200", 배치도는 "1/500", 확인 불가 시 "N.T.S".
- text[5] (DRAWING NO.): 이미지 유형에 따른 건축 도면 번호. 평면은 "A-1xx", 입면은 "A-2xx", 단면은 "A-3xx" 형식.
- text[6] (SHEET NO.): 전체 시트 중 순번. "01 / ${currentNumPages}" 형태 (페이지마다 01, 02... 증가).
- text[7] (FILE NAME): 가상의 CAD 파일명. 프로젝트명을 기반으로 "PROJECT_PLN_01.DWG" 형태.
`;
      } else if (currentPurposeForPrompt === 'panel') {
        purposeSpecificInstructions = `
# 문서 목적: 전시 판넬 (Panel) — A0 대형 판넬 (가로형 1189mm x 841mm, 세로형 841mm x 1189mm)
당신은 전시 기획자이자 건축 비평 작가입니다. 감성적이고 공간적인 언어로 관람자에게 강렬한 인상을 남겨야 합니다.

## 절대 금지 사항
- 'No11. print', 'PAGE', 'page' 등 시스템 텍스트를 절대 포함하지 마십시오.

## 전시 판넬 텍스트 슬롯 (이미지를 분석하여 공간감 있게 작성)

- title: 140pt 대형 메인 타이틀 — 프로젝트의 핵심 정체성을 담은 3단어 이내의 강렬한 영문 제목.
- text[0] (Subtitle): 90pt 서브타이틀 — 타이틀을 보완하는 공간 철학 문구. **30자 이내로 강제**.
- text[1] (Main Body): 30pt 본문 — 프로젝트의 공간적 서사와 사용자 경험. 건축적 산책로(Promenade) 개념으로 풍성하게 서술. 200~350자.
- text[2] (Theme Heading A): 35pt 소제목 A — 공간의 특정 테마 (예: "Urban Void"). **반드시 10자 이내로 강제**.
- text[3] (Theme Body A): 20pt 소제목 A 설명 — 해당 테마의 디자인 의도 상세 설명. 100~180자.
- text[4] (Theme Heading B): 35pt 소제목 B — 다른 공간 테마 (예: "Light Path"). **반드시 10자 이내로 강제**.
- text[5] (Theme Body B): 20pt 소제목 B 설명 — 해당 테마의 디자인 의도 상세 설명. 100~180자.
`;
      }

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

${purposeSpecificInstructions}

# 핵심 실행 규칙 (엄격하게 준수)
1. 모든 'title' 필드는 표지(cover)에서 생성된 타이틀과 완벽히 동일해야 합니다.
2. 'No11. print', 'page', 'PAGE' 등의 시스템 문자열을 어떤 슬롯에도 포함하지 마십시오.
3. 각 슬롯의 지정된 글자 수 제한을 반드시 준수하십시오.
4. 이미지를 최우선으로 분석하고, 텍스트 입력이 없는 경우 이미지에서 추출한 건축 개념으로 모든 슬롯을 채우십시오.
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

    // [가드] Purpose가 선택되지 않은 경우 진행 차단
    if (!promptPurpose) {
      alert('A. Purpose / Size를 선택해주세요.');
      return;
    }

    const currentTextInput = overrideText !== undefined ? overrideText : textInput;
    let currentTitle = overrideTitle !== undefined ? overrideTitle : title;

    // [Phase 8] Extract title from current text input if available
    const fallbackMatch = currentTextInput.match(/\*\*대제목[:\s：]+\*\*\s*(.+)/i) || currentTextInput.match(/\*\s*\*\*대제목[:\s：]+\*\*\s*(.+)/i);
    if (fallbackMatch && (currentTitle === 'No11. print' || !overrideTitle)) {
      currentTitle = fallbackMatch[1].trim().replace(/[*_`]/g, '').trim();
    }

    // [Phase 5] 자동 AI 텍스트 생성 연동: 텍스트가 필요한 모드인데 기본값이면 자동으로 실행
    if (!isAutoGenerate && ['report', 'drawing', 'panel'].includes(promptPurpose) && (textInput === DEFAULT_TEXT_INPUT || textInput.trim() === "")) {
      const result = await handleAutoGenerateText(promptPurpose, numPages, false);
      if (result) {
        await handleGenerate(promptPurpose, true, result.text, result.title);
        return;
      }
    }

    // 비디오 모드: 이미지 선택 여부와 무관하게 video-example-1.mp4 고정 출력
    if (promptPurpose === 'video') {
      setIsGenerating(true);
      try {
        await new Promise(r => setTimeout(r, 5000)); // 5초 딜레이 추가
        const VIDEO_SRC = '/image library/V/video-example-1.mp4';
        const videoPage: import('./types').PageData = {
          id: 'page-0',
          type: 'video',
          content: {
            title: title || 'VIDEO',
            text: [],
            images: [VIDEO_SRC],
            imageDimensions: [{ width: 1920, height: 1080 }],
          }
        };
        setGeneratedPages([videoPage]);
        setCurrentPageIndex(0);
      } catch (e) {
        console.error('Video page creation error:', e);
        alert('비디오 페이지 생성 중 오류가 발생했습니다.');
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    let currentPurpose: Purpose = (typeof overridePurpose === 'string') ? overridePurpose as Purpose : purpose;
    let currentOrientation: Orientation = orientation;

    const combinedText = (title + ' ' + currentTextInput).toLowerCase();

    let resolvedProjectType = projectType;
    if (projectType === 'auto') {
      if (combinedText.includes('상업') || combinedText.includes('commercial')) resolvedProjectType = '상업';
      else if (combinedText.includes('공공') || combinedText.includes('public')) resolvedProjectType = '공공';
      else if (combinedText.includes('복합') || combinedText.includes('mixed')) resolvedProjectType = '복합시설';
      else resolvedProjectType = '주거';
      setProjectType(resolvedProjectType);
    }
    if (combinedText.includes('판넬 -세로')) {
      currentPurpose = 'panel'; currentOrientation = 'portrait';
      setPurpose('panel'); setOrientation('portrait');
    } else if (combinedText.includes('판넬 -가로')) {
      currentPurpose = 'panel'; currentOrientation = 'landscape';
      setPurpose('panel'); setOrientation('landscape');
    }

    setIsGenerating(true);

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
      targetTags = ['[TAG: BEV]', '[TAG: FPV]'];
      reasoningTemplate = '프로젝트의 전체적인 이미지를 잘 보여주는 투시도를 우선 배치하였습니다.';
    }

    let sourceImagesRaw = [...selectedImages];

    // 선택된 이미지가 없을 경우, A 라이브러리의 전체 이미지를 무조건 100% 선택
    if (sourceImagesRaw.length === 0) {
      const baseImages = (libraryData['A'] && libraryData['A'].length > 0) ? libraryData['A'] : images;
      if (baseImages.length > 0) {
        const autoSelected = baseImages.map(i => i.src);
        setSelectedImages(autoSelected);
        sourceImagesRaw = autoSelected;
      }
    }

    const analyzedImages = await Promise.all(sourceImagesRaw.map(async (img) => {
      const libImg = [...libraryData.A, ...libraryData.B, ...libraryData.C, ...images].find(i => i.src === img);
      const tag = libImg?.tag || '[TAG: DIA]';
      const typeLabel = libImg?.type || 'Image';
      const dim = await getImageDimensions(img);
      let score = 50;
      let priority = 3;

      if (img === heroImage) {
        score = 100; priority = 1;
      } else if (['[TAG: BEV]', '[TAG: FPV]', '[TAG: LAV]', '[TAG: INT]'].includes(tag)) {
        score = 80; priority = 2;
      } else if (['[TAG: PLN]', '[TAG: ELV]', '[TAG: SEC]', '[TAG: MST]'].includes(tag)) {
        score = 60; priority = 2;
      } else {
        score = 20; priority = 4;
      }
      return { src: img, tag, title: typeLabel, score, priority, dim };
    }));

    let heroAssigned = false;
    let heroReasoning = '';
    for (let i = 0; i < analyzedImages.length; i++) {
        const imgInfo = analyzedImages[i];
        if (targetTags.includes(imgInfo.tag)) {
            imgInfo.score += 100;
            imgInfo.priority = 1;
            if (!heroAssigned) {
                heroReasoning = `이 프로젝트는 [${resolvedProjectType} / ${projectKeyword || '일반'}]에 해당하므로, ${reasoningTemplate}`;
                heroAssigned = true;
            }
        } else if (imgInfo.priority === 1) {
            imgInfo.priority = 2;
            imgInfo.score = 80;
        }
    }

    analyzedImages.sort((a, b) => b.score - a.score);

    const pageStructures: { type: string, textCount: number, description: string }[] = [];
    const bodyTypes = ['bodyA', 'bodyB', 'bodyC'] as const;

    for (let i = 0; i < numPages; i++) {
      if (currentPurpose === 'drawing') {
        pageStructures.push({ type: 'drawing', textCount: 5, description: "Drawing page." });
      } else if (currentPurpose === 'panel') {
        pageStructures.push({ type: 'panel', textCount: 13, description: "Panel page." });
      } else if (currentPurpose === 'video') {
        pageStructures.push({ type: 'video', textCount: 1, description: "Video page." });
      } else if (currentPurpose === 'report') {
        if (i === 0) pageStructures.push({ type: 'cover', textCount: 4, description: "Cover." });
        else if (i === 1 && numPages > 1) pageStructures.push({ type: 'toc', textCount: 12, description: "TOC." });
        else {
          const type = bodyTypes[Math.max(0, i - 2) % bodyTypes.length];
          // Body A: 4 (0:theme, 1:summary, 2:story, 3:logo)
          // Body B: 5 (0:theme, 1:summary, 2:story1, 3:logo, 4:story2)
          // Body C: 6 (0:theme, 1:summary, 2:story1, 3:logo, 4:story2, 5:story3)
          pageStructures.push({ type, textCount: type === 'bodyA' ? 4 : type === 'bodyB' ? 5 : 6, description: `Body ${type.charAt(4)}.` });
        }
      }
    }

    let generatedContent: any[] = [];
    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '' });
      const todayDate = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\s/g, '').replace(/\.$/, '');

      // 도면집: textCount를 8로 고정 (실제 슬롯 수와 일치)
      const adjustedStructures = pageStructures.map(p => {
        if (p.type === 'drawing') return { ...p, textCount: 8 };
        if (p.type === 'panel') return { ...p, textCount: 6 };
        return p;
      });

      // 슬롯별 지시사항 동적 생성
      const slotInstructions = adjustedStructures.map((p, i) => {
        if (p.type === 'cover') {
          return `Page ${i+1} [COVER]: title=프로젝트명(3~6단어 영문), text[0]=서브타이틀(30자이내), text[1]="${todayDate}", text[2]=키워드4개(예:URBAN/GRID/VOID/LIGHT), text[3]="CRE-TE"`;
        } else if (p.type === 'toc') {
          return `Page ${i+1} [TOC]: title=표지와동일한프로젝트명, text[0~11]=목차항목(영문), text[3]="CRE-TE"`;
        } else if (p.type === 'bodyA') {
          return `Page ${i+1} [BODY-A 이미지1개]: title=표지와동일한프로젝트명, text[0]=페이지테마, text[1]=학술요약, text[2]=이미지스토리(이미지 없을 경우 빈칸), text[3]="CRE-TE"`;
        } else if (p.type === 'bodyB') {
          return `Page ${i+1} [BODY-B 이미지2개]: title=표지와동일한프로젝트명, text[0]=페이지테마, text[1]=학술요약, text[2]=좌측이미지스토리(없으면빈칸), text[3]="CRE-TE", text[4]=우측이미지스토리(없으면빈칸)`;
        } else if (p.type === 'bodyC') {
          return `Page ${i+1} [BODY-C 이미지3~4개]: title=표지와동일한프로젝트명, text[0]=페이지테마, text[1]=학술요약, text[2]=좌측메인스토리(없으면빈칸), text[3]="CRE-TE", text[4]=우측상단스토리(없으면빈칸), text[5]=우측하단스토리(없으면빈칸)`;
        } else if (p.type === 'drawing') {
          return `Page ${i+1} [DRAWING 도면]: title=프로젝트명(5~16자 영문대문자), text[0]=NOTE(기술유의사항2~4줄), text[1]="CRE-TE", text[2]=엔지니어이니셜(예:K.H.KIM), text[3]="CRE-TE GROUP", text[4]=스케일(예:1/100), text[5]=도면번호(예:A-101), text[6]="${String(i+1).padStart(2,'0')} / ${pageStructures.length}", text[7]=파일명(예:PROJECT_PLN_01.DWG)`;
        } else if (p.type === 'panel') {
          return `Page ${i+1} [PANEL 대형판넬]: title=메인타이틀(8~10자 영문 필수, 칸을 넘지 않게 짧게 작성), text[0]=서브타이틀(30자이내), text[1]=본문서사(200~350자), text[2]=소제목A(10자이내 필수), text[3]=소제목A설명(100~180자), text[4]=소제목B(10자이내 필수), text[5]=소제목B설명(100~180자)`;
        }
        return `Page ${i+1} [${p.type}]: title=프로젝트명, ${Array.from({length: p.textCount}, (_, k) => `text[${k}]=내용`).join(', ')}`;
      }).join('\n');

      const prompt = `
${PROMPT_ARCHITECT}

# STRICT JSON GENERATION TASK
이미지를 분석하고 아래 슬롯 지시사항에 따라 JSON 배열을 정확하게 생성하십시오.

## 절대 금지
- 'No11. print', 'page', 'PAGE', 'P.01' 등 시스템 텍스트를 어떤 슬롯에도 포함하지 마십시오.
- title 필드에 표지와 다른 텍스트를 넣지 마십시오 (cover 생성 후 동일 텍스트 복사).
- 글자 수 제한을 초과하지 마십시오.

## 입력 텍스트 (참고용)
${currentTextInput || "Professional architectural placeholder."}

## 슬롯별 생성 지시사항 (총 ${adjustedStructures.length}페이지)
${slotInstructions}

반드시 ${adjustedStructures.length}개의 JSON 객체를 배열로 반환하십시오.
각 객체: { "title": string, "text": string[] }
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
              properties: { title: { type: Type.STRING }, text: { type: Type.ARRAY, items: { type: Type.STRING } } },
              required: ["title", "text"]
            }
          }
        }
      });
      generatedContent = JSON.parse(response.text || "[]");

      // [타이틀 통일] 표지(cover)의 타이틀을 모든 페이지에 동기화
      const coverTitle = generatedContent[0]?.title || currentTitle;
      generatedContent = generatedContent.map((c, i) => ({
        ...c,
        title: i === 0 ? coverTitle : coverTitle  // 전 페이지 동일 타이틀 강제
      }));

    } catch (error) {
      console.error("AI Error:", error);
      const textChunks = textInput.split('\n\n').filter(t => t.trim().length > 0);
      let textIdx = 0;
      generatedContent = pageStructures.map((p, i) => ({
        title: currentTitle,  // 폴백도 동일 타이틀 적용
        text: Array.from({ length: p.type === 'drawing' ? 8 : p.type === 'panel' ? 6 : p.textCount }, () =>
          textChunks[textIdx++ % Math.max(1, textChunks.length)] || '')
      }));
    }


    // --- Filtering and Grouping for Purpose ---
    let finalAnalyzed = [...analyzedImages];
    const drawingTags = ['[TAG: PLN]', '[TAG: ELV]', '[TAG: SEC]'];

    if (currentPurpose === 'drawing') {
      finalAnalyzed = finalAnalyzed.filter(i => drawingTags.includes(i.tag));
    }
    let reportHero: any = null;
    if (currentPurpose === 'report') {
      const heroIdx = finalAnalyzed.findIndex(img => img.src.toLowerCase().includes("bird's eye view -1"));
      if (heroIdx > -1) {
        [reportHero] = finalAnalyzed.splice(heroIdx, 1);
      }
      
      if (currentCategory === 'A') {
        const REPORT_FORCED = [
          { pattern: "low angle view -1", fallback: "LAV" },
          { pattern: "eye level view -1", fallback: "FPV" },
          { pattern: "section -1", fallback: "SEC" },
          { pattern: "perspective image -1", fallback: "LAV" },
          { pattern: "perspective image -2", fallback: "FPV" },
          { pattern: "perspective view -1", fallback: "LAV" },
          { pattern: "diagram -1", fallback: "DIA" },
          { pattern: "diagram -2", fallback: "DIA" },
          { pattern: "elevation -1", fallback: "ELV" },
          { pattern: "floor plan -1", fallback: "PLN" },
          { pattern: "floor plan -2", fallback: "PLN" }
        ];

        const sortedReport: any[] = [];
        let pool = [...finalAnalyzed];
        
        REPORT_FORCED.forEach(forced => {
          let match = pool.find(i => i.src.toLowerCase().includes(forced.pattern));
          if (!match) match = pool.find(i => i.tag.includes(forced.fallback)) || pool[0];
          
          if (match) {
            sortedReport.push(match);
            pool = pool.filter(i => i !== match);
          } else {
            sortedReport.push({ src: '', dim: {width:1,height:1}, tag: '', title: '' });
          }
        });
        
        finalAnalyzed = sortedReport;
      } else {
        const views = finalAnalyzed.filter(i => ['[TAG: FPV]', '[TAG: LAV]', '[TAG: INT]'].includes(i.tag));
        const diagrams = finalAnalyzed.filter(i => i.tag === '[TAG: DIA]');
        const tech = finalAnalyzed.filter(i => drawingTags.includes(i.tag));
        const etc = finalAnalyzed.filter(i => 
          !views.includes(i) && !diagrams.includes(i) && !tech.includes(i)
        );
        
        finalAnalyzed = [...views, ...diagrams, ...tech, ...etc];
      }
    }

    let imgPool = [...finalAnalyzed];

    const getNextImagesIntelligently = (count: number, type: string) => {
      if (type === 'panel') {
        const result: string[] = [];
        const dimsResult: { width: number, height: number }[] = [];
        const tagsResult: string[] = [];
        const titlesResult: string[] = [];

        let pool = [...imgPool];

        if (orientation === 'portrait' && currentCategory === 'A') {
          // Portrait Library A sequence (7 images)
          const PORTRAIT_FORCED = [
            { pattern: "bird's eye view -1", fallback: "BEV" },
            { pattern: "floor plan -1", fallback: "PLN" },
            { pattern: "floor plan -2", fallback: "PLN" },
            { pattern: "diagram -1", fallback: "DIA" },
            { pattern: "diagram -2", fallback: "DIA" },
            { pattern: "perspective view -1", fallback: "LAV" },
            { pattern: "section -1", fallback: "SEC" }
          ];

          PORTRAIT_FORCED.forEach(forced => {
            let match = pool.find(i => i.src.toLowerCase().includes(forced.pattern));
            if (!match) match = pool.find(i => i.tag.includes(forced.fallback)) || pool[0];
            
            if (match) {
              result.push(match.src); dimsResult.push(match.dim);
              tagsResult.push(match.tag); titlesResult.push(match.title);
              pool = pool.filter(i => i.src !== match.src);
            } else {
              result.push(''); dimsResult.push({ width: 1, height: 1 });
              tagsResult.push(''); titlesResult.push('');
            }
          });

          while (result.length < 10) {
            result.push(''); dimsResult.push({ width: 1, height: 1 });
            tagsResult.push(''); titlesResult.push('');
          }
        } else if (orientation === 'landscape' && currentCategory === 'A') {
          // Landscape Library A sequence (5 entries, specifically mapped to slots 0, 6, 7, 8, 9)
          const LANDSCAPE_FORCED = [
            { pattern: "bird's eye view -1", fallback: "BEV" },       // Slot 0 (Hero)
            { pattern: "perspective view -1", fallback: "LAV" },     // Slot 6 (Bottom 1)
            { pattern: "section -1", fallback: "SEC" },              // Slot 7 (Bottom 2)
            { pattern: "perspective image -1", fallback: "LAV" },     // Slot 8 (Bottom 3)
            { pattern: "perspective image -2", fallback: "FPV" }      // Slot 9 (Bottom 4)
          ];

          // Initialize result array with 10 empty entries
          const finalResult = Array(10).fill('');
          const finalDims = Array(10).fill({ width: 1, height: 1 });
          const finalTags = Array(10).fill('');
          const finalTitles = Array(10).fill('');

          const targetSlots = [0, 6, 7, 8, 9];
          LANDSCAPE_FORCED.forEach((forced, idx) => {
            let match = pool.find(i => i.src.toLowerCase().includes(forced.pattern));
            if (!match) match = pool.find(i => i.tag.includes(forced.fallback)) || pool[0];

            if (match) {
              const slot = targetSlots[idx];
              finalResult[slot] = match.src;
              finalDims[slot] = match.dim;
              finalTags[slot] = match.tag;
              finalTitles[slot] = match.title;
              pool = pool.filter(i => i.src !== match.src);
            }
          });

          return { images: finalResult, dims: finalDims, tags: finalTags, titles: finalTitles };
        } else {
          const HERO_TAGS = ['[TAG: BEV]', '[TAG: FPV]', '[TAG: LAV]'];
          const MAIN_TAGS = ['[TAG: PLN]', '[TAG: ELV]', '[TAG: SEC]', '[TAG: MST]'];
          const SUPPORT_TAGS = ['[TAG: DIA]', '[TAG: INT]'];

          // 1. Hero Slot (Slot 0)
          const heroMatch = pool.find(i => HERO_TAGS.includes(i.tag)) || pool[0];
          if (heroMatch) {
            result.push(heroMatch.src); dimsResult.push(heroMatch.dim);
            tagsResult.push(heroMatch.tag); titlesResult.push(heroMatch.title);
            pool = pool.filter(i => i.src !== heroMatch.src);
          }

          // 2. Main Info Slots (Slot 1-2)
          for (let i = 0; i < 2; i++) {
            const mainMatch = pool.find(i => MAIN_TAGS.includes(i.tag)) || pool[0];
            if (mainMatch) {
              result.push(mainMatch.src); dimsResult.push(mainMatch.dim);
              tagsResult.push(mainMatch.tag); titlesResult.push(mainMatch.title);
              pool = pool.filter(i => i.src !== mainMatch.src);
            } else {
              result.push(''); dimsResult.push({ width: 1, height: 1 });
              tagsResult.push(''); titlesResult.push('');
            }
          }

          // 3. Support Slots (Slot 3-5)
          for (let i = 0; i < 3; i++) {
            const supportMatch = pool.find(i => SUPPORT_TAGS.includes(i.tag)) || pool[0];
            if (supportMatch) {
              result.push(supportMatch.src); dimsResult.push(supportMatch.dim);
              tagsResult.push(supportMatch.tag); titlesResult.push(supportMatch.title);
              pool = pool.filter(i => i.src !== supportMatch.src);
            } else {
              result.push(''); dimsResult.push({ width: 1, height: 1 });
              tagsResult.push(''); titlesResult.push('');
            }
          }

          // 4. Forced Bottom 4 Slots (Slot 1-4) for matching Landscape left-to-right sequence
          const FORCED_SEQUENCE = [
            { pattern: "floor plan -1", fallback: "PLN" },
            { pattern: "floor plan -2", fallback: "PLN" },
            { pattern: "perspective", fallback: "LAV" },
            { pattern: "perspective", fallback: "LAV" }
          ];

          FORCED_SEQUENCE.forEach(forced => {
            let match = pool.find(i => i.src.toLowerCase().includes(forced.pattern));
            if (!match) match = pool.find(i => i.tag.includes(forced.fallback)) || pool[0];
            
            if (match) {
              result.push(match.src); dimsResult.push(match.dim);
              tagsResult.push(match.tag); titlesResult.push(match.title);
              pool = pool.filter(i => i.src !== match.src);
            } else {
              result.push(''); dimsResult.push({ width: 1, height: 1 });
              tagsResult.push(''); titlesResult.push('');
            }
          });

          // 5. Remaining Support Slots (Slot 5-9)
          while (result.length < 10) {
            const supportMatch = pool.find(i => SUPPORT_TAGS.includes(i.tag)) || pool[0];
            if (supportMatch) {
              result.push(supportMatch.src); dimsResult.push(supportMatch.dim);
              tagsResult.push(supportMatch.tag); titlesResult.push(supportMatch.title);
              pool = pool.filter(i => i.src !== supportMatch.src);
            } else {
              result.push(''); dimsResult.push({ width: 1, height: 1 });
              tagsResult.push(''); titlesResult.push('');
            }
          }
        }

        if (imgPool.length === 0) imgPool = [...finalAnalyzed];
        return { images: result, dims: dimsResult, tags: tagsResult, titles: titlesResult };
      } else {
        const result = []; const dimsResult = []; const tagsResult = []; const titlesResult = [];
        for (let i = 0; i < count; i++) {
          const it = imgPool.shift(); // 이미 사용된 이미지는 제거됨 (중복 방지)
          result.push(it?.src || '');
          dimsResult.push(it?.dim || { width: 1, height: 1 });
          tagsResult.push(it?.tag || '');
          titlesResult.push(it?.title || '');
        }
        // [중요] imgPool을 다시 채우지 않음 → 이미지가 없으면 빈 슬롯 유지
        return { images: result, dims: dimsResult, tags: tagsResult, titles: titlesResult };
      }

    };

    const newPages: PageData[] = [];
    for (let i = 0; i < numPages; i++) {
      const structure = pageStructures[i];
      const aiContent = generatedContent[i] || { title: `Page ${i + 1}`, text: [] };
      const textArray = [...(aiContent.text || [])];
      while (textArray.length < structure.textCount) textArray.push('');
      let imgCount = structure.type === 'panel' ? 10 : (structure.type === 'bodyB' ? 2 : (structure.type === 'bodyC' ? 3 : 1));
      if (structure.type === 'toc') imgCount = 0;
      let alloc: any;
      if (currentPurpose === 'report' && currentCategory === 'A') {
        // [Library A Report] Deterministic allocation
        if (i === 0) {
          // Cover uses Hero
          alloc = { images: [reportHero?.src || ''], dims: [reportHero?.dim || {width:1,height:1}], tags: [reportHero?.tag || ''], titles: [reportHero?.title || ''] };
        } else if (structure.type === 'toc') {
          alloc = { images: [], dims: [], tags: [], titles: [] };
        } else if (i === 2 && reportHero) {
          // Page 3 Hero 고정
          alloc = { images: [reportHero.src], dims: [reportHero.dim], tags: [reportHero.tag], titles: [reportHero.title] };
        } else {
          // Others consume from imgPool (which is sortedReport)
          alloc = getNextImagesIntelligently(imgCount, structure.type);
        }
      } else if (currentPurpose === 'report' && i === 2 && reportHero) {
        // [Library B/C Report] Force Bird's Eye View -1 for Page 3 (index 2)
        const remaining = getNextImagesIntelligently(imgCount - 1, structure.type);
        alloc = {
          images: [reportHero.src, ...remaining.images],
          dims: [reportHero.dim, ...remaining.dims],
          tags: [reportHero.tag, ...remaining.tags],
          titles: [reportHero.title, ...remaining.titles]
        };
      } else {
        alloc = getNextImagesIntelligently(imgCount, structure.type);
      }

      // [Hard-Clear] 이미지가 단 하나도 없는 경우 텍스트/제목 전체 초기화 로직 강제 적용
      const hasAnyImage = alloc.images.some(img => img && img.trim() !== '');
      let finalTitle = (aiContent.title && aiContent.title !== `Page ${i + 1}`) ? aiContent.title : currentTitle;
      let finalTextArray = [...textArray];

      if (!hasAnyImage && structure.type !== 'toc') {
        // 이미지가 전무한 경우 (목차 제외): 제목, 부제목, 요약, 설명 등 모든 요소를 비웁니다.
        finalTitle = "";
        finalTextArray = finalTextArray.map(() => "");
      } else {
        // 이미지가 일부라도 있는 경우: 개별 슬롯에 매칭되는 이미지가 없으면 해당 설명만 비웁니다.
        if (structure.type === 'bodyA') {
          if (!alloc.images[0]) if (finalTextArray[2]) finalTextArray[2] = "";
        } else if (structure.type === 'bodyB') {
          if (!alloc.images[0]) if (finalTextArray[2]) finalTextArray[2] = "";
          if (!alloc.images[1]) if (finalTextArray[4]) finalTextArray[4] = "";
        } else if (structure.type === 'bodyC') {
          if (!alloc.images[0]) if (finalTextArray[2]) finalTextArray[2] = "";
          if (!alloc.images[1]) if (finalTextArray[4]) finalTextArray[4] = "";
          if (!alloc.images[2]) if (finalTextArray[5]) finalTextArray[5] = "";
        }
      }

      newPages.push({
        id: `page-${i}`,
        type: structure.type as any,
        content: {
          title: finalTitle,
          text: finalTextArray.slice(0, structure.textCount),
          images: alloc.images,
          imageDimensions: alloc.dims,
          imageTags: alloc.tags,
          imageTitles: alloc.titles,
          reasoning: structure.type === 'panel' ? heroReasoning : undefined
        }
      });
    }

    setGeneratedPages(newPages);
    setTimeout(async () => {
      if (!exportContainerRef.current) return;
      await document.fonts.ready;
      const elements = Array.from(exportContainerRef.current.children);
      const snapshots: any[] = [];
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        const canvas = await html2canvas(el, { scale: 0.25, useCORS: true, logging: false, backgroundColor: '#ffffff' });
        snapshots.push({ src: canvas.toDataURL('image/jpeg', 0.8), type: 'GENERATED_TMPL', tag: '[TAG: DIA]' });
      }
      if (snapshots.length > 0) setHistoryImages(prev => [...snapshots, ...prev]);
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

      const purposeMap: Record<string, string> = {
        'report': 'report',
        'drawing': 'drawing & specification',
        'panel': 'panel',
        'video': 'video'
      };
      const purposeName = purposeMap[purpose] || purpose;

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
        pdf.save(`${purposeName}.pdf`);
      } else if (exportFormat === 'video') {
        // video-example-1.mp4 직접 다운로드
        try {
          const VIDEO_SRC = '/image library/V/video-example-1.mp4';
          const res = await fetch(VIDEO_SRC);
          if (!res.ok) throw new Error('Video file not found');
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${purposeName}.mp4`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error('MP4 download error:', e);
          alert('영상 다운로드에 실패했습니다. public/image library/V/video-example-1.mp4 파일을 확인해 주세요.');
        }

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
                const fileName = `${purposeName}_page_${i + 1}.${exportFormat}`;
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
        const rootFolderName = `${purposeName}_images`;
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

        // --- Vercel 배포를 위해 로컬 서버 자동 저장(api/save-images) 렌더링 블록 삭제 및 ZIP 다운로드 우대 ---

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
          <span className="text-xl font-bold tracking-tight text-gray-800">PRINT</span>
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
            <div className="flex items-center gap-3">
              <h2 className="text-[13px] font-black tracking-widest text-black">LIBRARY</h2>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                <button 
                  onClick={() => {
                    const cats: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
                    const idx = cats.indexOf(currentCategory);
                    setCurrentCategory(cats[(idx - 1 + 4) % 4]);
                  }}
                  className="p-1 hover:bg-white rounded transition-all text-gray-500 hover:text-black"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-[10px] font-black w-4 text-center">{currentCategory}</span>
                <button 
                  onClick={() => {
                    const cats: ('A' | 'B' | 'C' | 'D')[] = ['A', 'B', 'C', 'D'];
                    const idx = cats.indexOf(currentCategory);
                    setCurrentCategory(cats[(idx + 1) % 4]);
                  }}
                  className="p-1 hover:bg-white rounded transition-all text-gray-500 hover:text-black"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            <label className="text-[10px] font-semibold tracking-wide border border-black rounded-full px-3 py-1 cursor-pointer hover:bg-black hover:text-white transition-colors">
              UPLOAD FILE
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden w-full">
            <div className="grid grid-cols-3 gap-2 pb-2">
              {images.length === 0 ? (
                <div className="col-span-3 flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
                   <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-40"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                   </div>
                   <div className="text-[11px] font-medium text-center leading-relaxed">
                     저장된 사진이 없습니다.<br />파일을 업로드하세요.
                   </div>
                </div>
              ) : (
                images.map((imgObj, idx) => {
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
                })
              )}
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
            {generatedPages.length > 0 ? (() => {
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
              {generatedPages.length > 0 ? (
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
              <span className="font-black text-base tracking-tight text-black uppercase">PRINT</span>
            </div>

            {/* AI 텍스트 자동생성 (Moved to top as requested) */}
            <section className="transition-all duration-300">
              <h3 className="text-sm font-medium mb-3 flex items-center justify-between">
                <span>AI 텍스트 자동생성</span>
                {isGeneratingText && <div className="w-3 h-3 border-2 border-gray-300 border-t-black rounded-full animate-spin" />}
              </h3>
              <p className="text-[10px] text-gray-400 mb-4 leading-tight">문서 생성 시 이미지와 목적에 맞춰 텍스트가 자동으로 생성됩니다.</p>

              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide block mb-1">내용 검토 및 수정 (Review & Edit)</span>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="내용을 입력하세요"
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
                  onClick={() => { setPurpose('panel'); setOrientation(null); }}
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
      className="ai-floating-toolbar fixed border border-gray-200 shadow-[0_15px_50px_rgba(0,0,0,0.2)] rounded-3xl p-5 flex gap-5 items-center z-9999 animate-in fade-in zoom-in duration-300 backdrop-blur-xl bg-white/90"
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
      <div className="w-px h-8 bg-gray-100 mx-1" />
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
