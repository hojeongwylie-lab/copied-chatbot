import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import RichTextEditor from "@/components/admin/RichTextEditor";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ChevronRight, ChevronDown, Pencil, Trash2, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import LanguageTabs from "@/components/admin/LanguageTabs";
import { LangCode } from "@/contexts/LanguageContext";

type Category = Tables<"chat_categories">;
type Node = Tables<"scenario_nodes">;

interface TreeNode extends Node {
  children: TreeNode[];
  expanded?: boolean;
}

const ScenariosPage = () => {
  const [lang, setLang] = useState<LangCode>("ko");
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [nodes, setNodes] = useState<Node[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Node | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({
    label: "", message: "", answer_html: "", keywords: "", sort_order: 0,
    link_buttons: [] as { label: string; url: string }[],
  });

  // Reload categories when language changes
  useEffect(() => {
    supabase
      .from("chat_categories")
      .select("*")
      .eq("language", lang)
      .order("sort_order")
      .then(({ data }) => {
        setCategories(data || []);
        if (data && data.length > 0) {
          setSelectedCat(data[0].id);
        } else {
          setSelectedCat("");
          setNodes([]);
        }
      });
  }, [lang]);

  useEffect(() => {
    if (selectedCat) loadNodes();
  }, [selectedCat]);

  const loadNodes = async () => {
    const { data } = await supabase
      .from("scenario_nodes")
      .select("*")
      .eq("category_id", selectedCat)
      .eq("language", lang)
      .order("sort_order");
    setNodes(data || []);
  };

  const buildTree = (parentId: string | null): TreeNode[] => {
    return nodes
      .filter((n) => n.parent_id === parentId)
      .map((n) => ({ ...n, children: buildTree(n.id), expanded: expandedIds.has(n.id) }));
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const openNew = (pid: string | null) => {
    setEditing(null);
    setParentId(pid);
    setForm({ label: "", message: "", answer_html: "", keywords: "", sort_order: 0, link_buttons: [] });
    setOpen(true);
  };

  const openEdit = (node: Node) => {
    setEditing(node);
    setParentId(node.parent_id);
    setForm({
      label: node.label,
      message: node.message || "",
      answer_html: node.answer_html || "",
      keywords: node.keywords || "",
      sort_order: node.sort_order,
      link_buttons: Array.isArray((node as any).link_buttons) ? (node as any).link_buttons : [],
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) { toast.error("라벨을 입력해주세요."); return; }
    const payload = {
      label: form.label,
      message: form.message || null,
      answer_html: form.answer_html || null,
      keywords: form.keywords || null,
      sort_order: form.sort_order,
      link_buttons: form.link_buttons.filter((b) => b.label.trim() && b.url.trim()),
      category_id: selectedCat,
      parent_id: parentId,
      language: lang,
    };
    if (editing) {
      await supabase.from("scenario_nodes").update(payload).eq("id", editing.id);
      toast.success("수정 완료");
    } else {
      await supabase.from("scenario_nodes").insert(payload);
      toast.success("추가 완료");
    }
    setOpen(false);
    loadNodes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 노드와 하위 항목이 모두 삭제됩니다. 계속하시겠습니까?")) return;
    await supabase.from("scenario_nodes").delete().eq("id", id);
    toast.success("삭제 완료");
    loadNodes();
  };

  const renderNode = (node: TreeNode, depth: number) => (
    <div key={node.id}>
      <div className="flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md group" style={{ paddingLeft: `${depth * 24 + 12}px` }}>
        {node.children.length > 0 ? (
          <button onClick={() => toggleExpand(node.id)} className="w-5 h-5 flex items-center justify-center">
            {node.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <FileText className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="flex-1 text-sm font-medium">{node.label}</span>
        {node.answer_html && <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">답변있음</span>}
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openNew(node.id)}><Plus className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(node)}><Pencil className="w-3 h-3" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(node.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
        </div>
      </div>
      {node.expanded && node.children.map((child) => renderNode(child, depth + 1))}
    </div>
  );

  const tree = buildTree(null);

  return (
    <div>
      <h1 className="text-xl font-bold mb-3">시나리오 관리</h1>
      <LanguageTabs value={lang} onChange={setLang} />
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Select value={selectedCat} onValueChange={setSelectedCat}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="카테고리 선택" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categories.length === 0 && (
            <span className="text-sm text-muted-foreground">먼저 해당 언어의 카테고리를 등록해주세요.</span>
          )}
        </div>
        <Button onClick={() => openNew(null)} disabled={!selectedCat}><Plus className="w-4 h-4 mr-1" />루트 노드 추가</Button>
      </div>

      <div className="bg-card rounded-lg border p-4 min-h-[300px]">
        {tree.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">등록된 시나리오가 없습니다.</p>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "노드 수정" : "노드 추가"} ({lang.toUpperCase()})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">라벨 (버튼에 표시)</label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="예: 여주점 운영시간" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">안내 메시지 (하위 항목이 있을 때 표시)</label>
              <Input value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="예: 문의하실 내용을 선택해주세요~" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">답변 (최종 답변 - 하위 항목 없을 때)</label>
              <RichTextEditor value={form.answer_html} onChange={(html) => setForm({ ...form, answer_html: html })} />
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">링크 버튼 설정 (답변 하단에 노출)</label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm({ ...form, link_buttons: [...form.link_buttons, { label: "", url: "" }] })
                  }
                >
                  <Plus className="w-3 h-3 mr-1" /> 버튼 추가
                </Button>
              </div>
              {form.link_buttons.length === 0 ? (
                <p className="text-xs text-muted-foreground">등록된 링크 버튼이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {form.link_buttons.map((b, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <Input
                        className="flex-1"
                        placeholder="버튼명 (예: 여주 위치 안내)"
                        value={b.label}
                        onChange={(e) => {
                          const next = [...form.link_buttons];
                          next[idx] = { ...next[idx], label: e.target.value };
                          setForm({ ...form, link_buttons: next });
                        }}
                      />
                      <Input
                        className="flex-[2]"
                        placeholder="https://..."
                        value={b.url}
                        onChange={(e) => {
                          const next = [...form.link_buttons];
                          next[idx] = { ...next[idx], url: e.target.value };
                          setForm({ ...form, link_buttons: next });
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setForm({
                            ...form,
                            link_buttons: form.link_buttons.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
  );
};

export default ScenariosPage;
