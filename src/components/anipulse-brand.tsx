import logo from "@/assets/anipulse-logo.png";

export function Brand() {
  return <div className="brand"><img className="brand-mark" src={logo} alt="" width={36} height={36} /><span>Ani<span className="text-primary">Pulse</span></span></div>;
}