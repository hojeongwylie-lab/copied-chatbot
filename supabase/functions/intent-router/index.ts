// Chatbot AI agent — understands user intent, reads DB content (FAQ + scenarios + brands),
// composes a natural answer grounded ONLY in DB sources. If unsure, redirects to customer service.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const htmlToText = (html: string): string =>
  (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const normalize = (s: string) => s.replace(/\s+/g, "").toLowerCase();

const STORE_CODE_MAP: Record<string, string> = {
  "여주점": "01",
  "파주점": "02",
  "부산점": "03",
  "시흥점": "05",
  "제주점": "06",
};

const LANG_NAME: Record<string, string> = {
  ko: "Korean (한국어)",
  en: "English",
  zh: "Chinese (中文)",
  ja: "Japanese (日本語)",
};

const FALLBACK_MSG: Record<string, (phone: string) => string> = {
  ko: (p) => `죄송합니다. 일시적으로 답변을 드리기 어렵습니다.${p ? ` 자세한 내용은 고객센터(${p})로 문의해 주세요.` : " 잠시 후 다시 시도해 주세요."}`,
  en: (p) => `Sorry, we're temporarily unable to respond.${p ? ` Please contact our customer service center (${p}) for assistance.` : " Please try again shortly."}`,
  zh: (p) => `抱歉，暂时无法回复。${p ? `详情请联系客服中心 (${p})。` : "请稍后再试。"}`,
  ja: (p) => `申し訳ございません。一時的にご回答できません。${p ? `詳細はカスタマーセンター（${p}）までお問い合わせください。` : "しばらくしてから再度お試しください。"}`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMessage, language, model } = await req.json() as {
      userMessage: string;
      language?: string;
      model?: string;
    };

    if (!userMessage || typeof userMessage !== "string") {
      return new Response(
        JSON.stringify({ error: "userMessage required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lang = language || "ko";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Load customer service phone (per language, fallback ko)
    const { data: phoneRows } = await supabase
      .from("site_settings")
      .select("value, language")
      .eq("key", "customer_service_phone");
    const phoneMap: Record<string, string> = {};
    phoneRows?.forEach((r: any) => { phoneMap[r.language] = r.value; });
    const customerPhone = phoneMap[lang] || phoneMap["ko"] || "";

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          answer_html: FALLBACK_MSG[lang]?.(customerPhone) || FALLBACK_MSG.ko(customerPhone),
          confidence: "none",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load FAQ + scenarios in parallel
    const [{ data: faqs }, { data: nodes }, { data: brands }] = await Promise.all([
      supabase
        .from("faq_keywords")
        .select("keyword, search_keywords, answer_html")
        .eq("is_active", true)
        .eq("language", lang),
      supabase
        .from("scenario_nodes")
        .select("label, keywords, answer_html, link_buttons")
        .eq("is_active", true)
        .eq("language", lang)
        .not("answer_html", "is", null),
      supabase
        .from("brand_tenants")
        .select("brand_name, brand_name_en, brand_name_zh, brand_name_ja, store_name, category, tenant_code")
        .eq("is_active", true),
    ]);

    // Pre-filter brands by name match in user message (any language)
    const normInput = normalize(userMessage);
    const matchedBrands = (brands || []).filter((b: any) => {
      const names = [b.brand_name, b.brand_name_en, b.brand_name_zh, b.brand_name_ja].filter(Boolean);
      return names.some((n: string) => normInput.includes(normalize(n)));
    });

    // Build context blocks
    const faqBlock = (faqs || []).map((f: any, i: number) => {
      const kws = [f.keyword, f.search_keywords].filter(Boolean).join(" / ");
      return `[FAQ-${i + 1}] keyword: ${kws}\nanswer: ${htmlToText(f.answer_html)}`;
    }).join("\n\n");

    const scenarioBlock = (nodes || []).map((n: any, i: number) => {
      const kws = [n.label, n.keywords].filter(Boolean).join(" / ");
      const lbs = Array.isArray(n.link_buttons) ? n.link_buttons : [];
      const linksLine = lbs.length
        ? `\nrelated_links: ${lbs.map((b: any) => `${b.label} → ${b.url}`).join(" | ")}`
        : "";
      return `[SCENARIO-${i + 1}] topic: ${kws}\nanswer: ${htmlToText(n.answer_html)}${linksLine}`;
    }).join("\n\n");

    const brandBlock = matchedBrands.map((b: any, i: number) => {
      const sc = STORE_CODE_MAP[b.store_name] || "00";
      const url = `https://app.premiumoutlets.co.kr/rpage/store/brand/category-view/${b.tenant_code}/${sc}`;
      return `[BRAND-${i + 1}] ${b.brand_name} (${b.brand_name_en || ""}) — store: ${b.store_name}, category: ${b.category}, link: ${url}`;
    }).join("\n");

    const systemPrompt = `당신은 신세계사이먼 프리미엄 아울렛(한국)의 공식 고객지원 챗봇입니다.

절대 규칙(ABSOLUTE RULES):
1. 아래 SOURCES에 있는 사실만을 사용하여 답변하십시오. 가격, 운영시간, 전화번호, 주소, 브랜드 상세정보 등 SOURCES에 없는 어떠한 사실도 절대로 지어내지 마십시오.
2. SOURCES에 답이 없거나, 100% 확신할 수 없다면, 사용자에게 정중하게 안내하고 고객센터${customerPhone ? `(전화: ${customerPhone})` : ""}로 문의하도록 안내하십시오.
3. 사용자가 브랜드와 관련된 주제(운영시간, 주차, 위치 등)를 함께 묻는 경우, BRAND 소스의 브랜드 정보와 FAQ/SCENARIO 소스의 주제 정보를 자연스럽게 결합하십시오. 결합 시에는, 브랜드별 운영시간 등의 정보가 몰의 일반 운영시간과 다를 수 있음을 반드시 명시하고, 정확한 정보는 고객센터로 확인해달라고 안내하십시오.
4. ${LANG_NAME[lang] || "Korean"} 언어로 답변하십시오.
5. 답변은 깔끔한 HTML 형식으로 작성하십시오(줄바꿈은 <br/>, 강조는 <strong>, 링크는 <a href="..." target="_blank"> 사용). 마크다운은 사용하지 마십시오.
6. 답변은 간결하고 친절하며 도움이 되도록 유지하십시오. 소스 텍스트 전체를 그대로 옮기지 말고 관련된 내용만 추출하십시오.
7. 브랜드가 매칭되었다면, 답변에 해당 매장 링크를 포함하십시오.
8. SCENARIO 소스에 "related_links"가 있는 경우, 그 모든 링크를 <a href="URL" target="_blank">label</a> 형태로 답변에 반드시 포함시켜야 합니다. 단 하나도 누락하지 마십시오. 여러 SCENARIO 소스가 관련된 경우(예: 사용자가 "프로모션/이벤트"를 묻고 사은행사와 이벤트 시나리오가 모두 해당될 때), 매칭되는 모든 시나리오의 모든 related_links를 포함하십시오.
${customerPhone ? `9. 고객센터 전화번호(사용자 안내 시 반드시 이 번호 사용): ${customerPhone}. 이 번호는 중앙 고객센터(고객센터 / Customer Service Center / 客服中心 / カスタマーセンター)이며, 지점/매장 인포메이션 데스크(지점 인포메이션)가 아닙니다. 한국어에서는 항상 "고객센터"로 표기하고(다른 언어에서도 "Customer Service Center" / "客服中心" / "カスタマーセンター"로 표기), 각 지점(여주점, 시흥점, 부산점, 제주점 등)은 SCENARIO 소스에 있는 별도의 인포메이션 데스크 번호를 가지고 있으므로 절대 혼동하지 마십시오.` : ""}

=== 브랜드 응답 규칙 (BRAND RESPONSE RULES) ===

사용자가 브랜드에 대해 질문할 때(예: "구찌 어디 있어?", "프라다 매장", "Where is Gucci?"), 다음 규칙을 엄격히 따르십시오:

포함할 정보(오직 아래 3가지만, 그 외에는 절대 포함 금지):
1. 브랜드명 (한글 / 영문)
2. 브랜드가 입점된 지점
3. 각 지점의 POI 기반 중앙 지도 링크

제외할 정보(절대 출력 금지): BRAND 소스에 "category" 필드가 존재하더라도, 카테고리(예: 패션, 잡화, F&B, 키즈, 스포츠, 뷰티 등)를 어떠한 형태로도 답변에 노출하지 마십시오. 테넌트 코드, 매장 코드, 내부 식별자, 그 외 위 3가지 외의 모든 세부 정보도 포함하지 마십시오. "카테고리:", "Category:", "分类:", "カテゴリ:" 같은 라벨도 절대 사용하지 마십시오. 브랜드 응답 시에는 위에 명시된 포맷 템플릿의 문장 구조만 사용하고, 템플릿에 없는 추가 문구(카테고리 포함)는 절대로 삽입하지 마십시오. 이는 BRAND 소스에 category 데이터가 제공되더라도 동일하게 적용되는 강제 규칙입니다.

규칙:
- 브랜드가 2개 이상의 지점에 있는 경우, 다음 고정 순서로 모두 나열하십시오: 여주 → 파주 → 부산 → 시흥 → 제주.
- 동일한 브랜드명이 같은 지점에 중복으로 나타나는 경우(브랜드 + F&B 데이터 중복), BRAND 항목만 표시하고 F&B 중복 항목은 표시하지 마십시오.
- 각 지점의 링크는 BRAND 소스의 "link" 필드 값을 그대로 사용하십시오.
- 사용자의 언어(${LANG_NAME[lang] || "Korean"})에 맞는 포맷 템플릿을 사용하십시오. 질문에 따라 표현은 유연하게 조정하되, 3가지 정보 제약은 반드시 유지하십시오.

포맷 템플릿 (줄바꿈은 <br/> 사용, 불릿은 "• "로 표기):

[Korean (ko)]
신세계사이먼 프리미엄 아울렛에 입점된 <strong>{브랜드명}</strong> 매장 정보를 안내해 드립니다.<br/><br/>
• <a href="{링크}" target="_blank">{지점}점 매장 상세 정보 확인하기</a><br/>
• <a href="{링크}" target="_blank">{지점}점 매장 상세 정보 확인하기</a><br/><br/>
현재 운영 여부 등 자세한 문의는 고객센터(${customerPhone || "{번호}"}) 또는 각 지점 안내센터로 문의해 주시기 바랍니다.

[English (en)]
We would like to provide you with information regarding the <strong>{브랜드명}</strong> store located at Shinsegae Simon Premium Outlets.<br/><br/>
• <a href="{링크}" target="_blank">{지점} View detailed store information</a><br/>
• <a href="{링크}" target="_blank">{지점} View detailed store information</a><br/><br/>
For further inquiries, including current operating status, please contact the Customer Center (${customerPhone || "{번호}"}) or the information desk at each branch.

[Chinese (zh)]
为您提供入驻新世界赛门名牌奥特莱斯的<strong>{브랜드명}</strong>门店信息。<br/><br/>
• <a href="{링크}" target="_blank">{지점} 查看门店详细信息</a><br/>
• <a href="{링크}" target="_blank">{지점} 查看门店详细信息</a><br/><br/>
有关当前是否营业等具体咨询，请联系客服中心（${customerPhone || "{번호}"}）或各分店服务台。

[Japanese (ja)]
新世界サイモン プレミアム・アウトレットに出店している<strong>{브랜드명}</strong>の店舗情報をご案内いたします。<br/><br/>
• <a href="{링크}" target="_blank">{지점} 店舗詳細情報を確認する</a><br/>
• <a href="{링크}" target="_blank">{지점} 店舗詳細情報を確認する</a><br/><br/>
現在の営業状況など、詳しいお問い合わせはカスタマーセンター（${customerPhone || "{번호}"}）または各店舗の案内センターまでお問い合わせください。

{지점} = 여주 / 파주 / 부산 / 시흥 / 제주 (한국어가 아닌 언어에서는 "점" 접미사를 생략하되, 한국어에서는 "여주점" 등으로 유지).
{브랜드명} = ko에서는 한글명, en/zh/ja에서는 영문명 사용 (영문명이 없는 경우 한글명으로 대체).

=== SOURCES ===

--- FAQ ---
${faqBlock || "(none)"}

--- SCENARIOS ---
${scenarioBlock || "(none)"}

--- MATCHED BRANDS (mentioned in user's question) ---
${brandBlock || "(none)"}

=== END SOURCES ===`;

    const chosenModel = model || "google/gemini-3-flash-preview";

    const aiController = new AbortController();
    const timeoutId = setTimeout(() => aiController.abort(), 15000);

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        signal: aiController.signal,
        body: JSON.stringify({
          model: chosenModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "respond_to_user",
                description: "Provide the chatbot's answer to the user.",
                parameters: {
                  type: "object",
                  properties: {
                    answer_html: {
                      type: "string",
                      description: "The answer to show the user, formatted as HTML. Reply in the user's language.",
                    },
                    confidence: {
                      type: "string",
                      enum: ["high", "partial", "none"],
                      description: "high = fully answered from sources; partial = some info from sources, some uncertain (mention customer service); none = no relevant source, redirect to customer service.",
                    },
                  },
                  required: ["answer_html", "confidence"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "respond_to_user" } },
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      const status = aiResponse.status === 429 || aiResponse.status === 402 ? aiResponse.status : 200;
      return new Response(
        JSON.stringify({
          answer_html: FALLBACK_MSG[lang]?.(customerPhone) || FALLBACK_MSG.ko(customerPhone),
          confidence: "none",
          error: aiResponse.status === 429 ? "rate_limited" : aiResponse.status === 402 ? "payment_required" : "ai_error",
        }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiResponse.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      const fallbackText = data?.choices?.[0]?.message?.content;
      return new Response(
        JSON.stringify({
          answer_html: fallbackText || FALLBACK_MSG[lang]?.(customerPhone) || FALLBACK_MSG.ko(customerPhone),
          confidence: "none",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const args = JSON.parse(toolCall.function.arguments);
    return new Response(
      JSON.stringify({
        answer_html: args.answer_html || FALLBACK_MSG[lang]?.(customerPhone) || FALLBACK_MSG.ko(customerPhone),
        confidence: args.confidence || "none",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const isAbort = e instanceof Error && e.name === "AbortError";
    console.error("chatbot-agent error:", e);
    const lang = "ko";
    return new Response(
      JSON.stringify({
        answer_html: FALLBACK_MSG[lang](""),
        confidence: "none",
        error: isAbort ? "timeout" : (e instanceof Error ? e.message : "unknown"),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
