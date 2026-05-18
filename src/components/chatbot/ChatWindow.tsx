import { useState, useEffect, useRef } from "react";
import { ArrowUp } from "lucide-react";
import ChatHeader from "./ChatHeader";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import {
  type ChatMessage,
  getCategories,
  getRootNodes,
  getChildNodes,
  getNodeById,
  getFaqKeywords,
  askAgent,
} from "@/lib/chatbot-engine";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useLanguage, UI_TEXTS } from "@/contexts/LanguageContext";

const ChatWindow = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [faqKeywords, setFaqKeywords] = useState<{ id: string; keyword: string; answer_html: string }[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { language } = useLanguage();
  const { settings } = useSiteSettings(language);
  const t = UI_TEXTS[language];

  useEffect(() => {
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, settings.welcome_message]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadInitial = async () => {
    const [cats, faqs] = await Promise.all([getCategories(language), getFaqKeywords(language)]);
    setFaqKeywords(faqs);
    const welcomeMsg: ChatMessage = {
      id: crypto.randomUUID(),
      type: "bot",
      content: settings.welcome_message,
      banners: cats.map((c) => ({ id: c.id, name: c.name, icon: c.icon || undefined })),
    };
    setMessages([welcomeMsg]);
  };

  const addMessage = (msg: ChatMessage) => setMessages((prev) => [...prev, msg]);

  const handleBannerClick = async (categoryId: string, name: string) => {
    addMessage({ id: crypto.randomUUID(), type: "user", content: name });
    const nodes = await getRootNodes(categoryId, language);
    if (nodes.length === 0) {
      addMessage({ id: crypto.randomUUID(), type: "bot", content: t.noItems });
      return;
    }
    addMessage({
      id: crypto.randomUUID(),
      type: "bot",
      content: t.selectFromCategory(name),
      buttons: nodes.map((n) => ({ id: n.id, label: n.label })),
    });
  };

  const handleButtonClick = async (nodeId: string, label: string) => {
    addMessage({ id: crypto.randomUUID(), type: "user", content: label });
    const node = await getNodeById(nodeId);
    if (!node) return;

    if (node.answer_html) {
      const lb = Array.isArray((node as any).link_buttons) ? (node as any).link_buttons : [];
      addMessage({
        id: crypto.randomUUID(),
        type: "bot",
        content: node.answer_html,
        isHtml: true,
        linkButtons: lb,
      });
      return;
    }

    const children = await getChildNodes(nodeId, language);
    if (children.length > 0) {
      addMessage({
        id: crypto.randomUUID(),
        type: "bot",
        content: node.message || t.selectFromCategory(label),
        buttons: children.map((c) => ({ id: c.id, label: c.label })),
      });
    } else {
      addMessage({ id: crypto.randomUUID(), type: "bot", content: t.noAnswer });
    }
  };

  const handleSend = async (text: string) => {
    addMessage({ id: crypto.randomUUID(), type: "user", content: text });

    // Typing indicator
    const typingId = crypto.randomUUID();
    addMessage({ id: typingId, type: "bot", content: t.thinking || "..." });

    const results = await askAgent(text, language, { aiModel: settings.ai_model });

    // Remove typing indicator
    setMessages((prev) => prev.filter((m) => m.id !== typingId));

    if (results.length > 0) {
      results.forEach((msg) => addMessage(msg));
    } else {
      addMessage({
        id: crypto.randomUUID(),
        type: "bot",
        content: settings.no_result_message.replace(/\\n/g, "\n"),
      });
    }
  };

  const handleFaqClick = (id: string) => {
    const faq = faqKeywords.find((f) => f.id === id);
    if (!faq) return;
    addMessage({ id: crypto.randomUUID(), type: "user", content: `#${faq.keyword}` });
    addMessage({ id: crypto.randomUUID(), type: "bot", content: faq.answer_html, isHtml: true });
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-card shadow-2xl shadow-[hsl(var(--navy-deep)/0.25)] border-x border-border/50">
      <ChatHeader />
      <div className="flex-1 relative overflow-hidden gradient-bg">
        <div
          ref={scrollRef}
          onScroll={(e) => setShowScrollTop((e.target as HTMLDivElement).scrollTop > 200)}
          className="h-full overflow-y-auto p-4 space-y-3 scrollbar-thin"
        >
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              onButtonClick={handleButtonClick}
              onBannerClick={handleBannerClick}
            />
          ))}
          <div ref={bottomRef} />
        </div>
        {showScrollTop && (
          <button
            onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="맨 위로"
            className="absolute bottom-4 right-4 w-9 h-9 rounded-full bg-white/40 backdrop-blur-md text-[hsl(var(--navy-deep))] border border-[hsl(var(--navy)/0.15)] shadow-sm hover:bg-white/60 hover:-translate-y-0.5 transition-all flex items-center justify-center z-10 animate-fade-in"
          >
            <ArrowUp size={16} />
          </button>
        )}
      </div>
      <ChatInput onSend={handleSend} faqKeywords={faqKeywords} onFaqClick={handleFaqClick} />
    </div>
  );
};

export default ChatWindow;
