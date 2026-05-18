# AI 챗봇 동작 방식 전면 개편

## 현재 동작의 한계

- 사용자가 "여주점 구찌 운영시간"을 물어도 → "구찌"는 브랜드, "운영시간"은 시나리오에 따로 매칭되어 **두 답변이 분리되어** 출력됨
- AI 라우터가 켜져 있어도 **기존 키워드 매칭에 걸린 후보들 중에서 고르는 역할**만 하므로, 키워드가 안 잡히면 답변 불가
- 시나리오와 브랜드 정보를 **엮어서 자연스러운 답변을 생성하지 못함**

## 목표 동작

```text
[사용자 질문]
   ↓
[AI 에이전트]
   - DB 전체 컨텍스트 (FAQ + 시나리오 + 매칭 가능한 브랜드 정보) 받음
   - 의도 파악 → 관련 자료 골라서 자연스럽게 엮어 답변 생성
   - 단, 답변 내용은 반드시 DB 자료에 근거
   - 확실하지 않은 부분은 "정확한 정보는 고객센터로 문의" 안내
   - 전혀 관련 자료가 없으면 → 고객센터 번호만 안내
```

### 예시
- 입력: "여주점 구찌 운영시간 알려줘"
- AI 처리:
  - 브랜드 DB에서 "구찌 / 여주점" 매칭 → 매장 위치/카테고리 정보
  - 시나리오 DB에서 "여주점 영업시간" 정보
  - 답변 생성: "여주점 구찌 매장은 ○○관에 위치해 있고, 여주점 영업시간은 평일 ○○시~○○시입니다. 다만 개별 브랜드 매장의 운영시간은 다를 수 있으니, 정확한 시간은 고객센터(☎ XXX-XXXX)로 문의해 주세요."

---

## 변경 사항

### 1. Edge Function 전면 재작성 — `supabase/functions/intent-router/index.ts` → `chatbot-agent`로 역할 전환

**입력**: `{ userMessage, language }`

**처리**:
1. DB에서 활성화된 모든 컨텍스트 로드 (해당 언어 기준)
   - `faq_keywords`: 키워드 + 답변 HTML
   - `scenario_nodes`: 라벨 + 키워드 + 답변 HTML (answer가 있는 노드만)
   - `brand_tenants`: 사용자 메시지에 매칭되는 브랜드 (이름 부분 매칭으로 사전 필터, 없으면 전체에서 AI가 판단할 수 있게 일부 전달)
   - `site_settings`에서 고객센터 번호 (신규 키 `customer_service_phone`)
2. Lovable AI Gateway 호출 (`google/gemini-3-flash-preview` 기본, 어드민 설정으로 변경 가능)
   - System prompt: "당신은 신세계사이먼 프리미엄 아울렛 챗봇입니다. 아래 자료**만** 근거로 답변하세요. 자료에 없는 사실은 절대 만들어내지 말고, 고객센터로 안내하세요. 부분적으로만 답할 수 있으면 답할 수 있는 만큼 답하고 나머지는 고객센터로 안내하세요. 답변은 한국어(또는 사용자 언어)로 친절하고 간결하게."
   - 입력 컨텍스트: FAQ 목록, 시나리오 목록, 매칭된 브랜드 목록, 고객센터 번호
   - Tool calling으로 구조화: `{ answer_html, used_sources: string[], confidence: "high"|"partial"|"none" }`
3. AI 응답을 그대로 클라이언트에 반환

**폴백**: AI 호출 실패/타임아웃(10초) → "죄송합니다. 잠시 후 다시 시도하시거나 고객센터로 문의해 주세요" 메시지 + 고객센터 번호

### 2. `src/lib/chatbot-engine.ts` 단순화

- 기존의 `collectCandidates`, `collectAllItems`, `runIntentRouter`, 키워드 매칭 로직 **모두 제거**
- `searchByKeyword(input, lang, options)`을 `askAgent(input, lang)`으로 단순화
  - 단순히 `chatbot-agent` edge function 호출
  - 반환된 `answer_html`을 단일 `ChatMessage`로 변환
- 기존 카테고리/시나리오 트리 탐색 함수들 (`getCategories`, `getRootNodes`, `getChildNodes`, `getNodeById`, `getFaqKeywords`)은 **유지** (배너/버튼 UI에서 계속 사용)

### 3. `src/components/chatbot/ChatWindow.tsx` 수정

- `handleSend`에서 `searchByKeyword` 호출을 `askAgent`로 교체
- AI ON/OFF 분기 제거 (항상 AI 사용)
- 결과가 비어있는 경우 처리 로직 단순화 (edge function이 항상 답변 또는 고객센터 안내를 반환하므로)

### 4. 어드민 설정 페이지 수정 — `src/pages/admin/SettingsPage.tsx`

- "AI 의도 분류 사용" 토글 → **제거** (항상 ON)
- 다음 항목 추가/유지:
  - **고객센터 번호** (신규 입력 필드, 언어별 저장) — AI가 답변 못할 때 안내할 번호
  - **AI 모델 선택** (유지)
  - 안내 문구 변경: "AI가 등록된 FAQ/시나리오/브랜드 정보를 바탕으로 고객 질문에 자동 답변합니다. 답할 수 없는 질문은 고객센터로 안내됩니다."

### 5. `src/hooks/useSiteSettings.ts` 수정

- `ai_router_enabled` 제거
- `customer_service_phone` 추가 (언어별)

### 6. DB 마이그레이션

- `site_settings`에 언어별 `customer_service_phone` 4행 insert (기본값: 빈 문자열, 어드민이 입력)
- 기존 `ai_router_enabled` row 삭제 (선택)

---

## 비용 / 성능 고려사항

- **모든 사용자 질문마다 AI 호출** → 기존(키워드 1개 매칭 시 AI 미호출) 대비 호출량 증가
- 기본 모델 `google/gemini-3-flash-preview`는 빠르고 저렴 → 분당 수십~수백 요청은 무리 없음
- 컨텍스트 크기: FAQ + 시나리오가 많아져도 텍스트 기반이므로 토큰 비용은 낮음. 너무 커지면 시나리오는 `keywords` 기준으로 사전 필터링하는 옵션 검토
- Lovable AI 무료 한도 초과 시 402 에러 → 사용자에게 "고객센터로 문의" 메시지 표시

---

## 영향 받는 파일

- `supabase/functions/intent-router/index.ts` — 전면 재작성 (또는 신규 `chatbot-agent`로 교체, 기존 삭제)
- `src/lib/chatbot-engine.ts` — 매칭 로직 제거, 단순 호출로 변경
- `src/components/chatbot/ChatWindow.tsx` — handleSend 단순화
- `src/hooks/useSiteSettings.ts` — 필드 교체
- `src/pages/admin/SettingsPage.tsx` — AI 토글 제거, 고객센터 번호 입력 추가
- DB 마이그레이션: `customer_service_phone` 4개 언어 row 추가
- 메모리 업데이트: `mem://constraints/logic-engine` (키워드 매칭 → AI 에이전트 기반으로 변경)

---

## 확인 부탁드립니다

1. **고객센터 번호**를 어드민이 직접 입력하는 방식이 맞나요? 아니면 제가 기본값으로 넣어둘 번호가 있나요?
2. **응답 언어**: 사용자가 한국어로 물으면 한국어, 영어로 물으면 영어로 답하게 할까요? 아니면 챗봇 UI 언어 기준으로 고정할까요? (현재 계획은 UI 언어 기준)
3. **시나리오 트리(배너 → 버튼) UI는 그대로 유지**합니다. 자유 입력만 AI가 처리합니다. 맞나요?

승인하시면 위 순서대로 구현하겠습니다.