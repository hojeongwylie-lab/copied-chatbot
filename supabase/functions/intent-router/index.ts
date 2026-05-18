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

    const systemPrompt = `You are the official customer support chatbot for Shinsegae Simon Premium Outlets in Korea.

ABSOLUTE RULES:
1. Answer ONLY using facts from the SOURCES below. NEVER invent prices, hours, phone numbers, addresses, brand details, or any other facts not present in the sources.
2. If the sources don't contain the answer, OR you're not 100% sure, tell the user politely and direct them to the customer service center${customerPhone ? ` (phone: ${customerPhone})` : ""}.
3. If the user asks about a brand AND a related topic (like hours, parking, location), combine the brand info from BRAND sources with the topic info from FAQ/SCENARIO sources naturally. When combining, ALWAYS clarify that information like brand-specific operating hours may differ from the mall's general hours and ask them to confirm with customer service for exact details.
4. Reply in ${LANG_NAME[lang] || "Korean"}.
5. Format the answer as clean HTML (use <br/> for line breaks, <strong> for emphasis, <a href="..." target="_blank"> for links). No markdown.
6. Keep answers concise, friendly, and helpful. Don't dump entire source texts — extract what's relevant.
7. If a brand was matched, include its store link in the answer.
8. When a SCENARIO source has "related_links", you MUST include EVERY one of those links as <a href="URL" target="_blank">label</a> in your answer. Do NOT skip any. If multiple SCENARIO sources are relevant (e.g., user asks about "promotions/events" and both 사은행사 and 이벤트 scenarios apply), include ALL related_links from ALL matching scenarios.
${customerPhone ? `9. Customer service phone (use this exact number when referring users): ${customerPhone}. This number is the CENTRAL CUSTOMER SERVICE CENTER (고객센터 / Customer Service Center / 客服中心 / カスタマーセンター) — NOT a branch/store information desk (지점 인포메이션). Always label it as "고객센터" in Korean (or the equivalent "Customer Service Center" / "客服中心" / "カスタマーセンター" in other languages). Each branch (여주점, 시흥점, 부산점, 제주점, etc.) has its OWN separate information desk number found in the SCENARIO sources — never confuse the two.` : ""}

=== BRAND RESPONSE RULES (브랜드 관련 질문 응답 규칙) ===

When the user asks about a BRAND (e.g., "구찌 어디 있어?", "프라다 매장", "Where is Gucci?"), follow these rules STRICTLY:

INCLUDED INFO (only these 3, nothing else):
1. Brand name (Korean / English)
2. Branch(es) where the brand is located (지점)
3. POI-based center map link for each branch

EXCLUDE: brand category, tenant code, or any other detail. Do NOT mention category.

RULES:
- If the brand is in 2+ branches, list ALL of them in this fixed order: 여주 → 파주 → 부산 → 시흥 → 제주.
- If the same brand name appears duplicated at the same branch (brand + F&B data overlap), show the BRAND entry only (not the F&B duplicate).
- The link for each branch is the BRAND source "link" field — use exactly that URL.
- Use the format template matching the USER'S LANGUAGE (${LANG_NAME[lang] || "Korean"}). Adapt wording flexibly to the question, but keep the 3-info constraint.

FORMAT TEMPLATES (use <br/> for line breaks, render bullets as "• "):

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

{지점} = 여주 / 파주 / 부산 / 시흥 / 제주 (drop the "점" suffix in non-Korean languages but keep it in Korean as "여주점" etc.).
{브랜드명} = Korean name in ko, English name in en/zh/ja (fallback to Korean if English missing).

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
