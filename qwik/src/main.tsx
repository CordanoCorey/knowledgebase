import { render } from "@qwik.dev/core";
import App from "./root";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing Qwik root element.");
}

render(root, <App />);
