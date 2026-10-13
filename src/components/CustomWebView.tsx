import React from 'react';
import { SandboxedHtmlView, SandboxedHtmlViewProps } from './SandboxedHtmlView';

export interface CustomWebViewProps extends Omit<SandboxedHtmlViewProps, 'htmlContent'> {
  content?: string;
  htmlContent?: string;
}

export const CustomWebView: React.FC<CustomWebViewProps> = ({
  content,
  htmlContent,
  ...props
}) => {
  return (
    <SandboxedHtmlView
      htmlContent={htmlContent || content}
      {...props}
    />
  );
};

export { SandboxedHtmlView };
export default CustomWebView;
