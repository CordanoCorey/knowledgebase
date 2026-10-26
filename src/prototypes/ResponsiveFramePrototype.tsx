// THROWAWAY #33: compare responsive placement and drawer modality on the existing
// header/sidebar prototype route (?responsive=1&variant=A|B|C). In-memory fixtures.
import { useEffect, useRef, useState } from "react";
import { Home, Layers3, CalendarDays, Bell, UserCircle } from "lucide-react";
import "./responsiveFramePrototype.css";

const variants = ["A", "B", "C"] as const;
type Variant = typeof variants[number];
const labels = { A: "Bottom bar · side sheet", B: "Top bar · full screen", C: "Retained rail · bottom sheet" };
const places = ["Dashboard", "Arche Classical Academy", "Ruler of Kings Church", "Gelbaugh Family", "Westminster Study Circle"];
const sections = ["Overview", "Knowledge Navigator", "Contribute", "Answer Feed"];

export function ResponsiveFramePrototype() {
  const initial = new URLSearchParams(location.search).get("variant");
  const [variant, setVariant] = useState<Variant>(initial === "B" || initial === "C" ? initial : "A");
  const [panel, setPanel] = useState<string | null>(null);
  const [page, setPage] = useState("Arche Classical Academy");
  const [notice, setNotice] = useState("");
  const [wide, setWide] = useState(() => matchMedia("(min-width: 1100px)").matches);
  const drawer = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const modal = !wide || variant === "B";

  useEffect(() => {
    const query = matchMedia("(min-width: 1100px)");
    const sync = () => setWide(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const dialog = drawer.current;
    if (!dialog || !panel) return;
    dialog.close();
    if (modal) dialog.showModal(); else dialog.show();
    closeButton.current?.focus();
    const previous = document.body.style.overflow;
    if (modal) document.body.style.overflow = "hidden";
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, [panel, modal]);

  function close() {
    setPanel(null);
    requestAnimationFrame(() => opener.current?.isConnected ? opener.current.focus() : heading.current?.focus());
  }
  function open(name: string, target: HTMLElement) {
    if (panel === name) { close(); return; }
    opener.current = target;
    setPanel(name);
  }
  function navigate(destination: string, section?: string) {
    setPage(destination);
    setPanel(null);
    setNotice(`${destination}${section ? `, ${section}` : ""}`);
    requestAnimationFrame(() => {
      const target = section ? document.getElementById(`rf-${section}`) : heading.current;
      target?.focus(); target?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  function cycle(direction: number) {
    const next = variants[(variants.indexOf(variant) + direction + 3) % 3];
    close(); setVariant(next);
    const url = new URL(location.href); url.searchParams.set("variant", next);
    history.replaceState(null, "", url);
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (panel || !(event.target instanceof HTMLElement) || event.target.closest("input,textarea,select,[contenteditable=true],[role=dialog]")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault(); cycle(event.key === "ArrowLeft" ? -1 : 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const navigation = <nav className="rf-nav" aria-label="Application">
    {[["Dashboard", Home], ["Places", Layers3], ["Calendar", CalendarDays], ["Notifications", Bell], ["Account", UserCircle]].map(([name, Icon]) => {
      const text = String(name);
      const Glyph = Icon as typeof Home;
      const disclosure = text === "Places" || text === "Account";
      return <button key={text} title={text} aria-label={text === "Notifications" ? "Notifications, 4 unread" : text}
        aria-expanded={disclosure ? panel === text : undefined} aria-controls={disclosure ? "rf-drawer" : undefined}
        onClick={e => disclosure ? open(text, e.currentTarget) : navigate(text)}>
        <Glyph aria-hidden="true" size={20} /><span>{text === "Notifications" ? "Notices · 4" : text}</span>
      </button>;
    })}
  </nav>;

  return <div className={`rf-shell rf-${variant} ${panel && !modal ? "rf-docked" : ""}`}>
    <a className="rf-skip" href="#rf-main">Skip to content</a>
    {navigation}
    <div className="rf-work">
      <header className="rf-header">
        <button aria-controls="rf-drawer" aria-expanded={panel === "On this page"} onClick={e => open("On this page", e.currentTarget)}>
          <small>Knowledge Page</small><strong>{page}</strong>
          {page === "Arche Classical Academy" && <span>Administrator · Teacher · Parent</span>}
          <span>Contents ▾</span>
        </button>
        <label>Search Everything<input type="search" placeholder="Search accessible knowledge" onKeyDown={e => {
          if (e.key === "Enter") setNotice("Prototype: search submitted; no live query is sent.");
        }} /></label>
      </header>
      <main id="rf-main" tabIndex={-1}>
        <h1 ref={heading} tabIndex={-1}>{page}</h1>
        {sections.map(section => <section key={section}>
          <h2 id={`rf-${section}`} tabIndex={-1}>{section}</h2>
          {section === "Overview" ? <p>A shared place for the knowledge our community contributes.</p> :
          section === "Knowledge Navigator" ? <><button>Arche Classical Academy ×</button><label>Search within context<input placeholder="Find an existing Tag or search this context" /></label></> :
          section === "Contribute" ? <label>Add knowledge<textarea placeholder="Write something worth returning to…" /><button onClick={() => setNotice("Prototype: draft retained in this session; nothing submitted.")}>Contribute</button></label> :
          ["Learning through careful questions", "Reading together", "Practicing what we know", "A useful lesson to return to"].map(title => <article key={title}><h3>{title}</h3><p>Community knowledge · Words</p><button onClick={() => navigate(title)}>Open entry</button></article>)}
        </section>)}
      </main>
    </div>
    {panel && <dialog ref={drawer} id="rf-drawer" className="rf-drawer" aria-labelledby="rf-panel-title" aria-modal={modal || undefined}
      onCancel={e => { e.preventDefault(); close(); }}
      onClick={e => { if (e.target === e.currentTarget) {
        const rect = e.currentTarget.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) close();
      } }}
      onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); close(); } }}>
      <div className="rf-drawer-heading"><h2 id="rf-panel-title">{panel}</h2><button ref={closeButton} onClick={close} aria-label={`Close ${panel}`}>✕</button></div>
      <div className="rf-panel-scroll">
        {panel === "Places" ? places.map(place => <button key={place} onClick={() => navigate(place)}>{place}<small>{place === "Arche Classical Academy" ? "Administrator · Teacher · Parent" : "Knowledge Page"}</small></button>) :
        panel === "On this page" ? sections.map(section => <button key={section} onClick={() => navigate(page, section)}>{section}</button>) :
        ["To-do", "Profile", "Commonplace Book", "Settings", "Administration"].map(item => <button key={item} onClick={() => navigate(item)}>{item}</button>)}
        {panel === "Account" && <><button onClick={() => document.documentElement.classList.toggle("rf-dark")}>Change theme</button><button onClick={() => setNotice("Prototype: sign out is simulated.")}>Sign out</button></>}
      </div>
    </dialog>}
    <p className="rf-live" role="status">{notice}</p>
    {import.meta.env.DEV && <aside className="rf-tools" aria-label="Prototype controls">
      <div><button aria-label="Previous variant" onClick={() => cycle(-1)}>←</button><b>{variant} · {labels[variant]}</b><button aria-label="Next variant" onClick={() => cycle(1)}>→</button></div>
      <small>Throwaway #33 · {wide ? "Desktop" : "Compact"} · {panel || "Closed"} · {panel ? modal ? "Modal, page blocked" : "Docked, page usable" : "Page usable"}</small>
    </aside>}
  </div>;
}
