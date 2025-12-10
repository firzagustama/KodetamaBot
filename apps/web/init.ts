import {
  setDebug,
  themeParams,
  initData,
  viewport,
  init as initSDK,
  mockTelegramEnv,
  retrieveLaunchParams,
  emitEvent,
  miniApp,
  backButton,
} from "@tma.js/sdk-react";

/**
 * Normalize theme params to Telegram event format
 */
function normalizeThemeParams(
  source: Record<string, unknown> | undefined
): Record<string, `#${string}` | undefined> {
  const result: Record<string, `#${string}` | undefined> = {};

  if (!source) return result;

  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" && value.startsWith("#")) {
      result[key] = value as `#${string}`;
    }
  }

  return result;
}

/**
 * Initializes the application and configures its dependencies.
 */
export async function init(options: {
  debug: boolean;
  mockForMacOS: boolean;
}): Promise<void> {
  setDebug(options.debug);
  initSDK();

  localStorage.removeItem("auth_token");

  // ✅ macOS Telegram workaround
  if (options.mockForMacOS) {
    let firstThemeSent = false;

    mockTelegramEnv({
      onEvent(event, next) {
        if (event.name === "web_app_request_theme") {
          let rawTheme: Record<string, unknown>;

          if (firstThemeSent) {
            rawTheme = themeParams.state();
          } else {
            firstThemeSent = true;
            rawTheme =
              retrieveLaunchParams().tgWebAppThemeParams ?? {};
          }

          return emitEvent("theme_changed", {
            theme_params: normalizeThemeParams(rawTheme),
          });
        }

        if (event.name === "web_app_request_safe_area") {
          return emitEvent("safe_area_changed", {
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
          });
        }

        next();
      },
    });
  }

  // ✅ Mount core features
  backButton.mount.ifAvailable();
  initData.restore();

  if (miniApp.mount.isAvailable()) {
    themeParams.mount();
    miniApp.mount();
    themeParams.bindCssVars();
  }

  if (viewport.mount.isAvailable()) {
    viewport.mount().then(() => {
      viewport.bindCssVars();
    });
  }
}