// src/hooks/useAutoFitText.ts
// 텍스트가 컨테이너를 넘칠 때 폰트 크기를 점진적으로 축소하는 커스텀 훅
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface AutoFitOptions {
  /** 텍스트가 변경될 때마다 재실행할 의존 값 */
  deps?: any[];
  /** 최소 허용 폰트 크기 (px). 기본값: 원본의 70% */
  minScaleRatio?: number;
  /** 한 번에 줄이는 비율 (0~1). 기본값: 0.97 (3%씩 감소) */
  stepRatio?: number;
}

/**
 * 텍스트 요소(textRef)가 컨테이너(containerRef)를 넘칠 때
 * 폰트 크기를 자동으로 줄여주는 훅.
 *
 * @param textRef     - 텍스트 DOM 요소
 * @param containerRef - 크기를 기준으로 삼을 컨테이너 DOM 요소 (없으면 textRef의 부모 사용)
 * @param options      - 세부 옵션
 */
export function useAutoFitText(
  textRef: RefObject<HTMLElement>,
  containerRef?: RefObject<HTMLElement>,
  options: AutoFitOptions = {}
) {
  const { deps = [], minScaleRatio = 0.70, stepRatio = 0.97 } = options;
  const originalFontSizeRef = useRef<number | null>(null);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const container = containerRef?.current ?? el.parentElement;
    if (!container) return;

    // 현재 폰트 크기를 원본으로 기록 (처음 한 번만)
    if (originalFontSizeRef.current === null) {
      originalFontSizeRef.current = parseFloat(getComputedStyle(el).fontSize);
    }

    const originalSize = originalFontSizeRef.current;
    const minSize = originalSize * minScaleRatio;

    // 폰트 크기를 원본으로 리셋 후 오버플로우 체크
    el.style.fontSize = '';

    let currentSize = parseFloat(getComputedStyle(el).fontSize);

    // scrollHeight가 clientHeight를 초과하는 동안 폰트 크기 감소
    let iterations = 0;
    while (
      el.scrollHeight > container.clientHeight + 2 && // +2px 여유
      currentSize > minSize &&
      iterations < 200
    ) {
      currentSize = Math.max(currentSize * stepRatio, minSize);
      el.style.fontSize = `${currentSize.toFixed(2)}px`;
      iterations++;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
