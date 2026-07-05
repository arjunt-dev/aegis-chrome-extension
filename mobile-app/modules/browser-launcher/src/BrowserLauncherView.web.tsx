import * as React from 'react';

import { BrowserLauncherViewProps } from './BrowserLauncher.types';

export default function BrowserLauncherView(props: BrowserLauncherViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
