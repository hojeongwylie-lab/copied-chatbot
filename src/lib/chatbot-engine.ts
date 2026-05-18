import { supabase } from "@/integrations/supabase/client";
import { LangCode } from "@/contexts/LanguageContext";

export interface LinkButton {
  label: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  type: "bot" | "user";
  content: string;
  isHtml?: boolean;
  buttons?: { id: string; label: string }[];
  banners?: { id: string; name: string; icon?: string }[];
  linkButtons?: LinkButton[];
}

export interface AskAgentOptions {
  aiModel?: string;
}

/**
 * Ask the AI agent a free-form question.
 * The agent reads FAQ + scenarios + brand info from the DB and composes an answer
 * grounded ONLY in those sources. Falls back to customer-service redirect when unsure.
 */
export async function askAgent(
  input: string,
  lang: LangCode = "ko",
  options: AskAgentOptions = {}
): Promise<ChatMessage[]> {
  try {
    const { data, error } = await supabase.functions.invoke("intent-router", {
      body: {
        userMessage: input,
        language: lang,
        model: options.aiModel,
      },
    });

    if (error || !data?.answer_html) {
      console.warn("agent failed", error);
      return [];
    }

    return [
      {
        id: crypto.randomUUID(),
        type: "bot",
        content: data.answer_html,
        isHtml: true,
      },
    ];
  } catch (e) {
    console.warn("askAgent exception", e);
    return [];
  }
}

export async function getCategories(lang: LangCode = "ko") {
  const { data } = await supabase
    .from("chat_categories")
    .select("*")
    .eq("is_active", true)
    .eq("language", lang)
    .order("sort_order");
  return data || [];
}

export async function getChildNodes(parentId: string, lang: LangCode = "ko") {
  const { data } = await supabase
    .from("scenario_nodes")
    .select("*")
    .eq("parent_id", parentId)
    .eq("is_active", true)
    .eq("language", lang)
    .order("sort_order");
  return data || [];
}

export async function getRootNodes(categoryId: string, lang: LangCode = "ko") {
  const { data } = await supabase
    .from("scenario_nodes")
    .select("*")
    .eq("category_id", categoryId)
    .is("parent_id", null)
    .eq("is_active", true)
    .eq("language", lang)
    .order("sort_order");
  return data || [];
}

export async function getNodeById(nodeId: string) {
  const { data } = await supabase
    .from("scenario_nodes")
    .select("*")
    .eq("id", nodeId)
    .single();
  return data;
}

export async function getFaqKeywords(lang: LangCode = "ko") {
  const { data } = await supabase
    .from("faq_keywords")
    .select("*")
    .eq("is_active", true)
    .eq("language", lang)
    .order("sort_order");
  return data || [];
}
