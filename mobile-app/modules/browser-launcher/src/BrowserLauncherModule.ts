import { NativeModule, requireNativeModule } from 'expo';

import { BrowserLauncherModuleEvents } from './BrowserLauncher.types';

declare class BrowserLauncherModule extends NativeModule<BrowserLauncherModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<BrowserLauncherModule>('BrowserLauncher');
