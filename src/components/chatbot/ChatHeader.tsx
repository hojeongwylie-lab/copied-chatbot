import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useLanguage, LANGUAGES, LangCode } from "@/contexts/LanguageContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, ChevronDown, Check } from "lucide-react";

const ChatHeader = () => {
  const { language, setLanguage } = useLanguage();
  const { settings } = useSiteSettings(language);
  const currentLang = LANGUAGES.find((l) => l.code === language)!;

  return (
    <div className="relative gradient-header shadow-header overflow-hidden">
      {/* Subtle white accent line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-white/20" />
      {/* Decorative glow */}
      <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-12 w-40 h-40 rounded-full bg-white/5 blur-3xl pointer-events-none" />

      <div className="relative px-4 py-3.5 flex items-center gap-3">
        {/* Logo with subtle white ring */}
        <div className="relative shrink-0">
          <div className="relative w-11 h-11 rounded-full bg-white/15 p-[2px] ring-1 ring-white/25 backdrop-blur-sm">
            <div className="w-full h-full rounded-full bg-[hsl(var(--navy-deep))] flex items-center justify-center overflow-hidden">
              {settings.bot_logo_url ? (
                <img src={settings.bot_logo_url} alt="Bot logo" className="w-full h-full object-cover rounded-full" />
              ) : (
                <span className="text-white font-bold text-sm tracking-wider">SS</span>
              )}
            </div>
          </div>
          {/* Online dot */}
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[hsl(var(--navy-deep))] animate-shimmer" />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-primary-foreground font-bold text-base truncate tracking-tight">
            {settings.bot_name}
          </h1>
          <p className="text-white/65 text-[11px] truncate font-medium">
            {settings.bot_subtitle}
          </p>
        </div>

        {/* Language Selector — White glassmorphism */}
        <DropdownMenu>
          <DropdownMenuTrigger className="group relative flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/15 hover:bg-white/25 text-white text-xs font-semibold ring-1 ring-white/30 backdrop-blur-sm transition-all duration-200 active:scale-95">
            <Globe className="w-3.5 h-3.5" />
            <span className="tracking-wider">{currentLang.short}</span>
            <ChevronDown className="w-3 h-3 group-data-[state=open]:rotate-180 transition-transform" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="min-w-[160px] bg-popover border border-border shadow-xl rounded-xl p-1.5 mt-2"
          >
            {LANGUAGES.map((l) => {
              const active = language === l.code;
              return (
                <DropdownMenuItem
                  key={l.code}
                  onClick={() => setLanguage(l.code as LangCode)}
                  className={`cursor-pointer rounded-lg px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                    active
                      ? "bg-muted text-[hsl(var(--navy))] font-semibold"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${active ? "bg-[hsl(var(--navy))] text-white" : "bg-muted text-muted-foreground"}`}>
                    {l.short}
                  </span>
                  <span className="flex-1">{l.label}</span>
                  {active && <Check className="w-3.5 h-3.5 text-[hsl(var(--navy))]" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Bottom subtle white line */}
      <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
};

export default ChatHeader;
