import { useState } from "react";
import { Send } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  onSend: (text: string) => void;
  faqKeywords: { id: string; keyword: string }[];
  onFaqClick: (id: string) => void;
}

const FAQ_LABELS: Record<string, string> = {
  ko: "다른 고객님들이 자주 묻는 질문이에요!",
  en: "Frequently asked questions from other customers!",
  zh: "其他顾客经常咨询的问题!",
  ja: "他のお客様からよく寄せられる質問です!",
};

const ChatInput = ({ onSend, faqKeywords, onFaqClick }: Props) => {
  const [text, setText] = useState("");
  const { language } = useLanguage();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="border-t">
      {faqKeywords.length > 0 && (
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-2.5 px-0.5">
            <span className="inline-block w-1 h-3.5 rounded-full bg-[hsl(var(--navy))]" />
            <p className="text-[12px] font-bold text-[hsl(var(--navy))] tracking-tight">
              {FAQ_LABELS[language]}
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {faqKeywords.map((faq) => (
              <button key={faq.id} onClick={() => onFaqClick(faq.id)} className="faq-tag whitespace-nowrap flex-shrink-0">
                #{faq.keyword}
              </button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지를 입력해주세요..."
          className="flex-1 bg-white border border-border rounded-full px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="submit"
          className="send-btn-gradient w-10 h-10 rounded-full flex items-center justify-center text-white"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default ChatInput;
