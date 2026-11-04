import "@xterm/xterm/css/xterm.css";
import type { Terminal } from "@xterm/xterm";
import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

export type TerminalHandle = { write(text: string): void; prompt(): void };

const PROMPT = "\x1b[38;2;224;122;46m$\x1b[0m ";

// Command mode: the student types a line, Enter sends it, output streams back. Up and down walk the history; Ctrl+C stops.
export function TerminalPanel({ ref, onCommand, onInterrupt }: { ref: Ref<TerminalHandle>; onCommand(line: string): void; onInterrupt(): void }) {
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const handlers = useRef({ onCommand, onInterrupt });
  useEffect(() => {
    handlers.current = { onCommand, onInterrupt };
  });

  useImperativeHandle(ref, () => ({
    // the sandbox sends bare \n; xterm needs \r\n to return to the start of the line
    write: (text) => term.current?.write(text.replace(/\r?\n/g, "\r\n")),
    prompt: () => term.current?.write(`\r\n${PROMPT}`),
  }));

  useEffect(() => {
    let disposed = false;
    let line = "";
    const history: string[] = [];
    let back = 0;
    import("@xterm/xterm").then(({ Terminal }) => {
      if (disposed || !host.current) return;
      const t = new Terminal({
        fontFamily: "var(--font-jetbrains), ui-monospace, monospace",
        fontSize: 13,
        convertEol: false,
        cursorBlink: true,
        theme: { background: "#14161f", foreground: "#faf5eb", cursor: "#e07a2e", selectionBackground: "#3a2415" },
      });
      t.open(host.current);
      term.current = t;
      t.write(`Commands run in your browser for Python and web projects, and in the cloud sandbox for everything else.\r\n${PROMPT}`);
      const replace = (text: string) => {
        t.write(`\x1b[2K\r${PROMPT}${text}`);
        line = text;
      };
      t.onData((data) => {
        if (data === "\x03") {
          t.write("^C");
          handlers.current.onInterrupt();
          line = "";
          t.write(`\r\n${PROMPT}`);
        } else if (data === "\r") {
          const command = line.trim();
          t.write("\r\n");
          line = "";
          back = 0;
          if (!command) return t.write(PROMPT);
          history.push(command);
          handlers.current.onCommand(command);
        } else if (data === "\x7f") {
          if (line) {
            line = line.slice(0, -1);
            t.write("\b \b");
          }
        } else if (data === "\x1b[A") {
          if (back < history.length) replace(history[history.length - ++back]);
        } else if (data === "\x1b[B") {
          back = Math.max(0, back - 1);
          replace(back ? history[history.length - back] : "");
        } else if (!data.startsWith("\x1b")) {
          line += data;
          t.write(data);
        }
      });
      // fit to the panel: xterm has no automatic sizing without its addon, so measure one character
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = `13px ${getComputedStyle(document.body).getPropertyValue("--font-jetbrains") || "monospace"}, monospace`;
      const charWidth = ctx.measureText("W").width * 1.1; // a margin, since xterm may fall back to a wider font
      const fit = () => {
        const box = host.current?.getBoundingClientRect();
        if (box) t.resize(Math.max(20, Math.floor((box.width - 24) / charWidth)), Math.max(5, Math.floor((box.height - 16) / 18)));
      };
      fit();
      new ResizeObserver(fit).observe(host.current);
    });
    return () => {
      disposed = true;
      term.current?.dispose();
    };
  }, []);

  return <div ref={host} className="h-full w-full overflow-hidden bg-[#14161f] p-2" />;
}
