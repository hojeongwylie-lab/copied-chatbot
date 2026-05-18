import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, Download } from "lucide-react";
import Papa from "papaparse";
import type { Tables } from "@/integrations/supabase/types";

type Brand = Tables<"brand_tenants">;

interface BrandForm {
  store_name: string;
  brand_name: string;
  brand_name_en: string;
  brand_name_zh: string;
  brand_name_ja: string;
  category: string;
  tenant_code: string;
}

const emptyForm: BrandForm = {
  store_name: "",
  brand_name: "",
  brand_name_en: "",
  brand_name_zh: "",
  brand_name_ja: "",
  category: "",
  tenant_code: "",
};

const BrandsPage = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<BrandForm>(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("brand_tenants").select("*").order("store_name").order("brand_name");
    setBrands(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.store_name || !form.brand_name || !form.tenant_code) {
      toast.error("필수 항목을 입력해주세요."); return;
    }
    const payload = {
      ...form,
      brand_name_zh: form.brand_name_zh || null,
      brand_name_ja: form.brand_name_ja || null,
    };
    if (editing) {
      await supabase.from("brand_tenants").update(payload).eq("id", editing.id);
      toast.success("수정 완료");
    } else {
      await supabase.from("brand_tenants").insert(payload);
      toast.success("추가 완료");
    }
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("삭제하시겠습니까?")) return;
    await supabase.from("brand_tenants").delete().eq("id", id);
    toast.success("삭제 완료");
    load();
  };

  const openEdit = (b: Brand) => {
    setEditing(b);
    setForm({
      store_name: b.store_name,
      brand_name: b.brand_name,
      brand_name_en: b.brand_name_en,
      brand_name_zh: (b as any).brand_name_zh || "",
      brand_name_ja: (b as any).brand_name_ja || "",
      category: b.category,
      tenant_code: b.tenant_code,
    });
    setOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[];
        const inserts = rows
          .filter((r) => r["점포"] && r["브랜드명"] && r["테넌트코드"])
          .map((r) => ({
            store_name: r["점포"],
            brand_name: r["브랜드명"],
            brand_name_en: r["영문브랜드명"] || "",
            brand_name_zh: r["중문브랜드명"] || null,
            brand_name_ja: r["일문브랜드명"] || null,
            category: r["카테고리"] || "",
            tenant_code: r["테넌트코드"],
          }));

        if (inserts.length === 0) {
          toast.error("유효한 데이터가 없습니다. 컬럼명을 확인해주세요. (점포, 브랜드명, 영문브랜드명, 중문브랜드명, 일문브랜드명, 카테고리, 테넌트코드)");
          return;
        }

        const { error } = await supabase.from("brand_tenants").insert(inserts);
        if (error) {
          toast.error("업로드 실패: " + error.message);
        } else {
          toast.success(`${inserts.length}건 업로드 완료`);
          load();
        }
      },
      error: () => toast.error("파일 파싱 실패"),
    });
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleExport = () => {
    const csv = Papa.unparse(brands.map((b: any) => ({
      점포: b.store_name,
      브랜드명: b.brand_name,
      영문브랜드명: b.brand_name_en,
      중문브랜드명: b.brand_name_zh || "",
      일문브랜드명: b.brand_name_ja || "",
      카테고리: b.category,
      테넌트코드: b.tenant_code,
    })));
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "brands.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = brands.filter((b: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [b.store_name, b.brand_name, b.brand_name_en, b.brand_name_zh, b.brand_name_ja]
      .filter(Boolean)
      .some((v: string) => v.toLowerCase().includes(s));
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-xl font-bold">입점 브랜드 관리</h1>
        <div className="flex items-center gap-2">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색..." className="w-48" />
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileUpload} />
          <Button variant="outline" size="sm" asChild>
            <a href="/sample_brands.csv" download="sample_brands.csv">
              <Download className="w-4 h-4 mr-1" />샘플 CSV
            </a>
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />CSV 업로드
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />내보내기
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setForm(emptyForm); }}><Plus className="w-4 h-4 mr-1" />추가</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? "브랜드 수정" : "브랜드 추가"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-1">점포 *</label>
                  <Input value={form.store_name} onChange={(e) => setForm({ ...form, store_name: e.target.value })} placeholder="예: 여주점" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">브랜드명 (한국어) *</label>
                  <Input value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} placeholder="예: 구찌" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">영문 브랜드명</label>
                  <Input value={form.brand_name_en} onChange={(e) => setForm({ ...form, brand_name_en: e.target.value })} placeholder="예: GUCCI" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">중문 브랜드명</label>
                  <Input value={form.brand_name_zh} onChange={(e) => setForm({ ...form, brand_name_zh: e.target.value })} placeholder="예: 古驰" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">일문 브랜드명</label>
                  <Input value={form.brand_name_ja} onChange={(e) => setForm({ ...form, brand_name_ja: e.target.value })} placeholder="예: グッチ" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">카테고리</label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="예: 명품/해외패션" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">테넌트코드 *</label>
                  <Input value={form.tenant_code} onChange={(e) => setForm({ ...form, tenant_code: e.target.value })} placeholder="예: GUC001" />
                </div>
                <Button onClick={handleSave} className="w-full">{editing ? "수정" : "추가"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      <div className="text-sm text-muted-foreground mb-3">총 {filtered.length}건</div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>점포</TableHead>
              <TableHead>브랜드명</TableHead>
              <TableHead>EN</TableHead>
              <TableHead>ZH</TableHead>
              <TableHead>JA</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>테넌트코드</TableHead>
              <TableHead className="w-24">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((b: any) => (
              <TableRow key={b.id}>
                <TableCell>{b.store_name}</TableCell>
                <TableCell className="font-medium">{b.brand_name}</TableCell>
                <TableCell>{b.brand_name_en}</TableCell>
                <TableCell>{b.brand_name_zh || "-"}</TableCell>
                <TableCell>{b.brand_name_ja || "-"}</TableCell>
                <TableCell>{b.category}</TableCell>
                <TableCell className="font-mono text-xs">{b.tenant_code}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">등록된 브랜드가 없습니다.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default BrandsPage;
