import { requireNativeModule } from "expo-modules-core";

export type BrowserInfo = {
  name: string;
  packageName: string;
};

type BrowserLauncherType = {
  getInstalledBrowsers(): Promise<BrowserInfo[]>;
  openExternal(url: string, packageName: string): Promise<void>;
  openCustomTab(url: string): Promise<void>;
  getDefaultBrowser(): Promise<BrowserInfo | null>;
};

export default requireNativeModule<BrowserLauncherType>(
  "BrowserLauncher"
);