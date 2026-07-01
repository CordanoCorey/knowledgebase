import archePressIconUrl from "../assets/arche-press_icon-full.svg";

// Brand rendering stays in one component so shell/header variants share the same
// accessible label and asset treatment.
type LogeionBrandProps = {
  className?: string;
  density?: "full" | "compact";
};

export function LogeionBrand({
  className,
  density = "full",
}: LogeionBrandProps) {
  const brandClassName = [
    "logeion-brand",
    density === "compact" ? "logeion-brand-compact" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={brandClassName}>
      <img
        className="logeion-brand-mark"
        src={archePressIconUrl}
        alt=""
        aria-hidden="true"
      />
      {density === "full" ? (
        <span className="logeion-brand-copy">
          <span className="logeion-brand-name">Logeion</span>
          <span className="logeion-brand-publisher">by Arche Press</span>
        </span>
      ) : null}
    </span>
  );
}
