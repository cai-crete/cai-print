# 이미지 선택(Selection) 및 삽입(Insertion) 로직 프로토콜 V1.0

본 문서는 'No11. print' 시스템의 이미지 라이브러리 관리와 리포트 내 템플릿 안착(Insertion)을 담당하는 시각 지능 및 데이터 처리 공정을 기술합니다.

---

## 1. 이미지 인식 및 분류 단계 (Recognition)

### Step 1: 라이브러리 스캐닝 및 파일 인식
- **경로**: `public/image library/` 내의 모든 이미지 파일을 스캔합니다.
- **파싱**: 파일명 규칙(`Type-Number.Extension`)을 분석하여 이미지의 종류를 자동 분류합니다. (예: `Section-01.jpg` → 'SECTION' 타입으로 태그 지정)

### Step 2: 사용자 선택 및 우선순위 지정
- **이미지 선택 (Selected)**: 리포트 생성에 반영할 이미지를 다중 선택(Multiple Selection)합니다.
- **히어로 이미지 (Hero Image)**: 가장 중요한 1순위 이미지를 지정하며, 이는 리포트의 표지(Cover) 또는 본문의 핵심 슬롯에 우선 배치되는 가중치를 부여받습니다.

---

## 2. 이미지 삽입 메커니즘 (Insertion Mechanism)

### Step 3: 수동 삽입 (Manual Drag & Drop)
- **이벤트 전송**: 라이브러리(`ImageLibrary`)에서 템플릿 슬롯(`DraggableImage`)으로 드래그 시, 이미지의 `src` 데이터를 포함한 `app-image-drop` 커스텀 이벤트를 발생시킵니다.
- **상태 업데이트**: 전역 상태 관리자(Zustand Store)는 해당 페이지 ID와 이미지 인덱스를 식별하여 `PageData` 내의 `images` 배열을 즉시 업데이트합니다.

### Step 4: AI 지능형 자동 배치 (AI-Driven Placement)
- **이미지-슬롯 매칭 지능**: AI는 각 페이지의 테마(Subtitle)와 이미지의 형태적 특성(가로/세로 비율, 투시도/입면도 여부)을 대조하여 최적의 슬롯에 이미지를 삽입합니다.
- **히어로 우선 배치**: Hero 이미지로 지정된 파일은 템플릿 내에서 가장 물리적 면적이 큰 슬롯에 우선적으로 안착됩니다.

---

## 3. 물리적 안착 및 시각화 규칙 (Physical Fitting)

### Step 5: 비율 유지 및 안착 (No-Cropping)
- **Object-Fit (Contain)**: 모든 이미지는 원본의 가로/세로 비율을 유지하면서 슬롯 내에 최대 크기로 안착됩니다. 상하좌우가 잘리는 'Cover' 방식 대신 원형을 보존하는 'Contain' 방식을 강제합니다.
- **배경 처리**: 이미지가 박스보다 작을 경우, 배경은 정제된 Gray-50 톤으로 처리하여 건축 도면의 순수성을 강조합니다.

### Step 6: 텍스트-이미지 상호 작용 (Content Cleanup)
- **상태 동기화**: 이미지가 삽입되면 해당 슬롯은 '점유(Occupied)' 상태가 되며, 이전에 수립된 'AI 작가 프로토콜'에 의해 해당 이미지에 대한 상세 설명(`text[i]`)이 실시간으로 생성 및 배치됩니다.
- **빈 슬롯 보호**: 이미지가 삽입되지 않은 유휴 슬롯은 텍스트 생성이 억제되어 물리적 공백미를 유지합니다.

---

> [!IMPORTANT]
> 본 삽입 프로토콜은 `src/components/templates/Shared.tsx`의 `DraggableImage` 컴포넌트와 `App.tsx`의 이벤트 핸들러를 통해 전체 시스템에 통합되어 작동합니다.
