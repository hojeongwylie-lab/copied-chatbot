import { LangCode, LANGUAGES } from "@/contexts/LanguageContext";

interface Props {
  value: LangCode;
  onChange: (lang: LangCode) => void;
}

const LanguageTabs = ({ value, onChange }: Props) => {
  return (
    <div className="inline-flex rounded-lg border bg-muted p-1 mb-4">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => onChange(l.code as LangCode)}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            value === l.code
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageTabs;
