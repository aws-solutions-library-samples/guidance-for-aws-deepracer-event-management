import { HelpPanel } from '@cloudscape-design/components';
import ReactMarkdown from 'react-markdown';

/**
 * Props interface for SimpleHelpPanelLayout component
 */
interface SimpleHelpPanelLayoutProps {
  /** Markdown content for the help panel header */
  headerContent: string;
  /** Markdown content for the help panel body */
  bodyContent?: string;
  /** Markdown content for the help panel footer */
  footerContent?: string;
}

/**
 * SimpleHelpPanelLayout component that renders a help panel with markdown content
 * @param props - Component props with markdown content
 * @returns Rendered help panel with header, body, and footer
 */
export const SimpleHelpPanelLayout = ({ 
  headerContent, 
  bodyContent, 
  footerContent 
}: SimpleHelpPanelLayoutProps): JSX.Element => {
  return (
    <HelpPanel
      header={<ReactMarkdown children={headerContent} />}
      footer={<ReactMarkdown children={footerContent} />}
    >
      <div>
        <ReactMarkdown children={bodyContent} />
      </div>
    </HelpPanel>
  );
};
