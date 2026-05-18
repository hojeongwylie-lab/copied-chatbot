import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Save, Sparkles } from "lucide-react";
import LanguageTabs from "@/components/admin/LanguageTabs";
import { LangCode } from "@/contexts/LanguageContext";

const AI_MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (빠름·저렴, 기본)" },
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (가장 빠름)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (균형)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (정확도 최고)" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano (빠름)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini (정확도 높음)" },
];

const SettingsPage = () => {
  const [lang, setLang] = useState<LangCode>("ko");
  const [botName, setBotName] = useState("");
  const [botSubtitle, setBotSubtitle] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [noResultMessage, setNoResultMessage] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiModel, setAiModel] = useState("google/gemini-3-flash-preview");
  const [savingAi, setSavingAi] = useState(false);

  useEffect(() => {
    loadSettings();
    loadAiSettings();
  }, [lang]);

  const loadAiSettings = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["ai_model"]);
    const map: Record<string, string> = {};
    data?.forEach((row: any) => { map[row.key] = row.value; });
    setAiModel(map.ai_model || "google/gemini-3-flash-preview");
  };

  const handleSaveAi = async () => {
    setSavingAi(true);
    try {
      await supabase.from("site_settings").upsert(
        { key: "ai_model", value: aiModel, language: "ko" },
        { onConflict: "key,language" }
      );
      toast.success("AI 설정이 저장되었습니다.");
    } catch (err: any) {
      toast.error("저장 실패: " + err.message);
    } finally {
      setSavingAi(false);
    }
  };

  const loadSettings = async () => {
    const { data } = await supabase
      .from("site_settings")
      .select("key, value")
      .eq("language", lang);
    const map: Record<string, string> = {};
    if (data) {
      data.forEach((row: { key: string; value: string }) => { map[row.key] = row.value; });
    }
    setBotName(map.bot_name || "");
    setBotSubtitle(map.bot_subtitle || "");
    setLogoUrl(map.bot_logo_url || "");
    setNoResultMessage(map.no_result_message || "");
    setWelcomeMessage(map.welcome_message || "");
    setCustomerPhone(map.customer_service_phone || "");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `bot-logo-${lang}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("logos").upload(fileName, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("logos").getPublicUrl(fileName);
      setLogoUrl(publicUrl);
      toast.success("로고가 업로드되었습니다.");
    } catch (err: any) {
      toast.error("업로드 실패: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: "bot_name", value: botName },
        { key: "bot_subtitle", value: botSubtitle },
        { key: "bot_logo_url", value: logoUrl },
        { key: "no_result_message", value: noResultMessage },
        { key: "welcome_message", value: welcomeMessage },
        { key: "customer_service_phone", value: customerPhone },
      ];
      for (const u of updates) {
        await supabase
          .from("site_settings")
          .upsert({ key: u.key, value: u.value, language: lang }, { onConflict: "key,language" });
      }
      toast.success("설정이 저장되었습니다.");
    } catch (err: any) {
      toast.error("저장 실패: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-bold mb-3">관리자 설정</h1>
      <LanguageTabs value={lang} onChange={setLang} />
      <p className="text-xs text-muted-foreground mb-4">언어별로 챗봇 이름, 부제, 안내 문구, 고객센터 번호를 각각 설정할 수 있습니다.</p>
      <div className="space-y-6">
        <div>
          <label className="text-sm font-medium block mb-2">챗봇 로고</label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center overflow-hidden border-2 border-border">
              {logoUrl ? (
                <img src={logoUrl} alt="Bot logo" className="w-full h-full object-cover" />
              ) : (
                <span className="text-primary-foreground font-bold text-lg">SS</span>
              )}
            </div>
            <div>
              <label htmlFor="logo-upload">
                <Button variant="outline" asChild disabled={uploading}>
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-1" />
                    {uploading ? "업로드 중..." : "이미지 업로드"}
                  </span>
                </Button>
              </label>
              <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <p className="text-xs text-muted-foreground mt-1">언어별로 별도 로고를 설정할 수 있습니다.</p>
            </div>
          </div>
          {logoUrl && (
            <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => setLogoUrl("")}>
              로고 제거
            </Button>
          )}
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">챗봇 이름</label>
          <Input value={botName} onChange={(e) => setBotName(e.target.value)} placeholder="예: 신세계사이먼" />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">챗봇 부제</label>
          <Input value={botSubtitle} onChange={(e) => setBotSubtitle(e.target.value)} placeholder="예: 프리미엄 아울렛 고객센터" />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">환영 메시지</label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="챗봇 첫 화면에 표시되는 인사말"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">검색 결과 없음 안내 문구</label>
          <textarea
            className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={noResultMessage}
            onChange={(e) => setNoResultMessage(e.target.value)}
            placeholder="검색 결과가 없을 때 표시되는 메시지"
          />
        </div>

        <div>
          <label className="text-sm font-medium block mb-1">
            고객센터 번호 <span className="text-destructive">*</span>
          </label>
          <Input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="예: 1577-0000"
          />
          <p className="text-xs text-muted-foreground mt-1">
            AI가 답변할 수 없거나 확신이 없을 때 안내할 고객센터 번호입니다. 언어별로 설정 가능합니다.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          <Save className="w-4 h-4 mr-1" />
          {saving ? "저장 중..." : `${lang.toUpperCase()} 설정 저장`}
        </Button>
      </div>

      {/* AI Agent Section (global, language-independent) */}
      <div className="mt-10 pt-6 border-t">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-[hsl(var(--navy))]" />
          <h2 className="text-lg font-bold">AI 챗봇 설정 (전역)</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          AI가 등록된 <strong>FAQ, 시나리오, 브랜드 정보</strong>를 바탕으로 고객 질문의 의도를 파악하고 자연스럽게 엮어 답변합니다.
          답변은 <strong>반드시 등록된 자료에만 근거</strong>하며, 답할 수 없는 질문은 자동으로 고객센터로 안내됩니다.
        </p>

        <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
          <div>
            <label className="text-sm font-medium block mb-1">AI 모델</label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {AI_MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              빠르고 저렴한 모델은 단순 질문에, 정확도 높은 모델은 복합 질문에 적합합니다.
            </p>
          </div>

          <Button onClick={handleSaveAi} disabled={savingAi} variant="secondary" className="w-full">
            <Save className="w-4 h-4 mr-1" />
            {savingAi ? "저장 중..." : "AI 설정 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
