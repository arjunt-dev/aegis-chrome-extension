import { registerWebModule, NativeModule } from 'expo';

import { BrowserLauncherModuleEvents } from './BrowserLauncher.types';

class BrowserLauncherModule extends NativeModule<BrowserLauncherModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(BrowserLauncherModule, 'BrowserLauncherModule');
