// Simple, recognizable brand tiles for the integration cards. Each is a rounded
// square with the source's mark — no external asset dependencies.

export type SourceId = "csv" | "airtable" | "typeform" | "googleforms" | "notion";

function Tile({ children, bg }: { children: React.ReactNode; bg: string }) {
  return (
    <span
      className="flex h-11 w-11 items-center justify-center rounded-xl"
      style={{ background: bg }}
    >
      {children}
    </span>
  );
}

export function SourceLogo({ id }: { id: SourceId }) {
  switch (id) {
    case "csv":
      return (
        <Tile bg="#111827">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M8 13h8M8 17h5" />
          </svg>
        </Tile>
      );
    case "airtable":
      // Airtable's mark: three colored shapes.
      return (
        <Tile bg="#ffffff">
          <svg width="26" height="22" viewBox="0 0 24 20" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.1 1.2 2.3 4.8c-.5.2-.5.9 0 1.1l8.8 3.5c.6.2 1.2.2 1.8 0l8.8-3.5c.5-.2.5-.9 0-1.1L12.9 1.2c-.6-.2-1.2-.2-1.8 0Z" fill="#FFBF00" />
            <path d="M12.6 11.1v8.1c0 .4.4.7.8.6l9.1-3.5c.2-.1.4-.3.4-.6V7.7c0-.4-.4-.7-.8-.6l-9.1 3.5c-.2.1-.4.3-.4.5Z" fill="#26B5F8" />
            <path d="M10.9 11.4 8.2 12.7 1.5 15.9c-.4.2-.9-.1-.9-.6V7.8c0-.2.1-.3.2-.4l.3-.2c.1 0 2.9 1.3 8.4 3.6.4.2.5.4.5.6 0 .2-.4-.6 1.2.4Z" fill="#ED3049" />
          </svg>
        </Tile>
      );
    case "typeform":
      return (
        <Tile bg="#262627">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M12 3c-4.5 0-7 2.4-7 6.2 0 2.5 1.3 4.4 3.4 5.3v3.9c0 .4.3.6.6.6.2 0 .3 0 .5-.2l2.2-2h.3c4.5 0 7-2.4 7-6.2S16.5 3 12 3Z" />
          </svg>
        </Tile>
      );
    case "googleforms":
      return (
        <Tile bg="#ffffff">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="#7248B9" />
            <path d="M14 2v6h6z" fill="#5b2ea6" />
            <path d="M8.5 12.5h7M8.5 15.5h7M8.5 9.5h4" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </Tile>
      );
    case "notion":
      return (
        <Tile bg="#ffffff">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <rect x="2" y="2" width="20" height="20" rx="3" fill="#fff" stroke="#111" strokeWidth="1.5" />
            <path d="M8 8v8M8 8l8 8M16 8v8" stroke="#111" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Tile>
      );
  }
}
