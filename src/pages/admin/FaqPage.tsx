import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import LanguageTabs from "@/components/admin/LanguageTabs";
import { LangCode } from "@/contexts/LanguageContext";

type Faq = Tables<"faq_keywords">;

const FaqPage = () => {
  const [lang, setLang] = useState<LangCode>("ko");
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Faq | null>(null);
  const [form, setForm] = useState({ keyword: "", answer_html: "", sort_order: 0, search_keywords: "" });

  const load = async () => {
    const { data } = await supabase
      .from("faq_keywords")
      .select("*")
      .eq("language", lang)
      .order("sort_order");
    setFaqs(data || []);
  };

  useEffect(() => { load(); }, [lang]);

  const handleSave = async () => {
    if (!form.keyword.trim()) { toast.error("키워드를 입력해주세요."); return; }
    if (editing) {
      await supabase.from("faq_keywords").update(form).eq("id", editing.id);
      toast.success("수정 완료");
    } else {
      await supabase.from("faq_keywords").insert({ ...form, language: lang });
      toast.success("추가 완료");
    }
    setOpen(false);
    setEditing(null);
    setForm({ keyword: "", answer_html: "", sort_order: 0, search_keywords: "" });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("faq_keywords").delete().eq("id", id);
    toast.success("삭제 완료");
    load();
  };

  const openEdit = (faq: Faq) => {
    setEditing(faq);
    setForm({ keyword: faq.keyword, answer_html: faq.answer_html, sort_order: faq.sort_order, search_keywords: (faq as any).search_keywords || "" });
    setOpen(true);
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">FAQ 키워드 관리</h1>
      <LanguageTabs value={lang} onChange={setLang} />
      <div className="flex items-center justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setForm({ keyword: "", answer_html: "", sort_order: faqs.length, search_keywords: "" }); }}>
              <Plus className="w-4 h-4 mr-1" />추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "FAQ 수정" : "FAQ 추가"} ({lang.toUpperCase()})</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">키워드 (#태그로 표시)</label>
                <Input value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} placeholder="예: 사은행사 참여가능매장" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">검색 인식 키워드 (콤마로 구분)</label>
                <Input value={form.search_keywords} onChange={(e) => setForm({ ...form, search_keywords: e.target.value })} placeholder="예: 삼성페이, 애플페이, 쓱페이" />
                <p className="text-xs text-muted-foreground mt-1">고객이 입력할 수 있는 다양한 표현을 콤마(,)로 구분하여 등록하세요.</p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">답변</label>
                <RichTextEditor value={form.answer_html} onChange={(html) => setForm({ ...form, answer_html: html })} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">정렬 순서</label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
              <Button onClick={handleSave} className="w-full">{editing ? "수정" : "추가"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">순서</TableHead>
            <TableHead>키워드</TableHead>
            <TableHead>답변 (미리보기)</TableHead>
            <TableHead className="w-24">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {faqs.map((faq) => (
            <TableRow key={faq.id}>
              <TableCell>{faq.sort_order}</TableCell>
              <TableCell className="font-medium">#{faq.keyword}</TableCell>
              <TableCell className="max-w-xs truncate text-muted-foreground text-sm">{faq.answer_html.replace(/<[^>]*>/g, "").slice(0, 80)}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(faq)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(faq.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {faqs.length === 0 && (
            <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">등록된 FAQ가 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default FaqPage;
