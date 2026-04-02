# CAI Canvas 프로젝트 인수인계 문서 (초보자 가이드)

이 문서는 **CAI Canvas** 프로젝트의 현재 상태와 주요 기능, 그리고 내부 작동 원리를 초보자도 이해할 수 있도록 상세히 설명합니다.

---

## 1. 프로젝트 개요
**CAI Canvas**는 건축가를 위한 AI 기반 그래픽 및 리포트 생성 도구입니다. 사용자가 이미지를 클라우드나 로컬 라이브러리에서 선택하면, AI가 이를 분석하여 보고서(Report), 패널(Panel), 도면(Drawing) 등의 레이아웃을 자동으로 생성하고 관련 텍스트를 작성해 줍니다.

### 주요 기술 스택
- **Frontend**: React (TypeScript), Vite
- **Styling**: Tailwind CSS, Vanilla CSS
- **State Management**: Zustand (전역 상태 관리)
- **AI**: Google Gemini 1.5 Flash (텍스트 및 이미지 분석)
- **Backend (Mock)**: 환경 설정에 따라 로컬 서버나 API와 통신

---

## 2. 주요 폴더 및 파일 구조

### `src/App.tsx`
프로젝트의 **심장**부입니다. 다음과 같은 핵심 로직이 들어 있습니다.
- **이미지 선택 로직 (`getNextImagesIntelligently`)**: 선택된 라이브러리(A, B, C)와 목적(Purpose)에 따라 이미지를 지능적으로 배정합니다.
- **보고서 생성 제어 (`handleGenerate`)**: AI에게 어떤 순서로 페이지를 만들지 명령하고, 생성된 데이터를 상태에 저장합니다.

### `src/components/templates/`
AI가 생성한 데이터를 화면에 그리는 **도면 설계도(템플릿)**들입니다.
- `TemplateReport.tsx`: 여러 페이지로 구성된 보고서 형식.
- `TemplatePanel.tsx`: 공모전 패널과 같은 대형 레이아웃.
- `TemplatePhysical.tsx`: 실제 출력 규격(mm)에 맞춘 레이아웃.

### `src/hooks/`
- `useAutoFitText.ts`: 글자 수가 많으면 폰트 크기를 자동으로 줄여서 상자 밖으로 넘치지 않게 조절하는 핵심 로직입니다.

### `src/writer/`
AI가 글을 쓸 때 참고하는 **지침서**들이 모여 있습니다.
- `PROMPT_건축작가.txt`: AI가 건축 전문가처럼 말하도록 만드는 지시문.
- `언어분석 10가지 기술 v1.md`: 글의 품질을 높이기 위한 세부 규칙.

---

## 3. 핵심 시스템 작동 원리

### A. 지능형 이미지 배치 (Image Selection)
우리는 단순히 이미지를 무작위로 넣지 않습니다. 각 이미지는 'BEV(Bird's Eye View)', 'SEC(Section)', 'PLN(Floor Plan)' 등의 **태그**를 가집니다.
- **Library A(고정 모드)**: 정해진 순서(`조감도 -> 평면도 -> 단면도...`)대로 이미지를 강제 배치합니다.
- **기타 라이브러리**: AI가 태그를 보고 가장 적합한 위치를 찾아 배치합니다.

### B. 텍스트 자동 피팅 (Auto-fit Text)
템플릿의 글자 상자 크기는 고정되어 있지만, AI가 쓰는 글의 길이는 매번 다릅니다.
- `useAutoFitText` 훅이 글자 상자의 너비와 높이를 실시간으로 감시하여, 텍스트가 넘치면 폰트 크기를 미세하게 조정합니다.

### C. Gemini AI 연동
- 사용자가 'Generate'를 누르면 `App.tsx`에서 Gemini API를 호출합니다.
- AI는 이미지의 특징을 분석하고, 건축적 맥락에 맞는 제목과 설명을 생성하여 JSON 형태로 반환합니다.

---

## 4. 운영 및 수정 가이드

### 새로운 템플릿을 추가하고 싶다면?
1. `src/components/templates/`에 새로운 `.tsx` 파일을 만듭니다.
2. `App.tsx`의 `handleGenerate` 로직에서 해당 템플릿을 호출하도록 추가합니다.

### AI의 말투를 바꾸고 싶다면?
- `src/writer/PROMPT_건축작가.txt` 파일의 내용을 수정하면 AI가 생성하는 모든 글의 톤앤매너가 바뀝니다.

### 이미지 순서 규칙을 바꾸고 싶다면?
- `src/App.tsx` 파일 내의 `getNextImagesIntelligently` 함수 내부 로직을 수정하세요.

---

## 5. 주의 사항 (Tips)
- **환경 변수**: `.env` 파일에 `VITE_GEMINI_API_KEY`가 올바르게 설정되어 있어야 AI 기능이 작동합니다.
- **이미지 경로**: 모든 이미지는 `public/image library/` 폴더 구조를 따르며, 파일 이름에 포함된 키워드로 태그를 인식합니다.

---

이 문서는 2026년 4월 2일 기준으로 작성되었습니다. 프로젝트의 진화에 따라 `task.md`나 `walkthrough.md` 파일들을 수시로 확인하여 변경 이력을 파악하시기 바랍니다.
