import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { init } from "../init";
import { retrieveLaunchParams } from "@tma.js/sdk-react";
import { EnvUnsupported } from "./components/EnvUnsupported";

const root = ReactDOM.createRoot(document.getElementById("root")!);

try {
    const launchParams = retrieveLaunchParams();
    const { tgWebAppPlatform: platform } = launchParams;
    const debug = (launchParams.tgWebAppStartParam || '').includes('debug') || import.meta.env.DEV;

    await init({
        debug,
        mockForMacOS: platform === 'macos',
    }).then(() => {
        root.render(
            <StrictMode>
                <App />
            </StrictMode>
        )
    })
} catch (e) {
    root.render(<EnvUnsupported />);
}
