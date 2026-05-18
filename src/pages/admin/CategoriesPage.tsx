import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import LanguageTabs from "@/components/admin/LanguageTabs";
import { LangCode } from "@/contexts/LanguageContext";

type Category = Tables<"chat_categories">;

const CategoriesPage = () => {
  const [lang, setLang] = useState<LangCode>("ko");
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", icon: "", sort_order: 0 });

  const load = async () => {
    const { data } = await supabase
      .from("chat_categories")
      .select("*")
      .eq("language", lang)
      .order("sort_order");
    setCategories(data || []);
  };

  useEffect(() => { load(); }, [lang]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("이름을 입력해주세요."); return; }
    if (editing) {
      await supabase.from("chat_categories").update({ name: form.name, icon: form.icon || null, sort_order: form.sort_order }).eq("id", editing.id);
      toast.success("수정 완료");
    } else {
      await supabase.from("chat_categories").insert({ name: form.name, icon: form.icon || null, sort_order: form.sort_order, language: lang });
      toast.success("추가 완료");
    }
    setOpen(false);
    setEditing(null);
    setForm({ name: "", icon: "", sort_order: 0 });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("chat_categories").delete().eq("id", id);
    toast.success("삭제 완료");
    load();
  };

  const openEdit = (cat: Category) => {
    setEditing(cat);
    setForm({ name: cat.name, icon: cat.icon || "", sort_order: cat.sort_order });
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", icon: "", sort_order: categories.length });
    setOpen(true);
  };

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">카테고리 관리 (메인 배너)</h1>
      <LanguageTabs value={lang} onChange={setLang} />
      <div className="flex items-center justify-end mb-4">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" />추가</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "카테고리 수정" : "카테고리 추가"} ({lang.toUpperCase()})</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-1">이름</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 지점안내" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">아이콘 (이모지)</label>
                <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="예: 🏬" />
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
            <TableHead className="w-16">아이콘</TableHead>
            <TableHead>이름</TableHead>
            <TableHead className="w-20">노출</TableHead>
            <TableHead className="w-24">관리</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat) => (
            <TableRow key={cat.id}>
              <TableCell>{cat.sort_order}</TableCell>
              <TableCell>{cat.icon}</TableCell>
              <TableCell className="font-medium">{cat.name}</TableCell>
              <TableCell>
                <Switch
                  checked={cat.is_active}
                  onCheckedChange={async (checked) => {
                    await supabase.from("chat_categories").update({ is_active: checked }).eq("id", cat.id);
                    toast.success(checked ? "노출 ON" : "노출 OFF");
                    load();
                  }}
                />
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {categories.length === 0 && (
            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">등록된 카테고리가 없습니다.</TableCell></TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default CategoriesPage;
