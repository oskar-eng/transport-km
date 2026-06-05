// Logo Yacz Cargo — wordmark con líneas de velocidad rojas
// variant "onDark": para fondos oscuros (sidebar). "onLight": para fondos claros (login).

const NAVY = "#173a73";
const RED = "#e1232a";

export default function Logo({ variant = "onLight", size = "md" }: {
  variant?: "onDark" | "onLight"; size?: "sm" | "md" | "lg";
}) {
  const yaczColor = variant === "onDark" ? "#ffffff" : NAVY;
  const textSize = size === "lg" ? "text-3xl" : size === "sm" ? "text-base" : "text-xl";
  const lineW = size === "lg" ? "w-6" : size === "sm" ? "w-3.5" : "w-4";

  return (
    <div className="flex items-center gap-2 select-none">
      {/* Líneas de velocidad */}
      <div className="flex flex-col gap-[3px] shrink-0">
        <span className={`block ${lineW} h-[3px] rounded-full`} style={{ background: RED }} />
        <span className={`block ${lineW} h-[3px] rounded-full opacity-90`} style={{ background: RED, width: "75%" }} />
        <span className={`block ${lineW} h-[3px] rounded-full`} style={{ background: RED }} />
      </div>
      {/* Wordmark */}
      <div className={`font-extrabold tracking-tight leading-none ${textSize}`}>
        <span style={{ color: yaczColor }}>YACZ</span>
        <span style={{ color: RED }} className="ml-1.5">CARGO</span>
      </div>
    </div>
  );
}
