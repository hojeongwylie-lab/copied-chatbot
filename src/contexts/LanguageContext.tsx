import { createContext, useContext, useState, ReactNode } from "react";

export type LangCode = "ko" | "en" | "zh" | "ja";

export const LANGUAGES: { code: LangCode; label: string; short: string }[] = [
  { code: "ko", label: "한국어", short: "KOR" },
  { code: "en", label: "English", short: "ENG" },
  { code: "zh", label: "中文", short: "CHN" },
  { code: "ja", label: "日本語", short: "JPN" },
];

interface LanguageContextValue {
  language: LangCode;
  setLanguage: (l: LangCode) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<LangCode>("ko");
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};

// Default UI strings per language for hardcoded fallbacks
export const UI_TEXTS: Record<LangCode, {
  welcome: string;
  selectCategory: string;
  selectFromCategory: (name: string) => string;
  noItems: string;
  noAnswer: string;
  brandSingle: (brand: string, brandEn: string, store: string, category: string, url: string) => string;
  brandMulti: (brand: string, brandEn: string, stores: string, links: string) => string;
  inputPlaceholder: string;
  send: string;
  defaultNoResult: string;
  thinking: string;
}> = {
  ko: {
    welcome: "안녕하세요! 신세계사이먼 프리미엄 아울렛입니다.\n아래 항목 중 문의사항을 선택해주세요.",
    selectCategory: "문의하실 내용을 선택해주세요.",
    selectFromCategory: (n) => `${n}에 대해 문의하실 내용을 선택해주세요.`,
    noItems: "등록된 항목이 없습니다.",
    noAnswer: "등록된 답변이 없습니다.",
    brandSingle: (b, be, s, c, u) =>
      `네~ <strong>${b}</strong>(${be})이(가) <strong>${s}</strong>에 입점해 있습니다.<br/>카테고리: ${c}<br/>자세한 브랜드 정보는 아래 링크를 클릭해주세요.<br/><a href="${u}" target="_blank" class="underline text-blue-600">${u}</a>`,
    brandMulti: (b, be, ss, links) =>
      `네~ <strong>${b}</strong>(${be})이(가) [${ss}]에 입점해 있습니다.<br/>각 점포의 상세 정보는 아래 링크를 확인해주세요.<br/><br/>${links}`,
    inputPlaceholder: "메시지를 입력하세요...",
    send: "전송",
    defaultNoResult: "죄송합니다. 관련 내용을 찾을 수 없습니다.\n아래 카테고리에서 원하시는 항목을 선택해주세요.",
    thinking: "답변을 작성 중입니다...",
  },
  en: {
    welcome: "Hello! Welcome to Shinsegae Simon Premium Outlets.\nPlease select an inquiry below.",
    selectCategory: "Please select your inquiry.",
    selectFromCategory: (n) => `Please select an item related to "${n}".`,
    noItems: "No items registered.",
    noAnswer: "No answer registered.",
    brandSingle: (b, be, s, c, u) =>
      `Yes! <strong>${b}</strong> (${be}) is located at <strong>${s}</strong>.<br/>Category: ${c}<br/>For more details, please click the link below.<br/><a href="${u}" target="_blank" class="underline text-blue-600">${u}</a>`,
    brandMulti: (b, be, ss, links) =>
      `Yes! <strong>${b}</strong> (${be}) is located at [${ss}].<br/>Please check the links below for details on each store.<br/><br/>${links}`,
    inputPlaceholder: "Type a message...",
    send: "Send",
    defaultNoResult: "Sorry, no related content was found.\nPlease select an item from the categories below.",
    thinking: "Composing a response...",
  },
  zh: {
    welcome: "您好!欢迎来到新世界西蒙名牌奥特莱斯。\n请从下方选择咨询事项。",
    selectCategory: "请选择您的咨询内容。",
    selectFromCategory: (n) => `请选择与"${n}"相关的项目。`,
    noItems: "暂无注册项目。",
    noAnswer: "暂无注册答案。",
    brandSingle: (b, be, s, c, u) =>
      `是的~ <strong>${b}</strong>(${be})已入驻 <strong>${s}</strong>。<br/>分类:${c}<br/>详细品牌信息请点击下方链接。<br/><a href="${u}" target="_blank" class="underline text-blue-600">${u}</a>`,
    brandMulti: (b, be, ss, links) =>
      `是的~ <strong>${b}</strong>(${be})已入驻 [${ss}]。<br/>各店铺的详细信息请查看下方链接。<br/><br/>${links}`,
    inputPlaceholder: "输入消息...",
    send: "发送",
    defaultNoResult: "抱歉,未找到相关内容。\n请从下方分类中选择您需要的项目。",
    thinking: "正在生成回答...",
  },
  ja: {
    welcome: "こんにちは!新世界サイモン・プレミアムアウトレットです。\n以下の項目からお問い合わせ内容をお選びください。",
    selectCategory: "お問い合わせ内容をお選びください。",
    selectFromCategory: (n) => `「${n}」に関する項目をお選びください。`,
    noItems: "登録された項目がありません。",
    noAnswer: "登録された回答がありません。",
    brandSingle: (b, be, s, c, u) =>
      `はい~ <strong>${b}</strong>(${be})は <strong>${s}</strong> に入店しております。<br/>カテゴリ:${c}<br/>詳しいブランド情報は下記リンクをクリックしてください。<br/><a href="${u}" target="_blank" class="underline text-blue-600">${u}</a>`,
    brandMulti: (b, be, ss, links) =>
      `はい~ <strong>${b}</strong>(${be})は [${ss}] に入店しております。<br/>各店舗の詳細情報は下記リンクをご確認ください。<br/><br/>${links}`,
    inputPlaceholder: "メッセージを入力...",
    send: "送信",
    defaultNoResult: "申し訳ございません。関連する内容が見つかりませんでした。\n以下のカテゴリからご希望の項目をお選びください。",
    thinking: "回答を作成中...",
  },
};
